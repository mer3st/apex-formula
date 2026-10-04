import test from 'node:test';
import assert from 'node:assert/strict';
import {expertSteering} from '../source/app/formula/rival-driver.js';
import {FormulaCar} from '../source/app/formula/physics.js';

test('model steering is bounded, mirror symmetric and does not mutate the car',()=>{
 for(const speed of [0,2,10,30,60,84])for(const yaw of [-.5,0,.5]){
  const car={x:0,z:0,heading:0,vx:2,vz:-speed,speed,yawRate:yaw,offTrack:false};
  const saved={...car};
  const a=expertSteering(car,{x:4,z:-30});
  const b=expertSteering({...car,vx:-car.vx,yawRate:-yaw},{x:-4,z:-30});
  assert.ok(Number.isFinite(a)&&Math.abs(a)<=1);
  assert.ok(Math.abs(a+b)<1e-10);
  assert.deepEqual(car,saved);
 }
});

test('model steering corrects sideways motion on a straight without inventing a turn',()=>{
 const car={x:0,z:0,heading:0,vx:0,vz:-40,speed:40,yawRate:0,offTrack:false};
 assert.equal(expertSteering(car,{x:0,z:-25}),0);
 for(const side of [-1,1]){
  const physical=new FormulaCar();Object.assign(physical,{heading:0,vx:side*5,vz:-40,speed:Math.hypot(5,40)});
  const target={x:physical.x,z:physical.z-30};
  for(let i=0;i<24;i++)physical.step(1/120,{steering:expertSteering(physical,target),throttle:.5});
  assert.ok(Math.abs(physical.vx)<5,'combined front/rear tyre forces must damp sideways travel');
 }
});
