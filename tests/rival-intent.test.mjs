import test from 'node:test';
import assert from 'node:assert/strict';
import {rivalIntent} from '../source/app/formula/rival-intent.js';
import {planRivalTraffic} from '../source/app/formula/rival-traffic.js';
import {RIVAL_PROFILES} from '../source/app/formula/rival-profiles.js';
import {SprintRace} from '../source/app/formula/race.js';

const track={length:2000,width:14,sample:()=>({heading:0})};
const bot=()=>({name:'SATO',profile:RIVAL_PROFILES.SATO,s:100,lane:0,targetLane:0,homeLane:0,speed:40,cruise:65,energy:80,pushPace:true});
const leader={name:'LEADER',s:115,lane:0,speed:40};
const intent=(r,actors=[leader],time=10,finish=4000)=>rivalIntent(r,actors,track,time,finish);

test('a charged expert prepares a pass at equal speed rather than waiting forever',()=>{
 const r=bot();r.intent=intent(r);
 assert.equal(r.intent.mode,'attack');
 const p=planRivalTraffic([r,{...leader,cruise:40,homeLane:0,targetLane:0}],null,track).get(r.name);
 assert.equal(p.passTarget,leader.name);assert.ok(Math.abs(p.lane)>=3.2);
 const pullingAway=intent(r,[{...leader,speed:45}]);assert.equal(pullingAway.mode,'hunt');
});

test('energy changes create a deliberate recharge and reattack cycle',()=>{
 const r=bot();r.energy=15;r.intent=intent(r);assert.equal(r.intent.mode,'recharge');
 r.energy=35;r.intent=intent(r);assert.equal(r.intent.mode,'recharge');assert.equal(r.intent.boostReserve,45);
 r.energy=50;r.intent=intent(r);assert.equal(r.intent.mode,'attack');assert.equal(r.intent.boostReserve,0);
});

test('a charged driver opens a corridor early at equal pace, including near a corner speed limit',()=>{
 for(const name of Object.keys(RIVAL_PROFILES)){
  const r={...bot(),name,profile:RIVAL_PROFILES[name],cruise:40};
  const target={...leader,s:130,cruise:40,homeLane:0,targetLane:0};
  r.intent=intent(r,[target]);
  const p=planRivalTraffic([r,target],null,track).get(name);
  assert.equal(p.passTarget,target.name,`${name} should prepare before the old 18 m gate`);
  assert.ok(Math.abs(p.lane-target.lane)>=3.2);
 }
});

test('an early attack still respects an occupied corridor and launch discipline',()=>{
 const r=bot(),target={...leader,s:135,cruise:40,homeLane:0,targetLane:0};
 r.intent=intent(r,[target],2);
 assert.equal(planRivalTraffic([r,target],null,track).get(r.name).passTarget,null);
 r.intent=intent(r,[target]);
 const sides=[-3.6,3.6].map((lane,i)=>({...bot(),name:`SIDE${i}`,s:101,lane,homeLane:lane,targetLane:lane}));
 assert.equal(planRivalTraffic([r,target,...sides],null,track).get(r.name).passTarget,null);
 const bend={...track,sample:s=>({heading:-Math.max(0,Math.min(1,(s-175)/70))})};
 assert.equal(planRivalTraffic([r,target],null,bend).get(r.name).passTarget,null,'a distant equal-speed target does not justify a dive into a bend');
});

test('a continuing opportunity renews commitment but a fading attack eventually rejoins',()=>{
 const r=bot(),target={...leader,s:135,cruise:40,homeLane:0,targetLane:0};
 r.intent=intent(r,[target],10);
 r.intent=intent(r,[target],20);
 Object.assign(r,{lane:3.6,targetLane:3.6,passTarget:target.name,passTimer:0,speed:38.5});
 r.intent=intent(r,[target],21);
 assert.equal(r.intent.mode,'attack');
 assert.equal(planRivalTraffic([r,target],null,track).get(r.name).passTarget,target.name);
 r.intent=intent(r,[target],24);
 assert.equal(r.intent.mode,'hunt');
 const p=planRivalTraffic([r,target],null,track).get(r.name);
 assert.equal(p.passTarget,null);assert.equal(p.lane,0);
});

