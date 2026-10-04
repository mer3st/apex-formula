import {clamp} from './physics.js';
import {trackGap} from './rival-traffic.js';
import {driverProfile} from './rival-profiles.js';

// Shared tow geometry keeps the player's and rivals' aerodynamic benefit equal.
export function draftingStrength(driver,actors,length){
  let strength=0;
  for(const actor of actors){
    if(actor.name===driver.name||actor.finished)continue;
    const gap=trackGap(driver.s,actor.s,length);
    if(gap>1.5&&gap<22){
      const align=1-Math.min(1,Math.abs(driver.lane-actor.lane)/3.6);
      strength=Math.max(strength,(1-(gap-1.5)/20.5)*align);
    }
  }
  return strength;
}

export function updateRivalEnergy(rival,actors,track,dt,controls){
  const car=rival.car;
  rival.slipstream=draftingStrength(rival,actors,track.length);
  if(rival.energy<.5)rival.boostLocked=true;
  if(rival.energy>=15)rival.boostLocked=false;
  const traffic=actors.filter(a=>a.name!==rival.name&&!a.finished);
  const profile=driverProfile(rival);
  const gaps=traffic.map(a=>trackGap(rival.s,a.s,track.length)).filter(gap=>gap>0);
  const nearest=Math.min(...gaps);
  const attacking=nearest<profile.boostRange||rival.pushPace===true;
  // Save charge between attempts, but spend it on a close pass or a clean exit.
  const opportunity=nearest<25||rival.attackMode==='exit-drive'||rival.pushPace===true;
  const reserve=rival.intent?rival.intent.boostReserve:rival.boosting||opportunity?0:profile.boostReserve;
  const blocked=traffic.some(a=>{const gap=trackGap(rival.s,a.s,track.length);return gap>0&&gap<14&&Math.abs(a.lane-rival.lane)<3.2;});
  const now=track.sample(rival.s),ahead=track.sample(rival.s+Math.max(30,car.speed*.9));
  const bend=Math.abs(Math.atan2(Math.sin(ahead.heading-now.heading),Math.cos(ahead.heading-now.heading)));
  rival.boosting=attacking&&!blocked&&!rival.boostLocked&&rival.energy>reserve&&car.speed>12&&
    car.location.distance<track.width/2-.6&&!car.offTrack&&controls.brake===0&&car.brake<.05&&
    controls.throttle>.9&&controls.targetSpeed>car.speed+(rival.pushPace?1:3)&&Math.abs(controls.steering)<(rival.pushPace?.3:.25)&&bend<(rival.pushPace?.25:.12);
  rival.energy=clamp(rival.energy+dt*(rival.boosting?-15:controls.brake?10:1),0,100);
  controls.boost=rival.boosting;
  controls.slipstream=rival.slipstream;
}
