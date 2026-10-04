import test from 'node:test';
import assert from 'node:assert/strict';
import {SprintRace} from '../source/app/formula/race.js';

test('Medium is the default and restarting preserves Hard',()=>{
  const race=new SprintRace();assert.equal(race.difficulty,'medium');
  race.difficulty='hard';race.reset();assert.equal(race.difficulty,'hard');
});

test('Hard drives faster through skill while both modes finish on the road',()=>{
  const results={};
  for(const mode of ['medium','hard']){
    const race=new SprintRace();race.difficulty=mode;race.reset();race.phase='racing';
    let ticks=0,contacts=0,maxSpeed=0;
    while(race.rivals.some(r=>!r.finished)&&ticks++<120*300){
      const previous=race.cooldown;race.step(1/120,{});if(race.cooldown>previous)contacts++;
      for(const rival of race.rivals){
        maxSpeed=Math.max(maxSpeed,rival.speed);
        assert.ok(Number.isFinite(rival.s)&&Math.abs(rival.lane)<=7);
      }
      for(let i=0;i<race.rivals.length;i++)for(let j=i+1;j<race.rivals.length;j++){
        const a=race.rivals[i],b=race.rivals[j];
        if(!a.finished&&!b.finished)assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>3.2,`${mode} rival clearance`);
      }
    }
    assert.ok(race.rivals.every(r=>r.finished),`${mode} rivals must finish`);
    assert.equal(contacts,0,`${mode} must avoid a stationary player`);
    results[mode]={time:ticks/120,maxSpeed};
  }
  assert.ok(results.medium.time>100&&results.medium.time<180,JSON.stringify(results));
  assert.ok(results.hard.time<results.medium.time*.95,JSON.stringify(results));
  assert.ok(results.hard.time>75,'Hard must race rather than skip distance');
  assert.ok(results.hard.maxSpeed>=results.medium.maxSpeed,JSON.stringify(results));
  assert.ok(results.hard.maxSpeed<=84.001,'Hard keeps the normal top-speed ceiling');
});
