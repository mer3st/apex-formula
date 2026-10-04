import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceAnalysis} from '../source/app/formula/race-analysis.js';
const session=()=>({progress:24,time:0,track:{length:1000},finishDistance:2063,checkpoints:0,car:{speed:0,offTrack:false}});
function move(r,a,progress,time,checkpoints=0){r.progress=progress;r.time=time;r.checkpoints=checkpoints;a.update(r,.1);}
test('times full laps from start line, interpolates crossings and includes final lap',()=>{
 const r=session(),a=new RaceAnalysis(r);
 move(r,a,102,2);assert.equal(a.lapStart,1);assert.equal(a.bestLap,null);
 move(r,a,1063,61,4);assert.deepEqual(a.lapTimes,[60]);
 move(r,a,2063,116,8);assert.deepEqual(a.lapTimes,[60,55]);assert.equal(a.bestLap,55);
});
test('reverse crossings, incomplete laps and missing checkpoints do not create lap times',()=>{
 const r=session(),a=new RaceAnalysis(r);
 move(r,a,63,1);move(r,a,60,2);move(r,a,63,3);move(r,a,700,30);
 assert.equal(a.bestLap,null);move(r,a,1063,60,3);assert.equal(a.bestLap,null);
});
test('top speed uses km/h and a continuous excursion counts once with return debounce',()=>{
 const r=session(),a=new RaceAnalysis(r);r.car.speed=80;a.update(r,.1);assert.equal(a.maxSpeed,288);
 r.car.offTrack=true;for(let i=0;i<20;i++)a.update(r,.1);assert.equal(a.offTrackExits,1);
 r.car.offTrack=false;a.update(r,.1);r.car.offTrack=true;a.update(r,.1);assert.equal(a.offTrackExits,1);
 r.car.offTrack=false;for(let i=0;i<4;i++)a.update(r,.1);
 r.car.offTrack=true;r.car.speed=20;a.update(r,.1);assert.equal(a.offTrackExits,2);assert.equal(a.maxSpeed,288);
});
test('overtakes need a clear behind-to-ahead transition and do not count overlap jitter',()=>{
 const r=session(),a=new RaceAnalysis(r),opponent={id:'bot',progress:40};a.seedOpponents(r,[opponent]);
 for(const progress of [39,41,39,42]){r.progress=progress;a.updateOpponents(r,[opponent]);}assert.equal(a.overtakes,0);
 r.progress=44;a.updateOpponents(r,[opponent]);assert.equal(a.overtakes,1);
 r.progress=43;a.updateOpponents(r,[opponent]);r.progress=45;a.updateOpponents(r,[opponent]);assert.equal(a.overtakes,1);
 r.progress=35;a.updateOpponents(r,[opponent]);r.progress=44;a.updateOpponents(r,[opponent]);assert.equal(a.overtakes,2);
});
test('initial lead, stationary gains, off-track shortcuts and finished opponents do not count',()=>{
 for(const kind of ['lead','stationary','outside','finished']){
  const r=session(),a=new RaceAnalysis(r),o={id:1,progress:kind==='lead'?10:40};a.seedOpponents(r,[o]);
  if(kind==='stationary')o.progress=10;else r.progress=45;
  if(kind==='outside')r.car.offTrack=true;if(kind==='finished')o.finished=true;
  a.updateOpponents(r,[o]);assert.equal(a.overtakes,0,kind);
 }
});
test('simultaneous passes count independently and lap wrap uses absolute race progress',()=>{
 const r=session(),a=new RaceAnalysis(r),others=[{id:1,progress:1040},{id:2,progress:1041}];r.progress=1030;a.seedOpponents(r,others);
 r.progress=1045;a.updateOpponents(r,others);assert.equal(a.overtakes,2);
});
test('recovery penalties are part of lap duration; a new session clears every stat',()=>{
 const r=session(),a=new RaceAnalysis(r);move(r,a,63,1);move(r,a,563,31);r.time+=3;a.update(r,.1);move(r,a,1063,64,4);
 assert.equal(a.bestLap,63);const fresh=new RaceAnalysis(session());
 assert.deepEqual([fresh.bestLap,fresh.maxSpeed,fresh.overtakes,fresh.offTrackExits],[null,0,0,0]);
});
