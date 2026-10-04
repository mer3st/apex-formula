import test from 'node:test';
import assert from 'node:assert/strict';
import {planRivalTraffic} from '../source/app/formula/rival-traffic.js';
import {SprintRace,RACE_DIFFICULTIES} from '../source/app/formula/race.js';
import {TRACK} from '../source/app/formula/track.js';
import {RACING_LINE} from '../source/app/formula/racing-line.js';
const track={length:2000,width:14,sample:s=>({heading:-Math.max(0,Math.min(1,(s-175)/70))})};
const bot=(lane=0)=>({name:'A',s:100,lane,homeLane:lane,targetLane:lane,speed:30,cruise:40});
const get=(a,p,t=track)=>planRivalTraffic([a],p,t).get('A');

test('expert waits behind a pulling-away car and attacks once it is closing',()=>{
 const road={...track,sample:()=>({heading:0})};
 const a={...bot(),pushPace:true,cruise:65};
 assert.equal(get(a,{s:125,lane:0,speed:35},road).passTarget,null);
 assert.equal(get({...a,speed:38},{s:125,lane:0,speed:35},road).passTarget,'@player');
 assert.equal(get({...a,speed:0},{s:125,lane:0,speed:0,player:true},road).passTarget,'@player');
});
test('inside attack is chosen before a bend and mirrored for a left turn',()=>{
 for(const side of [1,-1]){
  const road={...track,sample:s=>({heading:track.sample(s).heading*side})};
  const p=get(bot(),{s:125,lane:0,speed:25},road);
  assert.equal(p.attackMode,'late-brake');assert.ok(p.lane*side>3.2);
 }
});
test('defended inside creates an outside exit plan that unwinds only when clear',()=>{
 const a=bot(3),p=get(a,{s:125,lane:3.5,speed:25});
 assert.equal(p.attackMode,'exit');assert.ok(p.lane<0);
 Object.assign(a,p,{targetLane:p.lane,s:p.attackUntil,homeLane:3.5});
 const alongside=get(a,{s:a.s+1,lane:3.5,speed:25});assert.equal(alongside.attackMode,'exit');assert.ok(alongside.lane<0);
 const clear=get(a,{s:a.s+30,lane:-3.6,speed:25});assert.equal(clear.attackMode,'exit-drive');assert.equal(clear.lane,3.5);
});
test('corridors adapt to opponent offset rather than a fixed three-lane grid',()=>{
 const p=get(bot(1),{s:125,lane:1,speed:20},{...track,sample:s=>({heading:0})});
 assert.ok(Math.abs(p.lane-1)>=3.2);assert.ok(![-3.6,0,3.6].includes(p.lane));
});
test('being overtaken arms a bounded counterattack at near equal pace',()=>{
 const a={...bot(),lastPlayerGap:-1,cruise:30};
 let p=get(a,{s:104,lane:0,speed:30});assert.equal(p.counterattack,true);
 Object.assign(a,p,{lane:0,targetLane:0});
 p=get(a,{s:125,lane:0,speed:30});assert.equal(p.passTarget,'@player');
 assert.equal(get({...bot(),cruise:30},{s:125,lane:0,speed:30}).passTarget,null);
 assert.equal(get(a,{s:180,lane:0,speed:30}).counterattack,false);
});
test('inside braking uses less anticipation but stays inside the original speed envelope',()=>{
 let advantage=0;
 for(let s=100;s<TRACK.length/2;s+=20){
  const speeds=[];
  for(const attackMode of [null,'late-brake']){
   const race=new SprintRace();race.phase='racing';race.car.x=10000;race.rivals=race.rivals.slice(0,1);
   const r=race.rivals[0],line=RACING_LINE.sample(s);
   Object.assign(r,{s,lane:line.offset,targetLane:line.offset,homeLane:line.offset,speed:30,attackMode});race.placeRival(r);
   race.step(1/120,{});speeds.push(r.cruise);
   if(line.safeSpeed<80)assert.ok(r.cruise<=line.safeSpeed*RACE_DIFFICULTIES.medium.pace+1e-8);
  }
  advantage=Math.max(advantage,speeds[1]-speeds[0]);
 }
 assert.ok(advantage>.1,'late braking must change the driving speed target');
});
