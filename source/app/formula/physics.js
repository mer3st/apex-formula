import {TRACK} from './track.js';
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const approach=(value,target,rate,dt)=>value+clamp(target-value,-rate*dt,rate*dt);
const GEARS=[0,3.15,2.43,1.95,1.62,1.39,1.21,1.07,.96];
export function steeringLock(speed,offTrack=false){
  // A numeric surface amount blends the two tyres crossing the road edge.
  const runoff=typeof offTrack==='number'?clamp(offTrack,0,1):(offTrack?1:0);
  const grip=(1.95-1.15*runoff)*(9.81+2.9*speed*speed/800);
  return Math.min(.72/(1+speed*.025),Math.atan(3.5*grip/Math.max(64,speed*speed))+.035);
}
export class FormulaCar {
  constructor(track=TRACK){this.track=track;this.reset();}
  reset(distance=24){const p=this.track.sample(distance);Object.assign(this,{x:p.x,z:p.z,heading:p.heading,vx:0,vz:0,speed:0,forwardSpeed:0,steer:0,steeringInput:0,yawRate:0,throttle:0,brake:0,slip:0,gear:1,rpm:4000,time:0,travel:0,offTrack:false,location:p,impact:0,longAccel:0,lateralG:0,frontSlip:0,rearSlip:0,wheelspin:0,powerSlip:0,locked:false,tcActive:false,shiftTimer:0,shiftInput:0,slipstream:0});}
  recover(){this.reset(this.location.s);}
  step(dt,input={}){
    if(!(dt>0&&dt<=.05))return;
    this.time+=dt;this.impact=Math.max(0,this.impact-dt*2);this.shiftTimer=Math.max(0,this.shiftTimer-dt);
    const p=this.track.nearest(this.x,this.z);this.location=p;this.offTrack=p.distance>this.track.width/2+.5;
    const verge=clamp((p.distance-(this.track.width/2-.6))/2,0,1);
    const runoff=verge*verge*(3-2*verge);
    const mass=800,lf=1.85,lr=1.65,wheelbase=lf+lr,inertia=1350;
    const fx=-Math.sin(this.heading),fz=-Math.cos(this.heading),rx=Math.cos(this.heading),rz=-Math.sin(this.heading);
    const u=this.vx*fx+this.vz*fz,v=this.vx*rx+this.vz*rz,speed=Math.hypot(this.vx,this.vz);
    const throttleTarget=clamp(Number(input.throttle)||0,0,1),brakeTarget=clamp(Number(input.brake)||0,0,1);
    // Partial trigger release must be just as responsive as releasing fully.
    this.throttle=approach(this.throttle,throttleTarget,throttleTarget>this.throttle?2.6:6,dt);
    this.brake=approach(this.brake,brakeTarget,brakeTarget>this.brake?4:7,dt);
    const rawSteering=clamp(input.steering??((input.right?1:0)-(input.left?1:0)),-1,1);
    // Short keyboard taps make fine corrections; holding builds to full lock.
    // Analogue inputs already carry their own amount of steering travel.
    const reversing=rawSteering*this.steeringInput<0;
    const steeringRate=rawSteering===0||reversing?9:6-1.8*clamp(speed/65,0,1);
    this.steeringInput=approach(this.steeringInput??0,rawSteering,steeringRate,dt);
    const precision=.12+.18*clamp(speed/60,0,1);
    const requested=input.steering!==undefined?rawSteering*(1-precision)+rawSteering**3*precision:this.steeringInput*.8+this.steeringInput**3*.2;
    // Keyboard travel is limited by available grip, not just the steering rack.
    // Low-speed hairpins retain steering lock; fast taps cannot demand a spin.
    const maxAngle=steeringLock(speed,runoff);
    const response=18;
    this.steer+=(requested*maxAngle-this.steer)*(1-Math.exp(-dt*response));
    // Only beyond the road edge: sharp turns unload the rear on loose ground.
    // Fade in over the verge and with speed; crawling and small corrections grip.
    const looseEdge=clamp((p.distance-(this.track.width/2+.5))/.9,0,1);
    const sharpTurn=clamp((Math.abs(this.steer)/Math.max(.01,maxAngle)-.45)/.55,0,1);
    const runoffSlide=looseEdge*looseEdge*(3-2*looseEdge)*sharpTurn*clamp((speed-8)/14,0,1);
    const rawRpm=Math.max(4000,Math.abs(u)*GEARS[this.gear]*135);
    const shift=(input.shiftUp?1:0)-(input.shiftDown?1:0);
    if(this.shiftTimer===0){let next=this.gear;
      if(input.manual){if(shift&&shift!==this.shiftInput)next=clamp(this.gear+shift,1,8);}
      else if(rawRpm>11500&&this.gear<8)next++;else if(rawRpm<6900&&this.gear>1)next--;
      if(next!==this.gear){this.gear=next;this.shiftTimer=.16;}
    }this.shiftInput=shift;
    // Front/rear tyre forces share a friction budget with acceleration and braking.
    const downforce=2.9*u*u,normal=mass*9.81+downforce;
    const transfer=clamp(this.longAccel*mass*.29/wheelbase,-normal*.2,normal*.2);
    const frontLoad=normal*lr/wheelbase-transfer,rearLoad=normal*lf/wheelbase+transfer;
    const mu=1.95-1.15*runoff,frontGrip=frontLoad*mu,rearGrip=rearLoad*mu;
    const frontAngle=this.steer-Math.atan2(v-this.yawRate*lf,Math.max(6,Math.abs(u)));
    const rearAngle=-Math.atan2(v+this.yawRate*lr,Math.max(6,Math.abs(u)));
    const frontDemand=frontAngle*85000,rearDemand=rearAngle*95000;
    const power=440000+(input.boost?110000:0),torqueCurve=clamp(1-Math.abs(rawRpm-9600)/22000,.68,1);
    const limiter=rawRpm>13000?.06:1;
    let drive=Math.min(14500,power/Math.max(20,Math.abs(u)))*this.throttle*torqueCurve*limiter*(this.shiftTimer>0?.35:1);
    // Reserve rear lateral grip as soon as the front tyres request a corner,
    // rather than waiting until the rear has already broken loose.
    // Predict only the lateral force tyres can actually deliver. Raw slip-angle
    // demand at full lock otherwise starves TC of drive while crawling on grass.
    const cornerDemand=Math.max(Math.min(Math.abs(rearDemand),rearGrip),Math.min(Math.abs(frontDemand),frontGrip)*lf/lr*.9)*clamp(speed/15,0,1);
    const tractionAvailable=rearGrip*Math.sqrt(Math.max(.06,1-Math.min(.94,(cornerDemand/rearGrip)**2)));
    this.tcActive=input.tractionControl!==false&&drive>tractionAvailable;
    this.wheelspin=clamp((drive-tractionAvailable)/Math.max(1,rearGrip),0,1);
    if(input.tractionControl!==false){drive=Math.min(drive,tractionAvailable);this.wheelspin*=.1;}
    else drive=Math.min(drive,rearGrip*.96);
    // Let rear traction break and recover progressively. With TC active the
    // residual slip is small; without it, excess torque costs forward drive.
    const turning=clamp(Math.abs(this.steer)/Math.max(.01,maxAngle)*4,0,1);
    const slipTarget=clamp(this.wheelspin*2.5,0,1)*clamp((speed-6)/10,0,1)*turning;
    this.powerSlip=approach(this.powerSlip,slipTarget,slipTarget>this.powerSlip?3:2,dt);
    if(input.tractionControl===false)drive*=1-this.powerSlip*.2;
    let frontBrake=this.brake*38000*.56,rearBrake=this.brake*38000*.44;
    this.locked=input.abs===false&&speed>5&&(frontBrake>frontGrip||rearBrake>rearGrip);
    frontBrake=Math.min(frontBrake,frontGrip*(input.abs===false?1:.94));rearBrake=Math.min(rearBrake,rearGrip*(input.abs===false?1:.92));
    if(input.abs!==false){
      // ABS leaves some cornering capacity when the driver is still braking.
      // Braking in a straight line remains substantially more effective.
      const turning=clamp(Math.abs(this.steer)/Math.max(.01,maxAngle),0,1)*clamp(speed/12,0,1);
      const frontReserve=.34+turning*.33,rearReserve=.4+turning*.45;
      frontBrake=Math.min(frontBrake,frontGrip*Math.sqrt(1-frontReserve**2));
      rearBrake=Math.min(rearBrake,rearGrip*Math.sqrt(1-rearReserve**2));
    }
    const frontBudget=frontGrip*Math.sqrt(Math.max(this.locked?.02:.08,1-(frontBrake/frontGrip)**2));
    const rearLong=drive-rearBrake,rearBudget=rearGrip*Math.sqrt(Math.max(.04,1-Math.min(.96,(rearLong/rearGrip)**2)))*(1-this.wheelspin*.5);
    const rearLateralBudget=rearBudget*(1-runoffSlide*.25);
    let frontForce=frontBudget*Math.tanh(frontDemand/Math.max(1,frontBudget)),rearForce=rearLateralBudget*Math.tanh(rearDemand/Math.max(1,rearLateralBudget));
    const lowSpeed=clamp(Math.abs(u)/6,0,1);frontForce*=lowSpeed;rearForce*=lowSpeed;
    const engineBraking=(1-this.throttle)*clamp(u/20,0,1)*550;
    const slipstream=clamp(Number(input.slipstream)||0,0,1);
    this.slipstream=slipstream;
    const drag=(.63*(1-slipstream*.4))*u*Math.abs(u)+(speed>.1?140+runoff*(460+speed*60):0)+engineBraking;
    // Resolve the steered front tyre force into chassis axes: holding lock
    // scrubs speed, and opening the steering frees acceleration on corner exit.
    const steeringDrag=frontForce*Math.sin(this.steer);
    const longitudinal=(drive-frontBrake-rearBrake-drag-steeringDrag)/mass;
    this.longAccel+=(longitudinal-this.longAccel)*Math.min(1,dt*10);
    const frontLateral=frontForce*Math.cos(this.steer);
    const lateral=(frontLateral+rearForce)/mass;this.lateralG=lateral/9.81;
    const yawAccel=(-lf*frontLateral+lr*rearForce)/inertia-this.yawRate*.5;
    this.yawRate+=yawAccel*dt;
    if(input.stability!==false&&speed>5){
      // Dampen excess rotation relative to the turn supported by tyre forces.
      // No track direction or automatic throttle/brake is used here.
      const supportedYaw=-lateral/Math.max(8,Math.abs(u));
      if(Math.abs(this.yawRate)>Math.abs(supportedYaw)){
        const recovery=clamp((Math.abs(rearAngle)-.02)*65,0,16);
        const support=(1-this.powerSlip*(input.tractionControl===false?.7:.2))*(1-runoffSlide*.45);
        this.yawRate+=(supportedYaw-this.yawRate)*(1-Math.exp(-dt*(5+recovery)*support));
      }
    }
    if(speed<6){const kinematic=-Math.max(0,u)/wheelbase*Math.tan(this.steer);this.yawRate+=(kinematic-this.yawRate)*(1-lowSpeed)*Math.min(1,dt*18);}
    this.heading+=this.yawRate*dt;
    this.vx+=(fx*longitudinal+rx*lateral)*dt;this.vz+=(fz*longitudinal+rz*lateral)*dt;
    if(input.stability!==false&&speed>5){
      // Retain spin protection, but leave room to catch power oversteer with
      // throttle and countersteering. Slip room closes gradually as tyres regain
      // traction. Preserve the travel vector rather than steering onto the track.
      const travelHeading=Math.atan2(-this.vx,-this.vz);
      const slipAngle=Math.atan2(Math.sin(this.heading-travelHeading),Math.cos(this.heading-travelHeading));
      const slideRoom=this.powerSlip*(input.tractionControl===false?.13:.035)*(1-runoff*.5);
      const allowedSlip=.085+runoff*.035+slideRoom+runoffSlide*.04;
      const excess=slipAngle-clamp(slipAngle,-allowedSlip,allowedSlip);
      this.heading-=excess*(1-Math.exp(-dt*(input.tractionControl===false?32-this.powerSlip*12:32)));
      const yawLimit=(frontGrip+rearGrip)/mass/Math.max(10,speed)*.85;
      this.yawRate=clamp(this.yawRate,-yawLimit,yawLimit);
      if(rawSteering===0&&Math.abs(this.steer)<.015)this.yawRate*=Math.exp(-dt*5);
    }
    if((u>=0&&this.vx*fx+this.vz*fz<0&&this.brake>.05)||(speed<.12&&this.throttle<.02)){this.vx=this.vz=0;this.yawRate*=Math.max(0,1-dt*15);}
    // Low-speed stability prevents numerical sideways creep without steering the car for the player.
    if(speed<3){const sideways=this.vx*rx+this.vz*rz;this.vx-=rx*sideways*Math.min(1,dt*12);this.vz-=rz*sideways*Math.min(1,dt*12);}
    this.speed=Math.hypot(this.vx,this.vz);this.forwardSpeed=Math.max(0,this.vx*fx+this.vz*fz);this.x+=this.vx*dt;this.z+=this.vz*dt;this.travel+=this.speed*dt;
    this.frontSlip=Math.abs(frontAngle);this.rearSlip=Math.abs(rearAngle);this.slip=clamp(Math.max(this.frontSlip,this.rearSlip)*4+this.wheelspin,0,1);
    this.rpm=clamp(Math.max(4000,this.forwardSpeed*GEARS[this.gear]*135)+this.wheelspin*2500+this.throttle*600,4000,13000);
    const edge=this.track.nearest(this.x,this.z);this.location=edge;
    if(edge.distance>15){const side=Math.sign(edge.offset)||1;this.x=edge.x+edge.nx*side*14.7;this.z=edge.z+edge.nz*side*14.7;const outward=this.vx*edge.nx*side+this.vz*edge.nz*side;if(outward>0){this.vx-=edge.nx*side*outward*1.1;this.vz-=edge.nz*side*outward*1.1;this.vx*=.7;this.vz*=.7;this.impact=.5;}}
  }
}
export class FixedStep{
  constructor(step){this.step=step;this.accumulator=0;}
  advance(dt){this.accumulator+=Math.min(dt,.1);while(this.accumulator>=1/120){this.step(1/120);this.accumulator-=1/120;}}
  clear(){this.accumulator=0;}
}
