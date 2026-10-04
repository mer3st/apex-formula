import test from 'node:test';
import assert from 'node:assert/strict';
import {SprintRace,angleDelta} from '../source/app/formula/race.js';
import {TRACK} from '../source/app/formula/track.js';
import {RACING_LINE} from '../source/app/formula/racing-line.js';
import {clamp,steeringLock} from '../source/app/formula/physics.js';
import {trackGap} from '../source/app/formula/rival-traffic.js';

const DT=1/120,MAX_TICKS=120*180;
function referenceInput(car,factor,boost,traffic=[]){
 const p=car.location,target=RACING_LINE.sample(p.s+8+car.speed*.3);
 const error=angleDelta(Math.atan2(-(target.x-car.x),-(target.z-car.z))-car.heading);
 const steering=clamp(-error*3.2*3.5/Math.max(7,car.speed)/steeringLock(car.speed,car.offTrack),-1,1);
 let desired=RACING_LINE.sample(p.s).speed*factor;
 // A traffic driver must yield before driving its ideal line through a car.
 // Clean pace is measured separately without this collision-avoidance policy.
 for(const rival of traffic){
  const gap=trackGap(p.s,rival.s,TRACK.length);
  const line=RACING_LINE.sample(p.s+Math.max(0,gap));
  if(!rival.finished&&gap>0&&gap<65&&(Math.abs(rival.lane-p.offset)<3.5||Math.abs(rival.lane-line.offset)<3.5))
   desired=Math.min(desired,Math.max(0,rival.speed+(gap-10)/1.3));
 }
 const brake=car.speed>desired;
 return {steering,throttle:brake?0:1,brake,tractionControl:true,
  boost:boost&&!brake&&Math.abs(steering)<.2&&desired>car.speed+2};
}
function referenceRace(bots,factor,boost,avoidTraffic=false){
 const race=new SprintRace(TRACK,bots);race.difficulty='hard';race.reset();
 let contacts=0,boostSeconds=0;
 for(let n=0;n<MAX_TICKS&&race.phase!=='finished';n++){
  const cooldown=race.cooldown;race.step(DT,referenceInput(race.car,factor,boost,avoidTraffic?race.rivals:[]));
  if(race.cooldown>cooldown)contacts++;
  if(race.boosting)boostSeconds+=DT;
  assert.ok(TRACK.nearest(race.car.x,race.car.z).distance<=7,'reference driver must stay on asphalt');
  for(const r of race.rivals)assert.ok(Number.isFinite(r.s)&&Math.abs(r.lane)<=7,`${r.name} left the road`);
 }
 assert.equal(race.phase,'finished','reference timed out');
 assert.equal(contacts,0,'contact must not slow the reference and make the bots look faster');
 return {race,boostSeconds};
}

test('boosted clean reference is faster than the old conservative baseline',()=>{
 const conservative=referenceRace(false,.9,false),fast=referenceRace(false,.95,true);
 assert.ok(fast.boostSeconds>.1,'boost must actually be used');
 assert.ok(fast.race.finishTime<conservative.race.finishTime*.97,'reference must be meaningfully faster');
 // Reject a future regression that slows both references and masks weak AI.
 assert.ok(fast.race.finishTime<120,'clean reference pace regressed');
 console.log(`Clean references: old ${conservative.race.finishTime.toFixed(2)}s; boosted ${fast.race.finishTime.toFixed(2)}s`);
});

test('every Hard personality beats a full-pace boosted reference by at least 5% from the same start',()=>{
 const {race:reference}=referenceRace(false,1,true),times=[];
 assert.ok(reference.finishTime<116,'expert reference must actually be faster than the old 95% benchmark');
 for(const name of ['SATO','MORGAN','SILVA']){
  const race=new SprintRace();race.difficulty='hard';race.reset();race.phase='racing';
  race.car.x=10000; // No traffic: measure driving skill independently.
  const r=race.rivals.find(r=>r.name===name);race.rivals=[r];
  Object.assign(r,{s:24,lane:2.3,homeLane:2.3,targetLane:2.3});race.placeRival(r);
  assert.equal(r.speed,0);assert.equal(r.energy,100);assert.equal(race.finishDistance,reference.finishDistance);
  for(let n=0;n<MAX_TICKS&&!r.finished;n++){
   race.step(DT,{});
   assert.ok(Number.isFinite(r.s)&&Math.abs(r.lane)<=7,`${name} must earn pace on asphalt`);
  }
  assert.equal(r.finished,true,`${name} must actually finish`);
  assert.ok(r.finishTime<=103,`${name} must beat the user's 108s by at least five seconds; got ${r.finishTime.toFixed(2)}s`);
  assert.ok(r.finishTime<=reference.finishTime*.95,`${name}: ${r.finishTime.toFixed(2)}s vs ${reference.finishTime.toFixed(2)}s; needs >=5% advantage`);
  times.push(`${name} ${r.finishTime.toFixed(2)}s`);
 }
 console.log(`Equal-start Hard times: ${times.join(', ')}; boosted reference ${reference.finishTime.toFixed(2)}s`);
});

test('Hard racecraft stays on the road against a boosted traffic-aware player',()=>{
 const {race:clean}=referenceRace(false,.95,true);
 const {race}=referenceRace(true,.95,true,true);
 assert.ok(race.rivals.some(r=>r.finished&&r.finishTime<clean.finishTime*.94),'Hard winner must beat the clean faster reference by at least 6%');
 console.log(`Boosted traffic: player ${race.finishTime.toFixed(2)}s; rivals ${race.rivals.map(r=>r.finishTime?.toFixed(2)||'unfinished').join('/')}`);
});

test('Hard traffic race wins decisively and no rival trails by more than 2% distance',()=>{
 const {race}=referenceRace(true,.9,false);
 assert.ok(race.rivals.some(r=>r.finished&&r.finishTime<=race.finishTime*.95),'at least one rival must finish >=5% before the reference');
 for(const r of race.rivals)assert.ok(r.s>=race.finishDistance*.98,`${r.name} trails by ${(100*(1-r.s/race.finishDistance)).toFixed(2)}%; maximum is 2%`);
 console.log(`Traffic race: reference ${race.finishTime.toFixed(2)}s; Hard progress ${race.rivals.map(r=>(100*r.s/race.finishDistance).toFixed(2)).join('/')}%`);
});
