import test from 'node:test';
import assert from 'node:assert/strict';
import {SprintRace,angleDelta,cornerSpeed} from '../source/app/formula/race.js';
import {clamp,steeringLock} from '../source/app/formula/physics.js';

test('countdown locks movement, then releases all four drivers',()=>{
  const r=new SprintRace(),x=r.car.x,z=r.car.z;
  for(let i=0;i<300;i++)r.step(1/120,{throttle:true});
  assert.equal(r.phase,'countdown');assert.equal(r.car.x,x);assert.equal(r.car.z,z);
  for(let i=0;i<180;i++)r.step(1/120,{throttle:true});
  assert.equal(r.phase,'racing');assert.ok(r.car.speed>0);assert.ok(r.rivals.every(a=>a.speed>0));
});
test('two-lap race can be completed through driving and freezes its result',()=>{
  const r=new SprintRace();let steps=0;
  while(r.phase!=='finished'&&steps++<120*300){
    const c=r.car,p=r.track.nearest(c.x,c.z),target=r.track.sample(p.s+10+c.speed*.36);
    const error=angleDelta(Math.atan2(-(target.x-c.x),-(target.z-c.z))-c.heading);
    const steering=clamp(-error*2.5*3.5/Math.max(7,c.speed)/steeringLock(c.speed,c.offTrack),-1,1);
    const brake=c.speed>cornerSpeed(p.s)*.8;
    r.step(1/120,{throttle:!brake,brake,steering,boost:!brake&&Math.abs(error)<.1});
  }
  assert.equal(r.phase,'finished',`progress ${r.progress}, speed ${r.car.speed}`);
  assert.equal(r.lap,2);assert.ok(r.checkpoints>=8);assert.ok(r.finishTime>40);
  const time=r.finishTime;r.step(1/120,{throttle:true});assert.equal(r.finishTime,time);
});
test('recovery preserves race progress, adds a penalty and resets boost on restart',()=>{
  const r=new SprintRace();r.phase='racing';r.time=10;r.progress=500;r.energy=12;
  r.recover();assert.equal(r.progress,500);assert.equal(r.time,13);assert.equal(r.car.speed,0);
  r.reset();assert.equal(r.energy,100);assert.equal(r.phase,'countdown');assert.equal(r.position,4);
});
test('reverse travel cannot produce a lap and energy stays bounded',()=>{
  const r=new SprintRace();r.phase='racing';r.car.heading+=Math.PI;
  for(let i=0;i<600;i++)r.step(1/120,{throttle:true,boost:true});
  assert.equal(r.lap,1);assert.equal(r.checkpoints,0);assert.ok(r.energy>=0&&r.energy<=100);
});
