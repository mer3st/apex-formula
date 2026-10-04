import {SprintRace,resolveCarContact} from './race.js';
import {TRACK} from './track.js';

// The two drivers share simulation ticks, never input or race progress.
export function splitInputs(keyboard,gamepad){
  const first={...keyboard};delete first.steering;
  const second=gamepad.connected?{
    steering:gamepad.steering,throttle:gamepad.throttle,brake:gamepad.brake,
    boost:gamepad.boost,shiftUp:gamepad.shiftUp,shiftDown:gamepad.shiftDown,
  }:{steering:0,throttle:0,brake:0,boost:false,shiftUp:false,shiftDown:false};
  return [first,second];
}

export class LocalRace{
  constructor(track=TRACK){
    this.players=[new SprintRace(track,false),new SprintRace(track,false)];
    this.reset();
  }
  reset(){
    this.phase='countdown';this.elapsed=0;this.collisionCooldown=0;
    this.players.forEach((race,i)=>{
      race.reset();const p=race.car.location;
      race.car.x=p.x+p.nx*(i===0?-2.3:2.3);
      race.car.z=p.z+p.nz*(i===0?-2.3:2.3);
      race.message='';race.bestPosition=1;
    });
    this.players.forEach((race,i)=>race.analysis.seedOpponents(race,[{id:1-i,progress:this.players[1-i].progress}]));
  }
  recover(index){this.players[index].recover();}
  get order(){return this.players.map((race,index)=>({race,index})).sort((a,b)=>{
    if(a.race.finishTime!==null&&b.race.finishTime!==null)return a.race.finishTime-b.race.finishTime;
    if(a.race.finishTime!==null)return -1;if(b.race.finishTime!==null)return 1;
    return b.race.progress-a.race.progress;
  });}
  step(dt,inputs){
    if(this.phase==='finished')return;
    this.elapsed+=dt;
    const active=this.players.map(race=>race.phase==='racing');
    this.players.forEach((race,i)=>race.step(dt,inputs[i]||{}));
    this.phase=this.players.every(r=>r.phase==='finished')?'finished':this.players.some(r=>r.phase==='countdown')?'countdown':'racing';
    this.collisionCooldown=Math.max(0,this.collisionCooldown-dt);
    if(this.phase==='racing'&&this.players.every(r=>r.phase==='racing')){
      const [a,b]=this.players.map(r=>r.car);
      if(resolveCarContact(a,b)){
        a.location=this.players[0].track.nearest(a.x,a.z);
        b.location=this.players[1].track.nearest(b.x,b.z);
        if(this.collisionCooldown===0){a.impact=b.impact=.3;this.collisionCooldown=.4;}
      }
    }
    this.order.forEach(({race},i)=>{race.position=i+1;race.bestPosition=Math.min(race.bestPosition,race.position);});
    this.players.forEach((race,i)=>{if(active[i]){const other=this.players[1-i];race.analysis.updateOpponents(race,[{id:1-i,progress:other.progress,finished:other.phase==='finished'}]);}});
  }
}
