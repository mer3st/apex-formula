import test from 'node:test';
import assert from 'node:assert/strict';
import {createRivalSpeed,rivalSpeed,EXPERT_CORNER_FACTOR} from '../source/app/formula/rival-speed.js';
import {RACING_LINE} from '../source/app/formula/racing-line.js';

test('expert braking profile respects its calibrated corner targets and the speed ceiling',()=>{
 for(let i=0;i<RACING_LINE.points.length;i++){
  const speed=rivalSpeed(i*RACING_LINE.step),corner=RACING_LINE.points[i].cornerSpeed;
  assert.ok(speed>0&&speed<=84.00001&&speed<=corner*EXPERT_CORNER_FACTOR+.00001);
 }
 for(const s of [-123,0,50,700])assert.ok(Math.abs(rivalSpeed(s)-rivalSpeed(s+RACING_LINE.length))<1e-8);
});

test('braking for a corner beyond the start line is planned before crossing the seam',()=>{
 const line={step:20,length:80,points:[{cornerSpeed:20,length:20},{cornerSpeed:84,length:20},{cornerSpeed:84,length:20},{cornerSpeed:84,length:20}]};
 const speed=createRivalSpeed(line);
 assert.equal(speed(0),20);
 assert.ok(speed(60)<40,'last segment must already brake for the slow corner after the seam');
 assert.ok(speed(40)>speed(60),'earlier segment must allow more speed');
});
