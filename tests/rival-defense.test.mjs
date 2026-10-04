import test from 'node:test';
import assert from 'node:assert/strict';
import {planRivalTraffic} from '../source/app/formula/rival-traffic.js';
import {SprintRace} from '../source/app/formula/race.js';
import {TRACK} from '../source/app/formula/track.js';
import {RACING_LINE} from '../source/app/formula/racing-line.js';
const road=(side=1)=>({width:14,length:2000,sample:s=>({heading:-side*Math.max(0,Math.min(1,(s-175)/70))})});
const bot=()=>({name:'A',s:100,lane:0,targetLane:0,homeLane:0,speed:30,cruise:40,passTimer:0});
const player={s:65,lane:0,speed:34};
const plan=(a,p=player,t=road(),others=[])=>planRivalTraffic([a,...others],p,t).get('A');
function apply(a,p){Object.assign(a,p,{targetLane:p.lane});}
test('approaching player prompts one early move to the inside of either bend',()=>{
 for(const side of [-1,1]){const p=plan(bot(),player,road(side));assert.equal(p.defenseLane,side*3.6);assert.equal(p.passing,false);assert.equal(p.defenseUsed,true);}
});
test('no defensive move on straights, without a threat, or too late to move',()=>{
 for(const [p,t] of [[null,road()],[{...player,s:20},road()],[{...player,s:95},road()],[{...player,speed:29},road()],[{...player,speed:60},road()],[player,{...road(),sample:s=>({heading:0})}],[player,{...road(),sample:s=>({heading:-s*.01})}]])
  assert.equal(plan(bot(),p,t).defenseLane,null);
});
test('occupied inside lane and alongside cars veto a block',()=>{
 const other={...bot(),name:'B',s:102,lane:3.6,targetLane:3.6};
 assert.equal(plan(bot(),player,road(),[other]).defenseLane,null);
 assert.equal(plan(bot(),{...player,s:101,lane:3.6}).defenseLane,null);
});
test('a committed defense does not mirror the attacker or switch sides for the next bend',()=>{
 const a=bot();apply(a,plan(a));
 const p=plan(a,{...player,lane:-3.6},road(-1));assert.equal(p.defenseLane,3.6);
 // If the move becomes unsafe, hold position and do not try a second block.
 a.lane=0;const cancel=plan(a,{...player,s:98,lane:3.6});assert.equal(cancel.lane,0);apply(a,cancel);
 assert.equal(plan(a,player).defenseLane,0);
});
test('defense expires after the corner and only rearms for a new encounter',()=>{
 const a=bot();apply(a,plan(a));a.s=a.defenseUntil;a.lane=3.6;
 let p=plan(a,{...player,s:a.s-35});assert.equal(p.defenseLane,null);assert.equal(p.lane,0);assert.equal(p.defenseUsed,true);apply(a,p);
 p=plan(a,{...player,s:a.s-100});assert.equal(p.defenseUsed,false);
});
test('player passing and restart clear defensive state',()=>{
 const a=bot();apply(a,plan(a));assert.equal(plan(a,{...player,s:120}).defenseLane,null);
 const race=new SprintRace();race.rivals[0].defenseUsed=true;race.rivals[0].defenseLane=3.6;race.reset();
 for(const r of race.rivals){assert.equal(r.defenseLane,null);assert.equal(r.defenseUsed,false);}
});
test('real circuit defense moves through car physics and stays on the road',()=>{
 const race=new SprintRace();race.phase='racing';race.rivals=race.rivals.slice(0,1);const r=race.rivals[0];
 let start=null;
 for(let s=50;s<TRACK.length;s+=10){
  const lane=RACING_LINE.sample(s).offset,a={...bot(),s,lane,homeLane:lane,targetLane:lane};
  const p=plan(a,{s:s-35,lane:0,speed:34},TRACK);
  if(p.defenseLane!==null&&Math.abs(p.lane-lane)>2){start={s,lane};break;}
 }
 assert.ok(start,'track must offer a defensive corner approach');
 Object.assign(r,start,{speed:30,homeLane:start.lane,targetLane:start.lane});race.placeRival(r);
 const line=RACING_LINE.sample(r.s);r.car.heading=line.heading;r.car.vx=-Math.sin(line.heading)*30;r.car.vz=-Math.cos(line.heading)*30;
 let defended=0,moved=0;
 for(let n=0;n<360;n++){
  const p=TRACK.sample(r.s-35);race.car.x=p.x;race.car.z=p.z;race.car.vx=p.tx*(r.speed+4);race.car.vz=p.tz*(r.speed+4);race.car.step=()=>{};race.progress=r.s-35;race.lastS=p.s;
  const previous=r.lane;race.step(1/120,{});
  if(r.defenseLane!==null)defended++;
  moved=Math.max(moved,Math.abs(r.lane-start.lane));
  assert.ok(Math.abs(r.lane-previous)<=r.speed/120+.01,'no lateral teleport');
  assert.ok(Math.abs(r.lane)<7,'defending car left the road');
  assert.equal(race.cooldown,0,'defense caused player contact');
 }
 assert.ok(defended>60,'defense must persist');assert.ok(moved>.5,'car must physically change its line');
});