test('opponent speed loss and the final sprint justify spending the remaining charge',()=>{
 const r={...bot(),energy:10};
 assert.equal(intent(r,[{...leader,speed:34}]).mode,'attack');
 assert.equal(intent(r,[leader],10,300).mode,'attack');
 assert.equal(intent(r,[leader],10,4000).mode,'recharge');
});

test('commitment has hysteresis but yields to road recovery and a lost target',()=>{
 const r=bot();r.intent=intent(r);
 assert.equal(intent(r,[{...leader,speed:41}],11).mode,'attack');
 assert.equal(intent(r,[{...leader,speed:41}],14).mode,'hunt');
 assert.equal(intent({...r,lane:6.5},[leader],11).mode,'recover');
 assert.equal(intent(r,[],11).mode,'push');
});

test('risk permission never overrides an occupied passing corridor',()=>{
 const r=bot();r.intent=intent(r);
 const beside=[-3.6,3.6].map((lane,i)=>({...bot(),name:`SIDE${i}`,lane,targetLane:lane,homeLane:lane}));
 const p=planRivalTraffic([r,...beside],{...leader,s:112,speed:10},track).get(r.name);
 assert.equal(p.lane,0);assert.equal(p.passTarget,null);assert.ok(p.speed<17);
});

test('launch, chasing, defending, lap wrap and driver styles use the actual situation',()=>{
 const r=bot();
 assert.equal(intent(r,[leader],2).mode,'launch');
 assert.equal(intent(r,[{...leader,s:190}]).mode,'hunt');
 assert.equal(intent(r,[{...leader,s:70,speed:44}]).mode,'defend');
 assert.equal(intent({...r,s:1990},[{...leader,s:15}]).mode,'attack');
 assert.equal(intent({...r,profile:RIVAL_PROFILES.MORGAN},[{...leader,s:138}]).mode,'hunt');
 assert.equal(intent(r,[{...leader,s:138}]).mode,'attack');
});

test('restart discards the previous attack and battery strategy',()=>{
 const race=new SprintRace();race.rivals[0].intent=intent(bot());race.reset();
 assert.ok(race.rivals.every(r=>!r.intent));
});

test('a close contest with a closing-speed advantage becomes a completed physical overtake',()=>{
 const race=new SprintRace();race.difficulty='hard';race.phase='racing';race.time=10;race.car.x=10000;
 race.rivals=race.rivals.slice(0,2);const [attacker,leader]=race.rivals;
 for(const [i,r] of race.rivals.entries()){
  Object.assign(r,{s:100+i*10,lane:0,targetLane:0,homeLane:0,speed:i?35:40,energy:i?10:100,boostLocked:!!i});race.placeRival(r);
 }
 let passed=false,boostTime=0;
 for(let n=0;n<120*25&&!passed;n++){
  race.step(1/120,{});if(attacker.boosting)boostTime+=1/120;
  assert.ok(Math.hypot(attacker.x-leader.x,attacker.z-leader.z)>3.2,'pass needs physical clearance');
  for(const r of race.rivals)assert.ok(Math.abs(r.lane)<=7,'pass must stay on asphalt');
  passed=attacker.s>leader.s+12;
 }
 assert.ok(passed,'attacker must clear a car that started ten metres ahead');
 assert.ok(boostTime>.5,'stored energy must contribute to the pass');
});

test('an unsuccessful attack rejoins the fast line instead of waiting in the passing lane',()=>{
 const r={...bot(),speed:30,lane:3.9,targetLane:4.5,homeLane:0,passTarget:'LEADER',passTimer:0};
 const p=planRivalTraffic([r,{...leader,s:135,speed:35,cruise:65,targetLane:0,homeLane:0}],null,track).get(r.name);
 assert.equal(p.passTarget,null);assert.equal(p.lane,0);
});
