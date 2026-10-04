import test from 'node:test';
import assert from 'node:assert/strict';
import {planRivalTraffic,trackGap} from '../source/app/formula/rival-traffic.js';
import {SprintRace} from '../source/app/formula/race.js';
const track={width:14,length:1000};
const bot=(name,s,lane,speed=30)=>({name,s,lane,speed,cruise:40,homeLane:lane,targetLane:lane,passTimer:0,finished:false});

test('a faster rival chooses a free side to pass a slower car',()=>{
  const a=bot('A',100,0),b=bot('B',125,0,20);
  const p=planRivalTraffic([a,b],null,track).get('A');
  assert.ok(Math.abs(p.lane)>=3.2);assert.equal(p.passTarget,'B');
});

test('a car alongside prevents crossing its lane',()=>{
  const a=bot('A',100,-3.6),b=bot('B',124,-3.6,15);
  const p=planRivalTraffic([a,b],{s:101,lane:0,speed:30},track).get('A');
  assert.equal(p.lane,-3.6);
});

test('boxed-in rivals brake behind the player rather than changing into occupied lanes',()=>{
  const a=bot('A',100,0),left=bot('L',100,-3.6),right=bot('R',101,3.6);
  const p=planRivalTraffic([a,left,right],{s:112,lane:0,speed:10},track).get('A');
  assert.equal(p.lane,0);assert.ok(p.speed<17);
});

test('a passing rival holds its side until fully clear of the overtaken car',()=>{
  const a={...bot('A',100,-3.6),homeLane:0,passTarget:'B'},b=bot('B',118,0,20);
  assert.equal(planRivalTraffic([a,b],null,track).get('A').lane,-3.6);
  b.s=85;assert.equal(planRivalTraffic([a,b],null,track).get('A').lane,0);
});

test('traffic detection wraps across the lap seam',()=>{
  assert.equal(trackGap(995,5,1000),10);
  const a=bot('A',995,0),p=planRivalTraffic([a],{s:5,lane:0,speed:0},track).get('A');
  assert.ok(p.speed<4);
});

test('a fast car approaching from behind blocks a merge into its lane',()=>{
  const a={...bot('A',100,-3.6,20),homeLane:0},p=planRivalTraffic([a],{s:80,lane:0,speed:40},track).get('A');
  assert.equal(p.lane,-3.6);
});

test('planning is deterministic and independent of rival iteration order',()=>{
  const a=bot('A',100,-3.6),b=bot('B',100,3.6),c=bot('C',122,-3.6,10);
  const first=planRivalTraffic([a,b,c],null,track),second=planRivalTraffic([c,b,a],null,track);
  for(const r of [a,b,c])assert.deepEqual(first.get(r.name),second.get(r.name));
});

const straight={width:14,length:2000,sample:s=>({s,x:0,z:-s,heading:0,nx:1,nz:0,tx:0,tz:-1})};
straight.nearest=(x,z)=>({...straight.sample(-z),offset:x,distance:Math.abs(x)});
function trafficRace(){const race=new SprintRace(straight);race.phase='racing';race.car.x=12;race.car.step=()=>{};return race;}

test('an actual pass completes with gradual movement and clearance between cars',()=>{
  const race=trafficRace();race.rivals=race.rivals.slice(0,2);
  const [fast,slow]=race.rivals;
  Object.assign(fast,{s:100,lane:0,targetLane:0,homeLane:0,speed:30,pace:1});
  Object.assign(slow,{s:125,lane:0,targetLane:0,homeLane:0,speed:20,pace:.5});
  race.rivals.forEach(r=>race.placeRival(r));let closest=Infinity,changes=0;
  for(let n=0;n<1440;n++){
    const lane=fast.lane,target=fast.targetLane;race.step(1/120,{});
    closest=Math.min(closest,Math.hypot(fast.x-slow.x,fast.z-slow.z));
    assert.ok(Math.abs(fast.lane-lane)<=fast.speed/120+.0001,'lateral movement cannot exceed physical travel');
    if(Math.abs(fast.targetLane-target)>.1)changes++;
  }
  assert.ok(fast.s>slow.s+12,`pass unfinished, gap ${slow.s-fast.s}, lane ${fast.lane}`);
  assert.ok(closest>3,`clearance ${closest}`);assert.ok(changes<=4,`lane decisions oscillated ${changes} times`);
});

test('rival holds a separate lane while the player remains alongside',()=>{
  const race=trafficRace();race.rivals=race.rivals.slice(0,1);const rival=race.rivals[0];
  race.car.reset(100);race.progress=race.lastS=100;race.car.speed=30;race.car.vz=-30;
  race.car.step=dt=>{race.car.z-=30*dt;};
  Object.assign(rival,{s:100,lane:-3.6,targetLane:0,homeLane:0,speed:30});
  race.placeRival(rival);
  for(let n=0;n<360;n++){
    race.step(1/120,{});
    if(Math.abs(rival.s-race.progress)<9)assert.ok(rival.lane<-3.1,'rival merged into the player');
  }
});

test('a rival can get past a stationary car instead of getting stuck behind it',()=>{
  const race=trafficRace();race.rivals=race.rivals.slice(0,2);const [fast,stopped]=race.rivals;
  Object.assign(fast,{s:100,lane:0,targetLane:0,homeLane:0,speed:20,pace:1});
  Object.assign(stopped,{s:120,lane:0,targetLane:0,homeLane:0,speed:0,pace:0});
  race.rivals.forEach(r=>race.placeRival(r));let closest=Infinity;
  for(let n=0;n<1440;n++){race.step(1/120,{});closest=Math.min(closest,Math.hypot(fast.x-stopped.x,fast.z-stopped.z));}
  assert.ok(fast.s>stopped.s+12,`stuck behind stationary car at ${fast.s}`);
  assert.ok(closest>3,`clearance ${closest}`);
});

test('a rival already queued at low speed can choose a way around a stopped player',()=>{
  const a=bot('A',100,0,0),p=planRivalTraffic([a],{s:112,lane:0,speed:0},track).get('A');
  assert.ok(Math.abs(p.lane)>=3.2);assert.equal(p.passTarget,'@player');
});

test('a stationary obstacle leaves turning room and a stopped follower does not pin the leader',()=>{
 const front={...bot('A',100,0,0),pushPace:true,intent:{mode:'attack',attackReady:true,target:'@player'}};
 const rear={...bot('B',92,0,0),pushPace:true,intent:{mode:'attack',attackReady:true,target:'A'}};
 const plans=planRivalTraffic([rear,front],{s:114,lane:2.3,speed:0},track);
 assert.equal(plans.get('A').passTarget,'@player');
 assert.equal(plans.get('A').speed,0,'stopped traffic must leave room for steering before accelerating');
 assert.equal(plans.get('B').creepAllowed,false,'the follower waits for the front car to escape');
});
