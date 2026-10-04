import test from 'node:test';
import assert from 'node:assert/strict';
import {FormulaCar} from '../source/app/formula/physics.js';
import {SprintRace} from '../source/app/formula/race.js';
const flat={width:14,sample:s=>({x:0,z:-s,s,heading:0,nx:1,nz:0,tx:0,tz:-1}),nearest:(x,z)=>({x,z,s:-z,heading:0,nx:1,nz:0,tx:0,tz:-1,distance:0,offset:0})};
const drive=(car,seconds,input)=>{for(let i=0;i<seconds*120;i++)car.step(1/120,input);};
test('ABS prevents locking; disabling it allows lockup under full braking',()=>{
  const on=new FormulaCar(flat),off=new FormulaCar(flat);
  for(const c of [on,off]){c.vz=-35;c.speed=35;}
  drive(on,.35,{brake:true,abs:true});drive(off,.35,{brake:true,abs:false});
  assert.equal(on.locked,false);assert.equal(off.locked,true);assert.ok(on.speed<35);
});
test('traction control reduces wheelspin during launch',()=>{
  const on=new FormulaCar(flat),off=new FormulaCar(flat);drive(on,.7,{throttle:true});drive(off,.7,{throttle:true,tractionControl:false});
  assert.ok(on.tcActive);assert.ok(off.wheelspin>on.wheelspin+.1);
});
test('manual gears wait for driver input, automatic gears shift at speed',()=>{
  const manual=new FormulaCar(flat),auto=new FormulaCar(flat);
  drive(manual,7,{throttle:true,manual:true});drive(auto,7,{throttle:true});
  assert.equal(manual.gear,1);assert.ok(auto.gear>1);
  manual.step(1/120,{manual:true,shiftUp:true});assert.equal(manual.gear,2);
});
test('keyboard pedal and steering inputs ramp instead of snapping',()=>{
  const c=new FormulaCar(flat);c.step(1/120,{throttle:true,brake:true,right:true});
  assert.ok(c.throttle>0&&c.throttle<.1);assert.ok(c.brake>0&&c.brake<.1);assert.ok(c.steer>0&&c.steer<.05);
});
test('default race controls do not secretly apply the brakes',()=>{
  const r=new SprintRace();r.phase='racing';r.car.reset(350);r.lastS=350;r.progress=350;
  r.car.vx=-Math.sin(r.car.heading)*70;r.car.vz=-Math.cos(r.car.heading)*70;
  r.step(1/120,{throttle:true});assert.equal(r.car.brake,0);
});
test('keyboard cornering remains recoverable at 90, 162 and 234 km/h',()=>{
  for(const speed of [25,45,65])for(const direction of ['left','right']){
    const c=new FormulaCar(flat);c.vz=-speed;c.speed=speed;let worstSlip=0;
    for(let i=0;i<240;i++){c.step(1/120,{throttle:true,[direction]:i<90});worstSlip=Math.max(worstSlip,c.rearSlip);}
    assert.ok(worstSlip<.18,`${speed}m/s ${direction}: rear slip ${worstSlip}`);
    assert.ok(Math.abs(c.yawRate)<.025,`rotation continued after release: ${c.yawRate}`);
    assert.ok(Math.abs(c.heading)<.7,'a short steering hold must not spin the car');
    assert.ok(Math.abs(c.heading)>.2,'steering must still turn the car');
  }
});
test('rapid left-right correction with TC does not trigger a spin',()=>{
  const c=new FormulaCar(flat);c.vz=-50;c.speed=50;let maxSlip=0;
  for(let i=0;i<420;i++){c.step(1/120,{throttle:true,left:i<60,right:i>=60&&i<150});maxSlip=Math.max(maxSlip,c.rearSlip);}
  assert.ok(maxSlip<.22);assert.ok(Math.abs(c.yawRate)<.025);assert.ok(c.forwardSpeed>20);
});
test('TC still allows driving out of runoff with the steering held',()=>{
  const runoff={...flat,nearest:(x,z)=>({...flat.nearest(x,z),distance:10,offset:10})};
  const c=new FormulaCar(runoff);drive(c,3,{throttle:true,right:true});
  assert.ok(c.speed>2,'low-speed traction control must not strand the car');
});
test('short steering taps make small corrections while a hold builds cornering',()=>{
  const tap=new FormulaCar(flat),hold=new FormulaCar(flat);for(const c of [tap,hold]){c.vz=-40;c.speed=40;}
  for(let i=0;i<120;i++){tap.step(1/120,{throttle:true,right:i<12});hold.step(1/120,{throttle:true,right:i<72});}
  assert.ok(Math.abs(tap.heading)<.06);assert.ok(Math.abs(hold.heading)>.15);
  tap.reset();assert.equal(tap.steeringInput,0);
});
test('straight-line braking beats braking while demanding full cornering',()=>{
  const straight=new FormulaCar(flat),corner=new FormulaCar(flat);for(const c of [straight,corner]){c.vz=-45;c.speed=45;}
  drive(straight,1,{brake:true});drive(corner,1,{brake:true,right:true});
  assert.ok(straight.speed<corner.speed-1,'correct braking technique must retain an advantage');assert.ok(corner.rearSlip<.25);
});
test('unwinding the steering allows a stronger corner exit',()=>{
  const straight=new FormulaCar(flat),corner=new FormulaCar(flat);for(const c of [straight,corner]){c.vz=-25;c.speed=25;}
  drive(straight,1.5,{throttle:true});drive(corner,1.5,{throttle:true,right:true});assert.ok(straight.speed>corner.speed+2);
});
test('long steering mistakes, lift-off and grass transitions do not spin beginners',()=>{
  for(const speed of [20,40,65])for(const side of ['left','right'])for(const tc of [true,false]){
    let grass=false;const track={...flat,nearest:(x,z)=>({...flat.nearest(x,z),distance:grass?10:0,offset:grass?10:0})};
    const c=new FormulaCar(track);c.vz=-speed;c.speed=speed;let worst=0;
    for(let i=0;i<600;i++){
      grass=i>=180&&i<300;
      c.step(1/120,{[side]:i<360,throttle:i<120||i>=300,brake:i>=240&&i<300,tractionControl:tc});
      if(c.speed>5){const travel=Math.atan2(-c.vx,-c.vz);worst=Math.max(worst,Math.abs(Math.atan2(Math.sin(c.heading-travel),Math.cos(c.heading-travel))));}
    }
    // TC-off now intentionally allows a catchable power slide; TC-on retains
    // the original beginner limit. Neither setting should snap into a spin.
    assert.ok(worst<(tc?.19:.28),`${speed} ${side} TC ${tc}: body slip ${worst}`);
    assert.ok(Math.abs(c.yawRate)<.08,`${speed} ${side} TC ${tc}: rotation after steering release ${c.yawRate}`);
  }
});
