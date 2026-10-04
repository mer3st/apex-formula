import test from 'node:test';
import assert from 'node:assert/strict';
import {RACING_LINE as line,guidanceDemand} from '../source/app/formula/racing-line.js';
import {TRACK} from '../source/app/formula/track.js';
import {SprintRace,angleDelta} from '../source/app/formula/race.js';
import {clamp,steeringLock} from '../source/app/formula/physics.js';

test('racing line stays within the road with car-width clearance and wraps seamlessly',()=>{
  for(let s=0;s<TRACK.length;s+=1.5){const p=line.sample(s);assert.ok(TRACK.nearest(p.x,p.z).distance<5.1,`road clearance at ${s}`);}
  assert.deepEqual(line.sample(0),line.sample(line.length));
  const a=line.sample(-.01),b=line.sample(.01);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.1);assert.ok(Math.abs(angleDelta(a.heading-b.heading))<.02);
});

test('the optimised line uses the whole road and cuts the main apex',()=>{
  let minSide=Infinity,maxSide=-Infinity;
  for(const p of line.points){minSide=Math.min(minSide,p.offset);maxSide=Math.max(maxSide,p.offset);}
  assert.ok(minSide<-2&&maxSide>2,'the line must work both sides of the road');
  const slow=line.points.reduce((a,b)=>b.speed<a.speed?b:a,line.points[0]);
  const turn=angleDelta(TRACK.sample(slow.s+30).heading-TRACK.sample(slow.s-30).heading);
  assert.ok(Math.abs(turn)>.4,'the track must have a real corner');
  // Decreasing heading marks a right-hand bend, whose inside is the right side.
  assert.ok(slow.offset*-Math.sign(turn)>1,'the line must hug the inside of the slowest corner');
});

test('speed envelope permits braking and acceleration between every adjacent marker',()=>{
  for(let i=0;i<line.points.length;i++){
    const a=line.points[i],b=line.points[(i+1)%line.points.length];
    assert.ok(a.speed*a.speed<=b.speed*b.speed+28*a.length+.001);
    assert.ok(b.speed*b.speed<=a.speed*a.speed+14*a.length+.001);
  }
});

test('guidance changes green to yellow to red with the driver speed',()=>{
  const s=300,target=line.sample(s).safeSpeed;
  assert.equal(guidanceDemand(line,s,target*.7),0);
  assert.ok(Math.abs(guidanceDemand(line,s,target)-.5)<.01);
  assert.equal(guidanceDemand(line,s,target*1.1),1);
});

test('a safe corner exit does not turn red merely for beating the acceleration estimate',()=>{
  const p=line.points.find(p=>p.safeSpeed>p.speed*1.3);
  assert.ok(p,'track has an acceleration zone');
  assert.equal(guidanceDemand(line,p.s,p.safeSpeed*.8),0);
});

test('fast approach warns before apex while slow approach stays green',()=>{
  const slow=line.points.reduce((a,b)=>b.speed<a.speed?b:a,line.points[0]);
  const s=slow.s-40,speed=80;
  assert.ok(guidanceDemand(line,s,speed)>.8);
  assert.equal(guidanceDemand(line,s,20),0);
  assert.ok(line.sample(slow.s-60).speed>line.sample(slow.s).speed,'braking begins before the slow point');
});

for(const tractionControl of [true,false])test(`following the line can finish two laps with TC ${tractionControl?'on':'off'}`,()=>{
  const race=new SprintRace(TRACK,false);let steps=0,offRoad=0,maxDistance=0;
  while(race.phase!=='finished'&&steps++<120*350){
    const car=race.car,p=TRACK.nearest(car.x,car.z),target=line.sample(p.s+8+car.speed*.3);
    const error=angleDelta(Math.atan2(-(target.x-car.x),-(target.z-car.z))-car.heading);
    const steering=clamp(-error*3.2*3.5/Math.max(7,car.speed)/steeringLock(car.speed,car.offTrack),-1,1);
    const desired=line.sample(p.s).speed*.9,brake=car.speed>desired;
    const throttle=brake?0:tractionControl?1:Math.max(.35,1-Math.abs(steering)*.8);
    race.step(1/120,{steering,throttle,brake,tractionControl});
    maxDistance=Math.max(maxDistance,p.distance);if(p.distance>7)offRoad++;
  }
  assert.equal(race.phase,'finished',`progress ${race.progress}`);
  assert.ok(offRoad/steps<.01,`off-road fraction ${offRoad/steps}, max distance ${maxDistance}`);
});
