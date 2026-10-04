import test from 'node:test';
import assert from 'node:assert/strict';
import {FormulaCar,FixedStep} from '../source/app/formula/physics.js';

const flat={width:14,sample:s=>({x:0,z:-s,s,heading:0,nx:1,nz:0}),nearest:(x,z)=>({x,z,s:-z,heading:0,nx:1,nz:0,distance:0,offset:0})};
const surface=distance=>({...flat,nearest:(x,z)=>({...flat.nearest(x,z),distance,offset:distance})});
const bodySlip=car=>Math.abs(Math.atan2(Math.sin(car.heading-Math.atan2(-car.vx,-car.vz)),Math.cos(car.heading-Math.atan2(-car.vx,-car.vz))));
const rolling=(distance,speed=35)=>{const car=new FormulaCar(surface(distance));car.vz=-speed;car.speed=speed;car.gear=4;return car;};
const advance=(car,seconds,input)=>{for(let n=0;n<Math.round(seconds*120);n++)car.step(1/120,input);};

test('sharp coasting turns on loose ground allow a small rear slide in both directions with TC on',()=>{
  for(const steering of [-1,1]){
    const sharp=rolling(10),gentle=rolling(10);
    advance(sharp,1,{steering});advance(gentle,1,{steering:steering*.2});
    assert.ok(bodySlip(sharp)>.04,'rear should step out even without wheelspin');
    assert.ok(bodySlip(sharp)>bodySlip(gentle)*3);
    assert.ok(bodySlip(sharp)<.17,'slide must remain catchable');
    assert.equal(sharp.offTrack,true);
  }
});

test('unwinding steering settles the loose-ground slide without a snap',()=>{
  for(const steering of [-1,1]){
    const car=rolling(10);advance(car,1,{steering});let jump=0;
    for(let n=0;n<180;n++){const heading=car.heading;car.step(1/120,{steering:0,throttle:.2});jump=Math.max(jump,Math.abs(car.heading-heading));}
    assert.ok(bodySlip(car)<.01);assert.ok(Math.abs(car.yawRate)<.025);
    assert.ok(jump<.025);assert.ok(car.forwardSpeed>15);
  }
});

test('extra rear sliding fades smoothly beyond the edge',()=>{
  const a=rolling(7.49),b=rolling(7.51);
  for(const car of [a,b])advance(car,.3,{steering:1,brake:.3});
  assert.ok(Math.abs(bodySlip(a)-bodySlip(b))<.003);
  assert.ok(Math.abs(a.yawRate-b.yawRate)<.01,'a 2 cm crossing must not cause a rotation step');
});

test('straight runoff driving does not invent yaw or lateral movement',()=>{
  for(const speed of [0,20,65]){
    const car=rolling(10,speed);advance(car,3,{throttle:.6});
    assert.equal(car.x,0);assert.equal(car.heading,0);assert.equal(car.yawRate,0);
  }
});

test('low-speed grass manoeuvres retain enough traction to recover',()=>{
  for(const steering of [-1,1]){
    const car=rolling(10,0);advance(car,3,{steering,throttle:.6});
    assert.ok(car.speed>3);assert.ok(Number.isFinite(car.heading));
  }
});

test('runoff rear-slide recovery is consistent across display refresh rates',()=>{
  const cars=[];
  for(const hz of [30,60,120,144]){
    const car=rolling(10);
    const clock=new FixedStep(dt=>car.step(dt,{steering:car.time<1?1:0,throttle:.2}));
    for(let n=0;n<hz*3;n++)clock.advance(1/hz);
    cars.push(car);
  }
  for(const car of cars){assert.ok(Math.abs(car.speed-cars[0].speed)<.2);assert.ok(Math.abs(car.heading-cars[0].heading)<.025);}
});
