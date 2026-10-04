import {TRACK} from './track.js';
import {RaceAnalysis} from './race-analysis.js';
import {FormulaCar,clamp,steeringLock} from './physics.js';
import {planRivalTraffic,trackGap} from './rival-traffic.js';
import {RACING_LINE,corneringSpeed} from './racing-line.js';
import {draftingStrength,updateRivalEnergy} from './rival-energy.js';
import {RIVAL_PROFILES,driverProfile} from './rival-profiles.js';
import {rivalSpeed} from './rival-speed.js';
import {expertSteering} from './rival-driver.js';
import {rivalIntent} from './rival-intent.js';
export const RACE_DIFFICULTIES=Object.freeze({
  medium:Object.freeze({label:'MEDIUM',pace:1,anticipation:.9}),
  hard:Object.freeze({label:'HARD',pace:1,anticipation:.375,pushPace:true}),
});
// Passing lanes have different corner radii. Measure their braking envelopes
// instead of applying a blanket speed penalty whenever traffic changes our line.
const laneProfiles=new Map();
function laneSpeed(s,lane,expert=false){
  const key=Math.round(clamp(lane,-4.5,4.5)*2)/2;
  const cacheKey=`${key}:${expert}`;
  if(!laneProfiles.has(cacheKey)){
    const count=Math.ceil(TRACK.length/3),step=TRACK.length/count;
    const points=Array.from({length:count},(_,i)=>{const p=TRACK.sample(i*step);return {x:p.x+p.nx*key,z:p.z+p.nz*key};});
    const speeds=points.map((p,i)=>{
      const a=points[(i+count-2)%count],b=points[(i+2)%count];
      const ab=Math.hypot(p.x-a.x,p.z-a.z),bc=Math.hypot(b.x-p.x,b.z-p.z),ac=Math.hypot(b.x-a.x,b.z-a.z);
      return corneringSpeed(2*Math.abs((p.x-a.x)*(b.z-p.z)-(p.z-a.z)*(b.x-p.x))/Math.max(.001,ab*bc*ac))*(expert?.95:.8);
    });
    for(let lap=0;lap<3;lap++)for(let i=count-1;i>=0;i--){const j=(i+1)%count; speeds[i]=Math.min(speeds[i],Math.sqrt(speeds[j]**2+2*(expert?20:12)*Math.hypot(points[j].x-points[i].x,points[j].z-points[i].z)));}
    laneProfiles.set(cacheKey,{speeds,step});
  }
  const {speeds,step}=laneProfiles.get(cacheKey),u=((s%TRACK.length)+TRACK.length)%TRACK.length/step,i=Math.floor(u),t=u-i;
  return speeds[i]*(1-t)+speeds[(i+1)%speeds.length]*t;
}
export const angleDelta=a=>Math.atan2(Math.sin(a),Math.cos(a));
// Resolve the full length and width of two open-wheel cars, including their
// wings and tyres. A centre-distance check lets a nose or wheel enter a cockpit.
export function resolveCarContact(a,b){
  // Rounded longitudinal footprints follow the tapered nose and tail. Boxes
  // spuriously hit cars passing diagonally, even when their tyres are clear.
  const half=1.45,radius=1.25;
  const ax=a.x-Math.sin(a.heading)*half,az=a.z-Math.cos(a.heading)*half;
  const bx=b.x-Math.sin(b.heading)*half,bz=b.z-Math.cos(b.heading)*half;
  const ux=Math.sin(a.heading)*2*half,uz=Math.cos(a.heading)*2*half;
  const vx=Math.sin(b.heading)*2*half,vz=Math.cos(b.heading)*2*half;
  const wx=ax-bx,wz=az-bz,aa=ux*ux+uz*uz,bb=ux*vx+uz*vz,ee=vx*vx+vz*vz;
  const cc=ux*wx+uz*wz,ff=vx*wx+vz*wz,denom=aa*ee-bb*bb;
  let s=denom>1e-8?clamp((bb*ff-cc*ee)/denom,0,1):0;
  let t=(bb*s+ff)/ee;
  if(t<0){t=0;s=clamp(-cc/aa,0,1);}else if(t>1){t=1;s=clamp((bb-cc)/aa,0,1);}
  const dx=bx+vx*t-ax-ux*s,dz=bz+vz*t-az-uz*s,dist=Math.hypot(dx,dz);
  if(dist>=radius*2)return false;
  const centreX=b.x-a.x,centreZ=b.z-a.z,centreDist=Math.hypot(centreX,centreZ);
  const nx=dist>1e-6?dx/dist:centreDist>1e-6?centreX/centreDist:Math.cos(a.heading);
  const nz=dist>1e-6?dz/dist:centreDist>1e-6?centreZ/centreDist:-Math.sin(a.heading);
  const push=(radius*2-dist+.002)/2;
  a.x-=nx*push;a.z-=nz*push;b.x+=nx*push;b.z+=nz*push;
  const closing=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
  if(closing>0){
    const impulse=closing*.55;
    a.vx-=nx*impulse;a.vz-=nz*impulse;b.vx+=nx*impulse;b.vz+=nz*impulse;
    for(const car of [a,b]){car.speed=Math.hypot(car.vx,car.vz);car.forwardSpeed=Math.max(0,-car.vx*Math.sin(car.heading)-car.vz*Math.cos(car.heading));}
  }
  return true;
}
export function cornerSpeed(s,track=TRACK){
  let target=84;
  for(let look=8;look<=105;look+=12){
    const bend=Math.abs(angleDelta(track.sample(s+look+12).heading-track.sample(s+look-12).heading))/24;
    const speed=Math.sqrt(13/Math.max(.002,bend-.0035));
    target=Math.min(target,Math.sqrt(speed*speed+2*17*Math.max(0,look-12)));
  }return clamp(target,23,84);
}
export class SprintRace{
  constructor(track=TRACK,bots=true){this.track=track;this.bots=bots;this.car=new FormulaCar(track);this.difficulty='medium';this.reset();}
  reset(){
    this.car.reset(24);this.car.x+=this.car.location.nx*2.3;this.car.z+=this.car.location.nz*2.3;
    this.phase='countdown';this.countdown=3;this.time=0;this.progress=24;this.lastS=24;this.nextCheckpoint=63+this.track.length/4;this.boostLocked=false;
    this.checkpoints=0;this.finishDistance=63+this.track.length*2;this.position=4;this.energy=100;this.boosting=false;this.slipstream=0;this.cooldown=0;this.message='';this.messageTime=0;this.bestPosition=4;this.finishTime=null;
    this.rivals=[{name:'SATO',color:'#fb6947',s:48,lane:-2.3,pace:.96},{name:'MORGAN',color:'#608aff',s:40,lane:2.3,pace:.91},{name:'SILVA',color:'#ffcb57',s:32,lane:-2.3,pace:.86}].map(r=>({...r,homeLane:r.lane,targetLane:r.lane,laneVelocity:0,passTarget:null,passTimer:0,speed:0,heading:0,steer:0,yawRate:0,finished:false,finishTime:null,x:0,z:0}));
    this.rivals.forEach(r=>{r.pace=1;r.profile=RIVAL_PROFILES[r.name];});
    for(const r of this.rivals){Object.assign(r,{energy:100,boostLocked:false,boosting:false,slipstream:0,defenseLane:null,defenseUntil:0,defenseUsed:false,attackMode:null,attackUntil:0,counterUntil:0,lastPlayerGap:Infinity});this.placeRival(r);}
    if(!this.bots){this.rivals=[];this.position=1;this.bestPosition=1;}
    this.analysis=new RaceAnalysis(this);
    this.analysis.seedOpponents(this,this.rivals.map(r=>({id:r.name,progress:r.s})));
  }
  placeRival(r){
    const p=this.track.sample(r.s);r.x=p.x+p.nx*r.lane;r.z=p.z+p.nz*r.lane;r.heading=p.heading;
    r.car=new FormulaCar(this.track);r.car.reset(r.s);
    Object.assign(r.car,{x:r.x,z:r.z,heading:r.heading,speed:r.speed,vx:p.tx*r.speed,vz:p.tz*r.speed});
  }
  get lap(){return Math.min(2,Math.max(1,1+Math.floor((this.progress-63)/this.track.length)));}
  recover(){
    if(this.phase!=='racing')return;
    const time=this.car.time,travel=this.car.travel;this.car.reset(this.progress);this.car.time=time;this.car.travel=travel;this.lastS=this.car.location.s;this.time+=3;this.message='RECOVERY +3s';this.messageTime=3;
  }
  step(dt,input={}){
    if(this.phase==='finished')return;
    if(this.phase==='countdown'){this.countdown-=dt;if(this.countdown<=0){this.phase='racing';this.message='GO!';this.messageTime=1.4;}return;}
    this.time+=dt;this.messageTime=Math.max(0,this.messageTime-dt);this.cooldown=Math.max(0,this.cooldown-dt);
    const p=this.track.nearest(this.car.x,this.car.z),safe=cornerSpeed(p.s,this.track);
    if(this.energy<.5)this.boostLocked=true;if(this.energy>=15)this.boostLocked=false;
    this.boosting=!!input.boost&&!this.boostLocked&&this.energy>0&&this.car.speed>12&&!this.car.offTrack&&!input.brake;
    this.energy=clamp(this.energy+dt*(this.boosting?-15:input.brake?10:1),0,100);
    // Optional braking help is separate from ABS and traction control.
    const assist=input.assist===true&&this.car.speed>safe+1&&p.distance<9;
    // Slipstream: drafting close behind a rival, roughly in their line,
    // cuts aerodynamic drag — the classic F1 tow that sets up an overtake.
    const slipstream=draftingStrength({name:'@player',s:p.s,lane:p.offset},this.rivals,this.track.length);
    this.slipstream=slipstream;
    this.car.step(dt,{...input,throttle:assist?0:input.throttle,brake:assist?Math.max(Number(input.brake)||0,.65):input.brake,boost:this.boosting&&!assist,slipstream});
    const current=this.track.nearest(this.car.x,this.car.z);let delta=current.s-this.lastS;
    if(delta>this.track.length/2)delta-=this.track.length;if(delta<-this.track.length/2)delta+=this.track.length;
    if(Math.abs(delta)<Math.max(3,this.car.speed*dt*2)&&current.distance<15)this.progress+=delta;
    this.lastS=current.s;
    while(this.progress>=this.nextCheckpoint){this.checkpoints++;this.nextCheckpoint+=this.track.length/4;}
    const level=RACE_DIFFICULTIES[this.difficulty]??RACE_DIFFICULTIES.medium;
    const intentActors=this.rivals.map(r=>({name:r.name,s:r.s,lane:r.lane,speed:r.speed,finished:r.finished}));
    if(current.distance<9)intentActors.push({name:'@player',s:this.progress,lane:current.offset,speed:Math.max(0,this.car.vx*current.tx+this.car.vz*current.tz)});
    for(const r of this.rivals){
      const racingLine=this.track===TRACK;
      r.pushPace=!!level.pushPace&&racingLine;
      r.intent=r.pushPace?rivalIntent(r,intentActors,this.track,this.time,this.finishDistance):null;
      // Difficulty changes the driver's cornering margin, never engine power.
      // Inside attacks reduce the extra anticipation margin, never the physical braking envelope.
      const profile=driverProfile(r);
      const anticipation=(r.attackMode==='late-brake'&&Math.abs(r.lane-r.targetLane)<.6?profile.attackAnticipation:profile.anticipation)*level.anticipation*(r.intent?.anticipation??1);
      const limit=r.pushPace?Math.min(rivalSpeed(r.s),rivalSpeed(r.s+r.speed*anticipation)):racingLine?Math.min(RACING_LINE.sample(r.s).safeSpeed,RACING_LINE.sample(r.s+r.speed*anticipation).safeSpeed):cornerSpeed(r.s,this.track);
      r.cruise=limit>=80?100*r.pace:limit*r.pace*level.pace;
      if(racingLine){
        // Look ahead before moving toward the corner entry. Traffic planning
        // still vetoes this route whenever another car needs the space.
        const limit=r.pushPace?4.5:4;
        r.homeLane=clamp(RACING_LINE.sample(r.s+8+r.speed*.3).offset,-limit,limit);
        if(!r.passTarget&&r.passTimer<=0&&r.defenseLane===null)r.targetLane=r.homeLane;
      }
    }
    const player=current.distance<9?{s:this.progress,lane:current.offset,speed:Math.max(0,this.car.vx*current.tx+this.car.vz*current.tz)}:null;
    const plans=planRivalTraffic(this.rivals,player,this.track);
    // Freeze positions before stepping any rival, so every driver sees the same traffic.
    const energyActors=this.rivals.map(r=>({name:r.name,s:r.s,lane:r.lane,finished:r.finished}));
    if(player)energyActors.push({...player,name:'@player'});
    for(const r of this.rivals){
      if(r.finished)continue;
      const plan=plans.get(r.name);
      r.passTimer=Math.max(0,r.passTimer-dt);
      if(plan.passing&&Math.abs(plan.lane-r.targetLane)>.1)r.passTimer=2.5;
      r.targetLane=plan.lane;r.passTarget=plan.passTarget;
      r.defenseLane=plan.defenseLane;r.defenseUntil=plan.defenseUntil;r.defenseUsed=plan.defenseUsed;
      r.attackMode=plan.attackMode;r.attackUntil=plan.attackUntil;r.counterUntil=plan.counterUntil;r.lastPlayerGap=plan.lastPlayerGap;
      const clearLine=r.pushPace&&(!plan.passTarget||plan.attackMode==='exit-drive')&&plan.defenseLane===null&&Math.abs(plan.lane-r.homeLane)<.2;
      const car=r.car,modelDriver=r.pushPace&&car.speed>15;
      const look=this.track.sample(r.s+(modelDriver?Math.max(6,car.speed*(clearLine?.8:.55)):Math.min(8+car.speed*.3,1+car.speed*.5)));
      // Counter sideways momentum while holding a traffic corridor.
      const lateralVelocity=car.vx*car.location.nx+car.vz*car.location.nz;
      const aimLane=clearLine?clamp(RACING_LINE.sample(look.s).offset,-4.5,4.5):r.pushPace?clamp(plan.lane-lateralVelocity*.3,-4.5,4.5):plan.lane;
      const targetX=look.x+look.nx*aimLane,targetZ=look.z+look.nz*aimLane;
      const error=angleDelta(Math.atan2(-(targetX-car.x),-(targetZ-car.z))-car.heading);
      const steering=modelDriver?expertSteering(car,{x:targetX,z:targetZ}):clamp(-error*6*3.5/Math.max(7,car.speed)/steeringLock(car.speed,car.offTrack),-1,1);
      // A real car must roll to steer around stopped traffic.
      let desired=plan.passing&&plan.passTarget&&plan.creepAllowed&&Math.abs(plan.lane-r.lane)>.15?Math.max(2,plan.speed):plan.speed;
      if(this.track===TRACK&&(Math.abs(plan.lane-r.homeLane)>1||r.attackMode==='exit'||r.attackMode==='late-brake')){
        const profile=driverProfile(r);
        const lookahead=r.attackMode==='late-brake'&&Math.abs(r.lane-plan.lane)<.6?profile.attackAnticipation:profile.anticipation;
        desired=Math.min(desired,laneSpeed(r.s,plan.lane,r.pushPace)*r.pace*level.pace,laneSpeed(r.s+car.speed*lookahead,plan.lane,r.pushPace)*r.pace*level.pace);
        if(r.attackMode==='exit')desired=Math.min(desired,laneSpeed(r.s+car.speed*.5,r.lane,r.pushPace)*r.pace*level.pace*.92);
      }
      // Release power when drifting toward the road edge, while the steering
      // catches up. This responds to actual motion, not a blanket pace penalty.
      const edge=car.location,lateralSpeed=car.vx*edge.nx+car.vz*edge.nz;
      // Account for sideways momentum before it reaches the verge. Faster pedal
      // response can otherwise turn an exit lane change into a late rescue.
      const recoveryLookahead=.5*clamp((Math.abs(lateralSpeed)-6)/2,0,1);
      const projectedLane=r.lane+lateralSpeed*recoveryLookahead;
      const outward=lateralSpeed*Math.sign(projectedLane);
      const edgeMargin=r.pushPace?6:5;
      if(car.speed>15&&Math.abs(projectedLane)>edgeMargin&&outward>.2)desired=Math.min(desired,car.speed-(Math.abs(projectedLane)-edgeMargin)*6);
      const speedError=desired-car.speed;
      // Small overshoots need a lift, not full braking. Pedals have their own
      // response time in FormulaCar, so leave a deadband between gas and brake.
      const brake=desired<=0?1:clamp((-speedError-(r.pushPace?.4:.6))*(r.pushPace?.5:.45),0,1);
      const throttle=brake?0:clamp((r.pushPace?.7:.5)+speedError*(r.pushPace?.8:.7),0,1);
      const previous=car.location.s,lane=r.lane;
      r.controls={steering,throttle,brake,targetSpeed:desired};
      updateRivalEnergy(r,energyActors,this.track,dt,r.controls);
      car.step(dt,r.controls);
      r.s+=trackGap(previous,car.location.s,this.track.length);
      r.lane=car.location.offset;r.laneVelocity=(r.lane-lane)/dt;
      for(const key of ['x','z','heading','speed','steer','yawRate'])r[key]=car[key];
      if(r.s>=this.finishDistance){r.finished=true;r.finishTime=this.time;}
      if(resolveCarContact(this.car,r.car)){
        const previousS=r.car.location.s;
        this.car.location=this.track.nearest(this.car.x,this.car.z);
        r.car.location=this.track.nearest(r.car.x,r.car.z);
        r.s+=trackGap(previousS,r.car.location.s,this.track.length);
        r.x=r.car.x;r.z=r.car.z;r.lane=r.car.location.offset;r.speed=r.car.speed;
        if(this.cooldown===0){this.car.impact=r.car.impact=.4;this.cooldown=.65;this.message='CONTACT';this.messageTime=.9;}
      }
    }
    const old=this.position;this.position=1+this.rivals.filter(r=>r.finished||r.s>this.progress).length;
    if(this.position<old&&this.time>3){this.message=this.position===1?'RACE LEADER':'OVERTAKE!';this.messageTime=2;}
    this.bestPosition=Math.min(this.bestPosition,this.position);
    if(this.progress>=this.finishDistance&&this.checkpoints>=8){this.phase='finished';this.finishTime=this.time;this.boosting=false;}
    this.analysis.update(this,dt);
    if(this.bots)this.analysis.updateOpponents(this,this.rivals.map(r=>({id:r.name,progress:r.s,finished:r.finished})));
  }
}
