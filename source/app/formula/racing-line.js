import {TRACK} from './track.js';
import {FormulaCar,clamp} from './physics.js';

const wrap=(n,size)=>(n%size+size)%size;
const distance=(a,b)=>Math.hypot(b.x-a.x,b.z-a.z);

// Calibrate once using the actual tyre, aero, steering and stability model.
// A fixed-speed skidpad isolates sustained cornering from engine acceleration;
// only these disposable cars are constrained, never the player's vehicle.
let corneringTable;
export function corneringSpeed(curvature){
  if(!corneringTable){
    const flat={width:100,sample:s=>({x:0,z:-s,s,heading:0,nx:1,nz:0}),nearest:(x,z)=>({x,z,s:-z,heading:0,nx:1,nz:0,distance:0,offset:0})};
    corneringTable=[];
    for(let speed=8;speed<=84;speed+=4){
      const car=new FormulaCar(flat);car.vz=-speed;car.speed=speed;let turn=0;
      for(let tick=0;tick<300;tick++){
        const before=Math.atan2(-car.vx,-car.vz);
        car.step(1/120,{steering:1,throttle:.4});
        const after=Math.atan2(-car.vx,-car.vz);
        if(tick>=180)turn+=Math.abs(Math.atan2(Math.sin(after-before),Math.cos(after-before)));
        const scale=speed/car.speed;car.vx*=scale;car.vz*=scale;car.speed=speed;
      }
      corneringTable.push({speed,curvature:turn/speed});
    }
  }
  if(curvature>=corneringTable[0].curvature)return 8;
  for(let i=1;i<corneringTable.length;i++){
    const a=corneringTable[i-1],b=corneringTable[i];
    if(curvature>=b.curvature){
      const t=clamp((a.curvature-curvature)/(a.curvature-b.curvature),0,1);
      return Math.max(8,(a.speed+(b.speed-a.speed)*t)*.98);
    }
  }
  return 84;
}

// Build once, in world coordinates. Minimise bending across several length
// scales, constrained to a corridor with room for the car and its tyres.
export function createRacingLine(track=TRACK){
  const count=Math.ceil(track.length/3),step=track.length/count;
  const margin=Math.max(0,track.width/2-2.1);
  const points=Array.from({length:count},(_,i)=>({...track.sample(i*step),offset:0}));
  for(const stride of [12,8,4,2,1])for(let pass=0;pass<260;pass++){
    for(let i=0;i<count;i++){
      const p=points[i],a=points[wrap(i-2*stride,count)],b=points[wrap(i-stride,count)],c=points[wrap(i+stride,count)],d=points[wrap(i+2*stride,count)];
      const gradient=(a.x-4*b.x+6*p.x-4*c.x+d.x)*p.nx+(a.z-4*b.z+6*p.z-4*c.z+d.z)*p.nz;
      const next=clamp(p.offset-gradient*.075,-margin,margin),change=next-p.offset;
      p.x+=p.nx*change;p.z+=p.nz*change;p.offset=next;
    }
  }
  for(let i=0;i<count;i++){
    const a=points[wrap(i-2,count)],p=points[i],b=points[wrap(i+2,count)];
    const ab=distance(a,p),bc=distance(p,b),ac=distance(a,b);
    const curvature=2*Math.abs((p.x-a.x)*(b.z-p.z)-(p.z-a.z)*(b.x-p.x))/Math.max(.001,ab*bc*ac);
    p.heading=Math.atan2(-(b.x-a.x),-(b.z-a.z));
    p.curvature=curvature;
    p.cornerSpeed=corneringSpeed(curvature);
    p.speed=p.cornerSpeed;
    p.length=distance(p,points[(i+1)%count]);
  }
  // Backward braking pass includes the finish-line seam.
  for(let lap=0;lap<3;lap++){
    for(let i=count-1;i>=0;i--){const p=points[i],next=points[(i+1)%count];p.speed=Math.min(p.speed,Math.sqrt(next.speed**2+2*14*p.length));}
  }
  // Keep the braking limit distinct from the planned acceleration. Being
  // faster than an acceleration estimate is not a reason to brake on exit.
  for(const p of points)p.safeSpeed=p.speed;
  for(let lap=0;lap<3;lap++){
    for(let i=0;i<count;i++){const p=points[i],next=points[(i+1)%count];next.speed=Math.min(next.speed,Math.sqrt(p.speed**2+2*7*p.length));}
  }
  const sample=s=>{
    const u=wrap(s,track.length)/step,i=Math.floor(u),t=u-i,a=points[i],b=points[(i+1)%count];
    const headingDelta=Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading));
    return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,s:wrap(s,track.length),offset:a.offset+(b.offset-a.offset)*t,heading:a.heading+headingDelta*t,speed:a.speed+(b.speed-a.speed)*t,safeSpeed:a.safeSpeed+(b.safeSpeed-a.safeSpeed)*t};
  };
  return {points,step,length:track.length,sample};
}

// The same upcoming segment can be green for a slow car and red for a fast
// one. Project coasting to it, then compare with the braking-safe envelope.
export function guidanceDemand(line,s,speed,ahead=0){
  const target=line.sample(s+ahead).safeSpeed;
  const projected=Math.sqrt(Math.max(0,speed*speed-2*1.3*Math.max(0,ahead)));
  const ratio=projected/Math.max(1,target);
  // Yellow marks the measured limit; reserve solid red for a clear excess.
  // Small differences in line choice or sampling should not demand braking.
  return clamp((ratio-.9)/.2,0,1);
}

export const RACING_LINE=createRacingLine();
