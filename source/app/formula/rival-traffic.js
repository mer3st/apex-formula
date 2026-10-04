import {driverProfile} from './rival-profiles.js';
import {TRACK} from './track.js';
import {RACING_LINE} from './racing-line.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const trackGap=(from,to,length)=>((to-from+length/2)%length+length)%length-length/2;
const CLEARANCE=3.2;

// Track normals point right; decreasing heading describes a right-hand bend.
function nextInside(rival,track){
  if(!track.sample)return null;
  const horizon=Math.min(180,30+rival.speed*3);
  for(let ahead=20;ahead<=horizon;ahead+=10){
    const a=track.sample(rival.s+ahead-12),b=track.sample(rival.s+ahead+12);
    const turn=Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading));
    if(Math.abs(turn)>.12)return {lane:-Math.sign(turn)*Math.min(3.6,track.width/2-2.5),until:rival.s+ahead+40,ahead};
  }
  return null;
}

// All decisions use the same frame snapshot, so array order cannot make a car
// react to a neighbour that has already moved. The player is a traffic actor too.
export function planRivalTraffic(rivals,player,track){
  const actors=rivals.filter(r=>!r.finished).map(r=>({...r}));
  if(player)actors.push({...player,name:'@player',player:true});
  const limit=Math.max(0,track.width/2-2.5);
  const plans=new Map();
  // Front cars reserve a passing corridor first; stable names break grid ties.
  const ordered=rivals.filter(r=>!r.finished).slice().sort((a,b)=>b.s-a.s||a.name.localeCompare(b.name));
  for(const rival of ordered){
    const profile=driverProfile(rival);
    const clearance=CLEARANCE;
    const others=actors.filter(a=>!(!a.player&&a.name===rival.name));
    const gapTo=a=>trackGap(rival.s,a.s,track.length);
    const blocked=others.filter(a=>{
      const gap=gapTo(a),stationary=a.speed<3;
      // A stopped car on the exit line is already an obstacle before we turn
      // towards it. Planning only from current offsets discovers it too late.
      const crossesExit=stationary&&rival.pushPace&&track===TRACK&&
        Math.abs(a.lane-RACING_LINE.sample(a.s).offset)<clearance;
      return gap>0&&gap<(stationary?90:45)&&(Math.abs(a.lane-rival.lane)<clearance||crossesExit);
    }).sort((a,b)=>gapTo(a)-gapTo(b))[0];
    const clear=lane=>others.every(a=>{
      const gap=gapTo(a),closing=rival.speed-a.speed;
      // Never sweep across a car alongside or one rapidly approaching from behind.
      const movingAway=rival.speed<8&&a.speed<3&&Math.abs(gap)>5.4&&
        (lane-rival.lane)*(rival.lane-a.lane)>0;
      if(!movingAway&&(Math.abs(gap)<6||gap<0&&closing<-.5&&gap>-9-Math.max(0,-closing)*1.2)){
        if(a.lane>Math.min(rival.lane,lane)-clearance&&a.lane<Math.max(rival.lane,lane)+clearance)return false;
      }
      const reserved=plans.get(a.name)?.lane??a.lane;
      for(const t of [.6,1.2,2]){
        const predicted=gap-closing*t;
        if(predicted>-9&&predicted<14&&Math.abs(reserved-lane)<clearance)return false;
      }
      return true;
    });
    let lane=rival.targetLane??rival.lane,passTarget=rival.passTarget??null;
    const focus=others.find(a=>a.name===passTarget);
    if(!focus||gapTo(focus)<-12||gapTo(focus)>60)passTarget=null;
    // An unsuccessful run must rejoin the tow instead of spending a whole
    // straight on a slow outside line. Keep an overlap and active lane change.
    const attackCommitted=rival.intent?.attackReady&&rival.intent.target===focus?.name&&rival.intent.closing>-2;
    const abandon=focus&&rival.pushPace&&!attackCommitted&&gapTo(focus)>28&&rival.speed<focus.speed-1&&rival.passTimer<=0;
    if(abandon){passTarget=null;if(clear(rival.homeLane??rival.lane))lane=rival.homeLane??rival.lane;}
    const safeLane=clear(lane);
    if(!safeLane){lane=rival.lane;passTarget=null;}
    const playerGap=player?trackGap(rival.s,player.s,track.length):Infinity;
    let counterUntil=rival.counterUntil??0;
    if(player&&rival.lastPlayerGap<=0&&playerGap>0&&playerGap<12)counterUntil=rival.s+profile.counterDistance;
    if(!player||playerGap>65||playerGap<-12)counterUntil=0;
    const counterattack=counterUntil>rival.s;
    let attackMode=passTarget?(rival.attackMode??'pass'):null,attackUntil=rival.attackUntil??0;
    const encounter=player&&playerGap>-65&&playerGap<12;
    let defenseUsed=encounter&&!!rival.defenseUsed;
    let defenseLane=rival.defenseLane??null,defenseUntil=rival.defenseUntil??0;
    if(!encounter||rival.s>=defenseUntil)defenseLane=null;
    // Safety can cancel a move, but cannot start another block in this encounter.
    if(defenseLane!==null&&!clear(defenseLane))defenseLane=rival.lane;
    const closing=player?player.speed-rival.speed:0;
    if(!defenseUsed&&!passTarget&&!blocked&&rival.speed>12&&playerGap<-14&&playerGap>-profile.defenseRange&&closing>.5&&-playerGap/closing>2.5){
      const corner=nextInside(rival,track);
      // Leave enough distance to move before the braking/turn-in region.
      if(corner&&corner.ahead>Math.max(25,rival.speed*.7)&&clear(corner.lane)){
        defenseLane=corner.lane;defenseUntil=corner.until;defenseUsed=true;
      }
    }
    // Keep the chosen side until the pass is completed with a car-length gap.
    const alongside=others.some(a=>Math.abs(gapTo(a))<12);
    const committed=!abandon&&defenseLane===null&&rival.defenseLane==null&&safeLane&&(passTarget!==null||Math.abs((rival.targetLane??rival.lane)-rival.lane)>.15||rival.passTimer>0);
    let passing=committed;
    const stopped=blocked&&blocked.speed<3&&(blocked.player||blocked.cruise<3||rival.intent&&rival.intent.mode!=='launch'&&rival.speed<3);
    // Expert drivers wait for a real closing-speed advantage. A high desired
    // speed alone would send the whole grid into unnecessary launch overtakes.
    const prepared=blocked&&rival.intent?.attackReady&&rival.intent.target===blocked.name&&
      (gapTo(blocked)<18||gapTo(blocked)<profile.attackRange&&!nextInside(rival,track));
    const runReady=blocked&&(rival.speed>=blocked.speed+3||gapTo(blocked)<18&&rival.speed>blocked.speed+.5);
    const canAttack=!rival.pushPace||stopped||runReady||prepared||counterattack&&blocked?.player;
    if(defenseLane!==null){lane=defenseLane;passing=false;passTarget=null;}
    else if(blocked&&(rival.speed>8||stopped)&&canAttack&&(rival.cruise>blocked.speed+2||(prepared||counterattack&&blocked.player)&&rival.cruise>blocked.speed-.5)&&!committed){
      const corner=nextInside(rival,track);
      // Candidate corridors follow the opponent's actual offset, not three fixed lanes.
      const lanes=[blocked.lane-clearance-.4,blocked.lane+clearance+.4,rival.homeLane??0,-limit,limit].map(l=>clamp(l,-limit,limit));
      const choices=[...new Set(lanes)].filter(l=>Math.abs(l-blocked.lane)>=clearance&&clear(l));
      const inside=corner&&choices.filter(l=>l*corner.lane>0);
      const canBrakeLate=!profile.preferExit&&corner&&corner.ahead>Math.max(25,rival.speed*.65)&&gapTo(blocked)<profile.attackGap&&rival.speed>=blocked.speed-1;
      const preferred=canBrakeLate&&inside.length?inside:corner?choices.filter(l=>l*corner.lane<0):choices;
      const ranked=(preferred.length?preferred:choices).sort((a,b)=>Math.abs(a-rival.lane)-Math.abs(b-rival.lane)||a-b);
      if(ranked.length){
        lane=ranked[0];passing=true;passTarget=blocked.name;
        attackMode=corner?(canBrakeLate&&lane*corner.lane>0?'late-brake':'exit'):'pass';
        attackUntil=corner?.until??0;
      }
    }else if(!blocked&&!alongside&&!committed&&clear(rival.homeLane??rival.lane))lane=rival.homeLane??rival.lane;
    if(!passTarget)attackMode=null;
    // After the bend, unwind onto the exit line only if the traffic corridor is free.
    if(attackMode==='exit'&&rival.s>=attackUntil&&clear(rival.homeLane??rival.lane)){
      lane=rival.homeLane??rival.lane;attackMode='exit-drive';
    }
    if(attackMode==='late-brake'&&rival.s>=attackUntil)attackMode='pass';
    lane=clamp(lane,-limit,limit);
    let speed=rival.cruise;
    for(const a of others){
      const gap=gapTo(a);
      // Brake while still behind the leader, even after selecting a passing side.
      if(gap>0&&gap<55&&Math.abs(a.lane-rival.lane)<clearance){
        // Stopped traffic needs space to turn with real steering. Stopping at
        // seven metres then creeping forwards can strand a whole queue before
        // its first car has enough lateral separation to complete the pass.
        const followingGap=a.speed<3?14:7;
        const space=Math.max(0,gap-followingGap);
        speed=Math.min(speed,Math.max(0,a.speed+(gap-followingGap)/.9),Math.sqrt(a.speed*a.speed+2*22*space));
      }
    }
    // Let the front car escape first instead of crawling up behind it while
    // its own pass is still blocked by the stationary obstacle.
    const creepAllowed=!others.some(a=>gapTo(a)>0&&gapTo(a)<14&&a.speed<3&&
      Math.abs(a.lane-rival.lane)<clearance&&plans.get(a.name)?.passing);
    plans.set(rival.name,{lane,speed,passing,passTarget,creepAllowed,defenseLane,defenseUntil,defenseUsed,attackMode,attackUntil,counterUntil,lastPlayerGap:playerGap,counterattack});
  }
  return plans;
}
