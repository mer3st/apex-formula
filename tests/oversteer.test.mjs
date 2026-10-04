import test from 'node:test';
import assert from 'node:assert/strict';
import {FormulaCar,FixedStep} from '../source/app/formula/physics.js';
const flat={width:14,sample:s=>({x:0,z:-s,s,heading:0,nx:1,nz:0}),nearest:(x,z)=>({x,z,s:-z,heading:0,nx:1,nz:0,distance:0,offset:0})};
const bodySlip=c=>Math.atan2(Math.sin(c.heading-Math.atan2(-c.vx,-c.vz)),Math.cos(c.heading-Math.atan2(-c.vx,-c.vz)));
function powerExit(tc,side=1){
  const car=new FormulaCar(flat);car.vz=-20;car.speed=20;car.gear=3;let peak=0;
  for(let n=0;n<180;n++){car.step(1/120,{steering:side*.65,throttle:1,tractionControl:tc});peak=Math.max(peak,Math.abs(bodySlip(car)));}
  return {car,peak};
}

test('TC off permits visible power oversteer, TC on keeps the same exit approachable',()=>{
  for(const side of [-1,1]){
    const assisted=powerExit(true,side),unassisted=powerExit(false,side);
    assert.ok(assisted.peak<.14);
    assert.ok(unassisted.peak>.14&&unassisted.peak>assisted.peak*1.6,`TC off slip ${unassisted.peak}, TC on ${assisted.peak}`);
    assert.ok(unassisted.peak<.32,'controlled oversteer must not become a snap spin');
  }
});

test('lifting and countersteering catches the rear, staying on power sustains the slide',()=>{
  for(const side of [-1,1]){
    const {car}=powerExit(false,side),wrong=new FormulaCar(flat);Object.assign(wrong,car);
    for(let n=0;n<120;n++){
      const correcting=Math.abs(bodySlip(car))>.035;
      car.step(1/120,{steering:correcting?-side*.35:0,throttle:.15,tractionControl:false});
      wrong.step(1/120,{steering:side*.65,throttle:1,tractionControl:false});
    }
    assert.ok(Math.abs(bodySlip(car))<.045,'countersteering should settle the car');
    assert.ok(Math.abs(bodySlip(wrong))>Math.abs(bodySlip(car))+.06,'driver action must matter');
    assert.ok(car.forwardSpeed>10);
  }
});

test('straight launches do not invent sideways motion when TC is off',()=>{
  const car=new FormulaCar(flat);
  for(let n=0;n<480;n++)car.step(1/120,{throttle:1,tractionControl:false});
  assert.ok(Math.abs(car.x)<1e-9);assert.ok(Math.abs(car.heading)<1e-9);
  car.reset();assert.equal(car.wheelspin,0);assert.equal(car.powerSlip,0);
});

test('sustained power sliding costs exit speed compared with gripping tyres',()=>{
  const clean=powerExit(true).car,sliding=powerExit(false).car;
  for(let n=0;n<60;n++){
    clean.step(1/120,{steering:.65,throttle:1});
    sliding.step(1/120,{steering:.65,throttle:1,tractionControl:false});
  }
  assert.ok(clean.speed>sliding.speed+.5,`clean ${clean.speed}, sliding ${sliding.speed}`);
});

test('switching TC on while sliding catches the rear without a sudden heading jump',()=>{
  const {car}=powerExit(false);let largestJump=0;
  for(let n=0;n<180;n++){
    const heading=car.heading;car.step(1/120,{steering:0,throttle:.2,tractionControl:true});
    largestJump=Math.max(largestJump,Math.abs(car.heading-heading));
  }
  assert.ok(largestJump<.04,`heading jumped ${largestJump} radians in one step`);
  assert.ok(Math.abs(bodySlip(car))<.025);
});

test('power-slide control remains deterministic across display refresh rates',()=>{
  const results=[];
  for(const hz of [30,60,120,144]){
    const car=new FormulaCar(flat);car.vz=-20;car.speed=20;
    const clock=new FixedStep(dt=>car.step(dt,{throttle:car.time<1.5?1:.2,steering:car.time<1.5?.65:0,tractionControl:false}));
    for(let n=0;n<hz*3;n++)clock.advance(1/hz);
    results.push(car);
  }
  for(const car of results){assert.ok(Math.abs(car.speed-results[0].speed)<.2);assert.ok(Math.abs(car.heading-results[0].heading)<.025);}
});
