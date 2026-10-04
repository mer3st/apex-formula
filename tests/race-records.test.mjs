import test from 'node:test';
import assert from 'node:assert/strict';
import {updateRaceBest,formatRaceRecord} from '../source/app/formula/race-records.js';

test('completed races retain only the fastest time and separate circuits and modes',()=>{
  const values=new Map();
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  try{
    const race={phase:'finished',finishTime:108.123,track:{name:'Valle',length:2000}};
    assert.deepEqual(updateRaceBest(race,'solo-medium'),{best:108123,isNew:true,saved:true});
    assert.deepEqual(updateRaceBest({...race,finishTime:120},'solo-medium'),{best:108123,isNew:false,saved:true});
    assert.equal(updateRaceBest(race,'solo-medium').isNew,false);
    assert.equal(updateRaceBest({...race,finishTime:107},'solo-medium').best,107000);
    for(const mode of ['solo-hard','local-player-1','local-player-2'])assert.equal(updateRaceBest(race,mode).best,108123);
    assert.equal(updateRaceBest({...race,track:{name:'Other',length:2000}},'solo-medium').isNew,true);
    const count=values.size;
    for(const finishTime of [null,0,-1,NaN,Infinity])assert.equal(updateRaceBest({...race,finishTime},'solo-medium'),null);
    assert.equal(updateRaceBest({...race,phase:'racing'},'solo-medium'),null);
    assert.equal(values.size,count);
    assert.equal(formatRaceRecord(108123),'1:48.123');
    assert.equal(formatRaceRecord(60000),'1:00.000');
  }finally{delete globalThis.localStorage;}
});
test('corrupt or blocked storage does not crash or claim an unsaved record was saved',()=>{
  const race={phase:'finished',finishTime:100,track:{name:'Valle',length:2000}};
  try{
    for(const data of ['broken','null','-10','"100"','1.5']){
      globalThis.localStorage={getItem:()=>data,setItem:()=>{}};
      assert.deepEqual(updateRaceBest(race,'solo-medium'),{best:100000,isNew:true,saved:true});
    }
    globalThis.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
    assert.deepEqual(updateRaceBest(race,'solo-medium'),{best:100000,isNew:true,saved:false});
  }finally{delete globalThis.localStorage;}
});
