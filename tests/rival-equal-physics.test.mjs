import test from 'node:test';
import assert from 'node:assert/strict';
import {SprintRace} from '../source/app/formula/race.js';
import {FormulaCar} from '../source/app/formula/physics.js';
import {RACING_LINE} from '../source/app/formula/racing-line.js';
const track={width:14,length:100000,sample:s=>({s,x:0,z:-s,heading:0,nx:1,nz:0,tx:0,tz:-1})};
track.nearest=(x,z)=>({...track.sample(-z),offset:x,distance:Math.abs(x)});
test('a rival lifts before sideways momentum carries it across the road edge',()=>{
 const race=new SprintRace(track);race.phase='racing';race.car.x=10000;
 race.rivals=race.rivals.slice(0,1);const r=race.rivals[0];
 Object.assign(r,{lane:3,homeLane:3,targetLane:3,speed:Math.hypot(8,40)});race.placeRival(r);
 r.car.vx=8;r.car.vz=-40;r.car.location=track.nearest(r.car.x,r.car.z);
 race.step(1/120,{});
 assert.ok(r.lane<5,'braking should start while there is still recovery room');
 assert.equal(r.controls.throttle,0);assert.ok(r.controls.brake>.1);
});
for(const difficulty of ['medium','hard'])test(`${difficulty}: unassisted straight launch matches the player's engine and gearbox`,()=>{
 const race=new SprintRace(track);race.difficulty=difficulty;race.reset();race.phase='racing';
 race.rivals=race.rivals.slice(0,1);const rival=race.rivals[0];
 const reference=new FormulaCar(track);reference.reset(rival.s);
 for(let n=0;n<120*40;n++){
  race.step(1/120,{});reference.step(1/120,{throttle:1});
  assert.ok(Math.abs(rival.speed-reference.speed)<1e-8,`at ${n/120}s: bot ${rival.speed}, player ${reference.speed}`);
 }
});

test('a clear corner exit gets full throttle even above the guidance acceleration estimate',()=>{
 const race=new SprintRace();race.phase='racing';race.rivals=race.rivals.slice(0,1);
 const rival=race.rivals[0],p=RACING_LINE.sample(150),speed=p.speed+3;
 Object.assign(rival,{s:150,lane:p.offset,speed});race.placeRival(rival);
 Object.assign(rival.car,{x:p.x,z:p.z,heading:p.heading,vx:-Math.sin(p.heading)*speed,vz:-Math.cos(p.heading)*speed});
 race.step(1/120,{});
 assert.equal(rival.controls.throttle,1);
 assert.equal(rival.controls.brake,0);
});

test('a small target-speed overshoot does not trigger full braking',()=>{
 const race=new SprintRace(track);race.phase='racing';race.rivals=race.rivals.slice(0,1);
 const rival=race.rivals[0];Object.assign(rival,{speed:100.8});race.placeRival(rival);
 race.step(1/120,{});
 assert.ok(rival.controls.brake<.2);
 assert.equal(rival.controls.throttle,0);
});
