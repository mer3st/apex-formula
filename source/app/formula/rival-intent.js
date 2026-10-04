import {trackGap} from './rival-traffic.js';
import {driverProfile} from './rival-profiles.js';

// Decisions persist across frames. Charge, relative speed and the remaining
// race distance decide when to spend an attack, rather than a random pace wave.
export function rivalIntent(rival,actors,track,time,finishDistance){
  const profile=driverProfile(rival),previous=rival.intent;
  const traffic=actors.filter(a=>a.name!==rival.name&&!a.finished);
  const ahead=traffic.map(a=>({actor:a,gap:trackGap(rival.s,a.s,track.length)}))
    .filter(a=>a.gap>0&&a.gap<140).sort((a,b)=>a.gap-b.gap)[0];
  const rear=traffic.find(a=>{const gap=trackGap(rival.s,a.s,track.length);return gap<0&&gap>-45&&a.speed>rival.speed+.5;});
  const target=ahead?.actor,closing=target?rival.speed-target.speed:0;
  const finalAttack=finishDistance-rival.s<track.length*.25;
  let mode='push',reason='clear track';
  if(rival.car?.offTrack||Math.abs(rival.lane)>6.3){mode='recover';reason='restore road margin';}
  else if(time<4){mode='launch';reason='build speed and hold grid corridor';}
  else if(target&&ahead.gap<65&&!finalAttack&&
    (rival.energy<18||previous?.mode==='recharge'&&rival.energy<45)&&closing<3){
    mode='recharge';reason='save energy for another attempt';
  }else if(target&&ahead.gap<profile.attackRange&&closing>=-.6&&
    (rival.energy>=12||closing>3||finalAttack)){
    mode='attack';reason=closing>3?'exploit opponent speed loss':'commit stored energy to a close contest';
  }else if(target){mode='hunt';reason='close the gap and prepare the next corner';}
  else if(rear){mode='defend';reason='answer a closing rival';}
  // A brief loss of the closing-speed advantage must not cancel a committed
  // attack; a pulling-away target, lost road margin or low charge still can.
  if(previous?.mode==='attack'&&previous.until>time&&mode==='hunt'&&
    previous.target===target?.name&&ahead.gap<55&&closing>-2&&rival.energy>8)mode='attack';
  // Renew commitment when a genuine opportunity still exists, not only on
  // entering attack mode. A late corner-speed dip gets the same short grace
  // period as one at the start of the attack; a fading run cannot renew it.
  const renewAttack=mode==='attack'&&target&&ahead.gap<profile.attackRange&&closing>=-.6;
  const until=renewAttack?time+2.5:previous?.mode===mode?previous.until:time+(mode==='attack'?2.5:1);
  return {mode,reason,target:target?.name??null,gap:ahead?.gap??Infinity,closing,until,
    attackReady:mode==='attack',
    anticipation:mode==='attack'?.6:mode==='hunt'?.75:1,
    boostReserve:mode==='recharge'?45:mode==='hunt'?20:0};
}
