import test from 'node:test';
import assert from 'node:assert/strict';
import {SprintRace,resolveCarContact} from '../source/app/formula/race.js';
import {LocalRace} from '../source/app/formula/local-race.js';

const car=(x,z,heading=0)=>({x,z,heading,vx:0,vz:0,speed:0,forwardSpeed:0});

test('front wing cannot enter the next car cockpit',()=>{
  const a=car(0,0),b=car(0,-3);
  assert.equal(resolveCarContact(a,b),true);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=5.4);
  assert.equal(resolveCarContact(a,b),false);
});

test('side-by-side cars keep their tyres apart without blocking a clear pass',()=>{
  const a=car(0,0),b=car(2.2,-.3);
  assert.equal(resolveCarContact(a,b),true);
  assert.ok(Math.abs(a.x-b.x)>=2.5);
  assert.equal(resolveCarContact(a,b),false);
  assert.equal(resolveCarContact(car(0,0),car(4,0)),false);
  assert.equal(resolveCarContact(car(0,0),car(0,-6)),false);
});

test('rotated cars separate even when their centres are outside the old contact radius',()=>{
  const a=car(0,0,Math.PI/4),b=car(2.5,-2,0);
  assert.equal(resolveCarContact(a,b),true);
  assert.equal(resolveCarContact(a,b),false);
});

test('single-player race still separates a rival during contact cooldown',()=>{
  const race=new SprintRace();race.phase='racing';race.rivals=race.rivals.slice(0,1);
  const rival=race.rivals[0];
  Object.assign(rival.car,{x:race.car.x,z:race.car.z,heading:race.car.heading});
  rival.car.location=race.track.nearest(rival.car.x,rival.car.z);
  Object.assign(rival,{x:rival.car.x,z:rival.car.z,s:race.progress,lane:rival.car.location.offset});
  race.car.step=()=>{};rival.car.step=()=>{};race.cooldown=.5;
  race.step(1/120,{});
  assert.equal(resolveCarContact(race.car,rival.car),false);
  assert.equal(rival.x,rival.car.x);assert.equal(rival.z,rival.car.z);
  assert.ok(race.cooldown>0&&race.cooldown<.5);
});

test('split-screen players cannot overlap their cockpits during cooldown',()=>{
  const race=new LocalRace();race.phase='racing';race.players.forEach(r=>{r.phase='racing';r.car.step=()=>{};});
  const [a,b]=race.players.map(r=>r.car);
  b.x=a.x;b.z=a.z;b.heading=a.heading;race.collisionCooldown=.3;
  race.step(1/120,[{},{}]);
  assert.equal(resolveCarContact(a,b),false);
  assert.ok(race.collisionCooldown>0&&race.collisionCooldown<.3);
});
