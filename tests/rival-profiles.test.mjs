import test from 'node:test';
import assert from 'node:assert/strict';
import {SprintRace} from '../source/app/formula/race.js';
import {RIVAL_PROFILES} from '../source/app/formula/rival-profiles.js';
import {planRivalTraffic} from '../source/app/formula/rival-traffic.js';
import {updateRivalEnergy} from '../source/app/formula/rival-energy.js';
const track={length:2000,width:14,sample:s=>({heading:-Math.max(0,Math.min(1,(s-175)/70))})};
const driver=name=>({name,profile:RIVAL_PROFILES[name],s:100,lane:0,homeLane:0,targetLane:0,speed:30,cruise:40});
const plan=(name,player)=>planRivalTraffic([driver(name)],player,track).get(name);
test('same bend and traffic produce distinct braking and exit choices',()=>{
 const player={s:130,lane:0,speed:25};
 assert.equal(plan('SATO',player).attackMode,'late-brake');
 assert.equal(plan('MORGAN',player).attackMode,'exit');
 assert.equal(plan('SILVA',player).attackMode,'exit');
 assert.equal(plan('SILVA',{...player,s:124}).attackMode,'late-brake');
});
test('Sato defends earlier while Morgan waits for a closer threat',()=>{
 const player={s:45,lane:0,speed:34};
 assert.notEqual(plan('SATO',player).defenseLane,null);
 assert.equal(plan('MORGAN',player).defenseLane,null);
 for(const name of Object.keys(RIVAL_PROFILES))assert.equal(plan(name,{...player,s:101,lane:3.6}).defenseLane,null);
});
test('Silva saves charge between attempts then spends it on a close opportunity',()=>{
 const straight={...track,sample:s=>({heading:0})};
 function boost(name,gap,energy=30){
  const r={...driver(name),energy,car:{speed:40,brake:0,offTrack:false,location:{distance:0}}};
  const controls={steering:0,throttle:1,brake:0,targetSpeed:80};
  updateRivalEnergy(r,[{name:'@player',s:r.s+gap,lane:4}],straight,1/120,controls);
  return r;
 }
 assert.equal(boost('SATO',50).boosting,true);
 assert.equal(boost('MORGAN',50).boosting,false);
 assert.equal(boost('MORGAN',30).boosting,true);
 assert.equal(boost('SILVA',30).boosting,false);
 const close=boost('SILVA',20);assert.equal(close.boosting,true);assert.equal(close.energy,30-15/120);
});
test('personality survives difficulty changes and restart without fixed pace ranking',()=>{
 const race=new SprintRace();
 for(const mode of ['medium','hard']){
  race.difficulty=mode;race.reset();
  for(const r of race.rivals){assert.equal(r.profile,RIVAL_PROFILES[r.name]);assert.equal(r.pace,1);assert.equal(r.energy,100);}
 }
});
test('counterattack patience differs without relaxing collision safety',()=>{
 const until=[];
 for(const name of Object.keys(RIVAL_PROFILES)){
  const a={...driver(name),lastPlayerGap:-1};
  const p=planRivalTraffic([a],{s:104,lane:3.6,speed:32},track).get(name);
  until.push(p.counterUntil);assert.equal(p.lane,0);
 }
 assert.ok(until[0]<until[1]&&until[1]<until[2]);
});
