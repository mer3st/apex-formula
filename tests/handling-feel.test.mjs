import test from 'node:test';
import assert from 'node:assert/strict';
import {FormulaCar} from '../source/app/formula/physics.js';

const flat={width:14,sample:s=>({x:0,z:-s,s,heading:0,nx:1,nz:0,tx:0,tz:-1}),nearest:(x,z)=>({x,z,s:-z,heading:0,nx:1,nz:0,tx:0,tz:-1,distance:0,offset:0})};
const advance=(car,seconds,input)=>{for(let n=0;n<Math.round(seconds*120);n++)car.step(1/120,input);};
const rolling=(speed=40,track=flat)=>{const car=new FormulaCar(track);car.vz=-speed;car.speed=speed;car.gear=4;return car;};

test('fresh pedal presses respond within a short tap without an instant force step',()=>{
  const gas=rolling(),brake=rolling();
  gas.step(1/120,{throttle:1});brake.step(1/120,{brake:1});
  assert.ok(gas.throttle>0&&gas.throttle<.1);assert.ok(brake.brake>0&&brake.brake<.1);
  advance(gas,.175,{throttle:1});advance(brake,.15,{brake:1});
  assert.ok(gas.throttle>=.9,'a 180 ms gas tap must reach usable power');
  assert.ok(brake.brake>=.9,'a 160 ms brake tap must reach firm braking');
});

test('partial pedal release responds as promptly as full release',()=>{
  for(const pedal of ['throttle','brake']){
    const partial=rolling(),full=rolling();partial[pedal]=full[pedal]=.9;
    advance(partial,.075,{[pedal]:.2});advance(full,.075,{[pedal]:0});
    assert.ok(Math.abs(partial[pedal]-full[pedal])<.001,`${pedal}: partial lift must not linger`);
    advance(partial,.2,{[pedal]:.2});assert.ok(Math.abs(partial[pedal]-.2)<.001);
  }
});

test('analogue centre allows finer high-speed line corrections while retaining full lock',()=>{
  const small=rolling(55),full=rolling(55);
  advance(small,.15,{steering:.2});advance(full,.15,{steering:1});
  const ratio=small.steer/full.steer;
  assert.ok(ratio>.08&&ratio<.17,`centre/full steering ratio ${ratio}`);
  assert.ok(full.steer>.05,'full stick must still turn promptly');
});

test('crossing the asphalt edge does not instantly halve tyre grip',()=>{
  const cars=[7.49,7.51].map(distance=>rolling(35,{...flat,nearest:(x,z)=>({...flat.nearest(x,z),distance,offset:distance})}));
  for(const car of cars)advance(car,.3,{brake:.8,steering:.35});
  assert.ok(Math.abs(cars[0].speed-cars[1].speed)<.15,'tiny edge crossing must not cause a speed step');
  assert.ok(Math.abs(cars[0].lateralG-cars[1].lateralG)<.08,'grip should fade across the verge');
});

test('scrubbing the front tyres costs speed even when coasting',()=>{
  const straight=rolling(),corner=rolling();
  advance(straight,1,{steering:0});advance(corner,1,{steering:1});
  assert.ok(straight.speed>corner.speed+.3,`straight ${straight.speed}, corner ${corner.speed}`);
});

test('brake release recovers cornering grip progressively without rear snap',()=>{
  const heavy=rolling(35),trail=rolling(35);
  for(const car of [heavy,trail])advance(car,.2,{brake:.8,steering:.6});
  advance(heavy,.3,{brake:.8,steering:.6});advance(trail,.3,{brake:.15,steering:.6});
  assert.ok(Math.abs(trail.lateralG)>Math.abs(heavy.lateralG));
  assert.ok(trail.rearSlip<.18);assert.ok(heavy.rearSlip<.18);
});

test('grass launch works with partial throttle and full steering in either direction',()=>{
  const grass={...flat,nearest:(x,z)=>({...flat.nearest(x,z),distance:10,offset:10})};
  for(const steering of [-1,1]){
    const car=new FormulaCar(grass);advance(car,3,{steering,throttle:.6});
    assert.ok(car.speed>3,`runoff launch speed ${car.speed}`);
  }
});
