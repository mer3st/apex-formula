import test from 'node:test';
import assert from 'node:assert/strict';
import {SprintRace} from '../source/app/formula/race.js';
import {FormulaCar} from '../source/app/formula/physics.js';
import {draftingStrength,updateRivalEnergy} from '../source/app/formula/rival-energy.js';
const track={width:14,length:10000,sample:s=>({s,x:0,z:-s,heading:0,nx:1,nz:0,tx:0,tz:-1})};
track.nearest=(x,z)=>({...track.sample(-z),offset:x,distance:Math.abs(x)});
function setup(){
 const race=new SprintRace(track);race.phase='racing';race.rivals=race.rivals.slice(0,1);
 const r=race.rivals[0];Object.assign(r,{s:100,lane:0,homeLane:0,targetLane:0,speed:40});race.placeRival(r);
 r.car.location=track.nearest(r.car.x,r.car.z);
 race.car.reset(150);race.car.vz=-40;race.car.speed=40;race.progress=150;race.lastS=150;
 return {race,r};
}
test('tow geometry excludes self, finished cars, distant and sideways traffic and wraps the seam',()=>{
 const driver={name:'bot',s:9995,lane:0};
 const actor={name:'@player',s:5,lane:0};
 assert.ok(draftingStrength(driver,[actor],track.length)>.5);
 for(const a of [{...actor,name:'bot'},{...actor,finished:true},{...actor,lane:4},{...actor,s:30},{...actor,s:9990}])
  assert.equal(draftingStrength(driver,[a],track.length),0);
});
test('bot attacks player with real boost power and pays the same energy cost',()=>{
 const {race,r}=setup(),reference=new FormulaCar(track);reference.reset(r.s);reference.vz=-40;reference.speed=40;
 race.step(1/120,{});reference.step(1/120,{throttle:r.controls.throttle,steering:r.controls.steering});
 assert.equal(r.boosting,true);assert.equal(r.energy,100-15/120);
 assert.ok(r.speed>reference.speed);
});
test('bot receives a physical tow from player or another bot',()=>{
 for(const name of ['@player','other']){
  const {r}=setup(),controls={steering:0,throttle:1,brake:0,targetSpeed:80};
  updateRivalEnergy(r,[{name,s:110,lane:0}],track,1/120,controls);
  assert.ok(controls.slipstream>.5);assert.equal(controls.boost,false);
  const reference=new FormulaCar(track);reference.reset(100);reference.vz=-40;reference.speed=40;
  r.car.step(1/120,controls);reference.step(1/120,{throttle:1});
  assert.ok(r.car.speed>reference.speed);
 }
});
test('expert driver spends real boost on a clear straight even while leading',()=>{
 const {r}=setup(),controls={steering:0,throttle:1,brake:0,targetSpeed:80};
 r.pushPace=true;updateRivalEnergy(r,[],track,1/120,controls);
 assert.equal(controls.boost,true);assert.equal(r.energy,100-15/120);
 for(const change of [{brake:.3},{steering:.7},{targetSpeed:41}]){
  const {r:expert}=setup();expert.pushPace=true;
  const input={steering:0,throttle:1,brake:0,targetSpeed:80,...change};
  updateRivalEnergy(expert,[],track,1/120,input);assert.equal(input.boost,false);
 }
 const {r:blocked}=setup();blocked.pushPace=true;
 updateRivalEnergy(blocked,[{name:'obstacle',s:110,lane:0}],track,1/120,{steering:0,throttle:1,brake:0,targetSpeed:80});
 assert.equal(blocked.boosting,false);
});
test('boost is withheld for braking, turning, runoff, blocked traffic and an empty battery',()=>{
 for(const scenario of ['brake','turn','runoff','blocked','empty','corner','alone']){
  const {r}=setup(),controls={steering:0,throttle:1,brake:0,targetSpeed:80};
  let actors=[{name:'other',s:135,lane:0}],road=track;
  if(scenario==='brake')controls.brake=.5;
  if(scenario==='turn')controls.steering=.6;
  if(scenario==='runoff')r.car.offTrack=true;
  if(scenario==='blocked')actors[0].s=110;
  if(scenario==='empty')r.energy=.1;
  if(scenario==='corner')road={...track,sample:s=>({...track.sample(s),heading:s*.01})};
  if(scenario==='alone')actors=[];
  updateRivalEnergy(r,actors,road,1/120,controls);
  assert.equal(r.boosting,false,scenario);assert.ok(r.energy>=0&&r.energy<=100);
 }
});
test('energy recharges under braking, stays locked until 15, and resets for a new race',()=>{
 const {race,r}=setup(),actors=[{name:'other',s:135,lane:0}];r.energy=0;
 for(let i=0;i<120;i++)updateRivalEnergy(r,actors,track,1/120,{steering:0,throttle:0,brake:1,targetSpeed:20});
 assert.ok(Math.abs(r.energy-10)<1e-8);assert.equal(r.boostLocked,true);
 r.energy=14;updateRivalEnergy(r,actors,track,1/120,{steering:0,throttle:1,brake:0,targetSpeed:80});
 assert.equal(r.boosting,false);
 r.energy=15;updateRivalEnergy(r,actors,track,1/120,{steering:0,throttle:1,brake:0,targetSpeed:80});
 assert.equal(r.boosting,true);
 race.reset();for(const bot of race.rivals){assert.equal(bot.energy,100);assert.equal(bot.boosting,false);assert.equal(bot.slipstream,0);}
});
