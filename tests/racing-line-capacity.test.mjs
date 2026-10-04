import test from 'node:test';
import assert from 'node:assert/strict';
import {FormulaCar,clamp,steeringLock} from '../source/app/formula/physics.js';
import {createRacingLine,guidanceDemand} from '../source/app/formula/racing-line.js';
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));

function circle(radius){
  const length=2*Math.PI*radius;
  const sample=s=>{s=(s%length+length)%length;const t=s/radius;return {s,x:radius*(1-Math.cos(t)),z:-radius*Math.sin(t),heading:-t,nx:Math.cos(t),nz:Math.sin(t)};};
  return {length,width:14,sample,nearest:(x,z)=>{
    const p=sample(Math.atan2(-z,radius-x)*radius),offset=radius-Math.hypot(x-radius,z);
    return {...p,offset,distance:Math.abs(offset)};
  }};
}

for(const [radius,speed] of [[30,22],[60,32],[100,43]]){
  test(`no false red on a physically driveable ${radius}m bend at ${speed*3.6}km/h`,()=>{
    const track=circle(radius),line=createRacingLine(track),car=new FormulaCar(track),start=line.sample(0);
    Object.assign(car,{x:start.x,z:start.z,heading:start.heading,vx:-Math.sin(start.heading)*speed,vz:-Math.cos(start.heading)*speed,speed,gear:4});
    let red=0,lowest=speed,furthest=0,maxRatio=0;
    for(let n=0;n<720;n++){
      const p=track.nearest(car.x,car.z),aim=line.sample(p.s+8+car.speed*.3);
      const error=angle(Math.atan2(-(aim.x-car.x),-(aim.z-car.z))-car.heading);
      const steering=clamp(-error*3.2*3.5/Math.max(7,car.speed)/steeringLock(car.speed),-1,1);
      car.step(1/120,{steering,throttle:clamp(.35+(speed-car.speed)*.5,0,1)});
      lowest=Math.min(lowest,car.speed);furthest=Math.max(furthest,p.distance);
      maxRatio=Math.max(maxRatio,car.speed/line.sample(p.s).safeSpeed);
      if(n>120&&guidanceDemand(line,p.s,car.speed)>.8)red++;
    }
    assert.ok(furthest<6.5,`car must stay on asphalt, offset ${furthest}`);
    assert.ok(lowest>speed*.94,`must actually maintain entry speed: ${lowest}`);
    assert.equal(red,0,`false braking alerts in ${red} physically driveable steps; max limit ratio ${maxRatio}`);
  });
}

test('a genuinely excessive speed still warns on a tight bend',()=>{
  const track=circle(30),line=createRacingLine(track),car=new FormulaCar(track);
  car.reset(0);car.vz=-38;car.speed=38;car.gear=4;let furthest=0;
  for(let tick=0;tick<240;tick++){car.step(1/120,{steering:1,throttle:1});furthest=Math.max(furthest,car.location.distance);}
  assert.ok(furthest>7,'this excessive speed must actually carry the car off the road');
  assert.equal(guidanceDemand(line,30,38),1);
});
