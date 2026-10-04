import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraFeel} from '../source/app/formula/camera-feel.js';
const car={heading:0,yawRate:0,speed:60,longAccel:0};

test('camera response is consistent across refresh rates and paused time stays still',()=>{
  const samples=[30,60,120,144].map(hz=>{
    const state={};cameraFeel(state,{...car,speed:0},0,{snap:true});
    for(let n=0;n<hz;n++)cameraFeel(state,car,1/hz,{boosting:true});
    const copy={...state};cameraFeel(state,{...car,heading:1},0);
    assert.deepEqual(state,copy);return state;
  });
  for(const s of samples)for(const key of Object.keys(s))assert.ok(Math.abs(s[key]-samples[0][key])<1e-8);
});

test('heading wrap takes the short turn',()=>{
  const state={};cameraFeel(state,{...car,heading:Math.PI-.01},0,{snap:true});
  cameraFeel(state,{...car,heading:-Math.PI+.01,yawRate:20},1/60);
  assert.ok(Math.abs(state.heading-Math.PI)<.02);
});

test('boost reads clearly, fades smoothly, and stays independent for two players',()=>{
  const first={},second={};cameraFeel(first,car,0,{snap:true});cameraFeel(second,car,0,{snap:true});
  for(let i=0;i<60;i++){cameraFeel(first,car,1/60,{boosting:true});cameraFeel(second,car,1/60);}
  assert.ok(first.boost>.99);assert.equal(second.boost,0);
  cameraFeel(first,car,1/60);assert.ok(first.boost>.9&&first.boost<1);
  for(let i=0;i<120;i++)cameraFeel(first,car,1/60);
  assert.ok(first.boost<.001);
});
