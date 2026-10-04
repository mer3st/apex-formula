import {TRACK} from './track.js';
import {FixedStep} from './physics.js';
import {SprintRace,cornerSpeed,angleDelta,RACE_DIFFICULTIES} from './race.js';
import {FormulaWorld} from './world.js';
import {EngineAudio} from './audio.js';
import {GamepadInput} from './gamepad.js';
import {mountControllerSettings} from './controller-settings.js';
import {LocalRace,splitInputs} from './local-race.js';
import {sampleSurface} from './surface-feedback.js';
import {updateRaceBest,formatRaceRecord} from './race-records.js';
import {mountCarColors,mountRecordCelebration} from './player-style.js';
import {showRaceAnalysis} from './race-analysis.js';
const $=id=>document.getElementById(id),race=new SprintRace(),car=race.car,input={},held=new Set(),sound=new EngineAudio();
const localRace=new LocalRace(),input2={},sound2=new EngineAudio();
let twoPlayer=false,helpDismissed=false;
try{helpDismissed=localStorage.getItem('apex-driving-help')==='dismissed';}catch{}
let state='menu',world,last=0,hudTime=0,assist=false,abs=true,tractionControl=true,manual=false;
try{
  const saved=JSON.parse(localStorage.getItem('apex-driving-settings'));
  if(saved&&typeof saved==='object'){
    if(typeof saved.assist==='boolean')assist=saved.assist;
    if(typeof saved.abs==='boolean')abs=saved.abs;
    if(typeof saved.tractionControl==='boolean')tractionControl=saved.tractionControl;
    if(typeof saved.manual==='boolean')manual=saved.manual;
  }
}catch{}
function saveDrivingSettings(){
  try{localStorage.setItem('apex-driving-settings',JSON.stringify({assist,abs,tractionControl,manual}));}catch{}
}
const extra=document.createElement('div');extra.innerHTML=`<div id="race-status"><b id="position">P4 <small>/ 4</small></b><span id="lap">LAP 1 / 2</span><ol id="standings"></ol></div><div id="start-lights"></div><div id="race-callout"></div><div id="slip-tag">SLIPSTREAM</div><div id="boost-box"><span>SHIFT · OVERTAKE</span><i><b id="energy"></b></i></div>`;$('hud').append(extra);
const result=document.createElement('section');result.id='results';result.hidden=true;result.setAttribute('role','dialog');result.setAttribute('aria-modal','true');result.setAttribute('aria-labelledby','result-title');result.innerHTML=`<div><span class="eyebrow">VALLE SPRINT / CLASSIFIED</span><h2 id="result-title"></h2><p id="result-time"></p><ol id="result-order"></ol><button id="again" class="primary">RACE AGAIN →</button><button id="paddock" class="secondary">BACK TO RACE SETUP</button></div>`;document.body.append(result);
const assistButton=document.createElement('button');assistButton.id='assist';assistButton.textContent=`BRAKE ASSIST ${assist?'ON':'OFF'}`;$('assist-controls').append(assistButton);
assistButton.setAttribute('aria-pressed',String(assist));
assistButton.onclick=()=>{assist=!assist;assistButton.textContent=`BRAKE ASSIST ${assist?'ON':'OFF'}`;assistButton.setAttribute('aria-pressed',String(assist));saveDrivingSettings();};
for(const [id,label,get,set] of [['abs','ABS',()=>abs,v=>abs=v],['tc','TC',()=>tractionControl,v=>tractionControl=v],['gearbox','GEARS',()=>!manual,v=>manual=!v]]){const button=document.createElement('button');button.id=id;const refresh=()=>button.textContent=id==='gearbox'?`GEARS ${manual?'MANUAL':'AUTO'}`:`${label} ${get()?'ON':'OFF'}`;refresh();button.setAttribute('aria-pressed',String(get()));button.onclick=()=>{set(!get());refresh();button.setAttribute('aria-pressed',String(get()));saveDrivingSettings();};$('assist-controls').append(button);}
const clock=new FixedStep(dt=>twoPlayer?localRace.step(dt,[{...input,abs:true,tractionControl:true,manual:false},{...input2,abs:true,tractionControl:true,manual:false}]):race.step(dt,{...input,assist,abs,tractionControl,manual}));
let selectedDifficulty='medium';
try{if(localStorage.getItem('apex-race-difficulty')==='hard')selectedDifficulty='hard';}catch{}
const difficultyBadge=document.createElement('span');difficultyBadge.id='difficulty-badge';difficultyBadge.textContent=RACE_DIFFICULTIES[selectedDifficulty].label;document.querySelector('.top-controls').append(difficultyBadge);
function clearInput(){held.clear();for(const target of [input,input2])for(const k of Object.keys(target))delete target[k];}
function setState(next){
  if(next!=='results')recordCelebration.hide();
  if(next!=='driving'){pad.stopRumble();sound.silence();sound2.silence();}
  state=next;document.body.dataset.state=next;clearInput();clock.clear();
  $('welcome').hidden=next!=='menu';$('hud').hidden=twoPlayer||next==='menu'||next==='results';
  $('split-hud').hidden=!twoPlayer||next==='menu'||next==='results';
  $('paused').hidden=next!=='paused';result.hidden=next!=='results';
  document.body.classList.toggle('split-playing',twoPlayer&&next!=='menu');
  if(world){world.snapped=false;for(const v of world.splitViews||[])v.snapped=false;if(next==='menu'){world.setSplitMode(false);$('drive').focus();}}
}
function begin(){
  if(!world)return;
  if(twoPlayer&&!pad.pads().length){showPadBadge('Connect a gamepad and press a button for Player 2.',3200);return;}
  if(twoPlayer)localRace.reset();else{race.difficulty=selectedDifficulty;race.reset();difficultyBadge.textContent=RACE_DIFFICULTIES[selectedDifficulty].label;}
  world.setSplitMode(twoPlayer);carColors.apply(world);setState('driving');
  try{sound.start();if(twoPlayer)sound2.start();}catch{}$('scene').focus();
}
function pause(){if(state==='driving'){setState('paused');$('resume').focus();}}
function resume(){if(twoPlayer&&!pad.pads().length){showPadBadge('Reconnect your gamepad to resume.',2600);return;}if(state==='paused'){setState('driving');try{sound.start();if(twoPlayer)sound2.start();}catch{}$('scene').focus();}}
function camera(player=0){if(!world)return;if(twoPlayer&&world.splitViews){const view=world.splitViews[player];view.mode=view.mode==='chase'?'tcam':'chase';view.snapped=false;return;}world.mode=world.mode==='chase'?'tcam':'chase';world.snapped=false;$('view').textContent=world.mode==='chase'?'CHASE CAMERA':'T-CAM';}
function showRaceRecords(entries){
  let panel=$('race-records');
  if(!panel){panel=document.createElement('div');panel.id='race-records';panel.setAttribute('aria-live','polite');$('result-order').before(panel);}
  panel.replaceChildren();const newRecords=[];
  for(const {session,category,label} of entries){
    const record=updateRaceBest(session,category);if(!record)continue;
    const line=document.createElement('p');line.className=record.isNew&&record.saved?'new-record':'';
    line.textContent=`${label} · ${record.isNew&&record.saved?'NEW PERSONAL BEST':'PERSONAL BEST'}: ${formatRaceRecord(record.best)}${record.saved?'':' (not saved — storage unavailable)'}`;
    panel.append(line);
    if(record.isNew&&record.saved)newRecords.push(`${label}: ${formatRaceRecord(record.best)}`);
  }
  recordCelebration.show(newRecords);
}
function finish(){
  showRaceAnalysis(result,twoPlayer?localRace.players.map((session,i)=>({label:`PLAYER ${i+1}`,analysis:session.analysis})):[{label:'YOU',analysis:race.analysis}],formatRaceRecord);
  if(twoPlayer){
    setState('results');const order=localRace.order;
    const draw=Math.abs(order[0].race.finishTime-order[1].race.finishTime)<1/120;
    $('result-title').textContent=draw?'PHOTO FINISH!':`PLAYER ${order[0].index+1} WINS!`;
    $('result-time').textContent='2 laps · Local head-to-head · No AI rivals';
    showRaceRecords(order.map(({race,index})=>({session:race,category:`local-player-${index+1}`,label:`PLAYER ${index+1}`})));
    $('result-order').innerHTML=order.map(({race,index},i)=>`<li><b>${draw?1:i+1}</b> PLAYER ${index+1} <span>${formatTime(race.finishTime)}</span></li>`).join('');$('again').focus();return;
  }
  setState('results');$('result-title').textContent=race.position===1?'VICTORY.':`P${race.position} / FINISH`;$('result-time').textContent=`2 laps · ${formatTime(race.finishTime)} · Best position P${race.bestPosition}`;
  showRaceRecords([{session:race,category:`solo-${race.difficulty}`,label:RACE_DIFFICULTIES[race.difficulty].label}]);
  const order=[...race.rivals.map(r=>({name:r.name,s:r.s,time:r.finishTime})),{name:'YOU',s:race.progress,time:race.finishTime}].sort((a,b)=>a.time!==null&&b.time!==null?a.time-b.time:a.time!==null?-1:b.time!==null?1:b.s-a.s);
  $('result-order').innerHTML=order.map((r,i)=>`<li><b>${i+1}</b> ${r.name}<span>${r.time?formatTime(r.time):'BEHIND'}</span></li>`).join('');$('again').focus();}
$('drive').onclick=begin;$('again').onclick=begin;$('pause').onclick=pause;$('resume').onclick=resume;$('restart').onclick=begin;$('exit').onclick=$('paddock').onclick=()=>{race.reset();setState('menu');};$('camera').onclick=()=>camera(0);
function updateSoundButtons(){
  $('sound').textContent=sound.enabled?'SOUND ON':'SOUND OFF';
  $('menu-sound').textContent=sound.enabled?'Sound on':'Sound off';
  for(const id of ['sound','menu-sound']){$(id).setAttribute('aria-label',sound.enabled?'Turn sound off':'Turn sound on');$(id).setAttribute('aria-pressed',String(sound.enabled));}
  if($('split-sound'))$('split-sound').textContent=sound.enabled?'Sound on':'Sound off';
}
try{sound.enabled=sound2.enabled=localStorage.getItem('apex-sound')!=='off';}catch{}
let soundVolume=100;
try{
  const saved=localStorage.getItem('apex-sound-volume');
  const value=saved===null||saved.trim()===''?NaN:Number(saved);
  if(Number.isFinite(value))soundVolume=Math.round(Math.max(0,Math.min(100,value)));
}catch{}
const volumeControl=document.createElement('div');volumeControl.className='volume-control';
volumeControl.innerHTML='<div><label for="sound-volume">Sound volume</label><output id="sound-volume-value" for="sound-volume"></output></div><input id="sound-volume" type="range" min="0" max="100" step="1">';
document.querySelector('#game-settings .settings-controls').before(volumeControl);
function applySoundVolume(){
  sound.setVolume(soundVolume/100);sound2.setVolume(soundVolume/100);
  $('sound-volume').value=String(soundVolume);
  $('sound-volume').setAttribute('aria-valuetext',`${soundVolume}%`);
  $('sound-volume-value').textContent=`${soundVolume}%`;
}
applySoundVolume();
$('sound-volume').oninput=()=>{
  soundVolume=Number($('sound-volume').value);applySoundVolume();
  try{localStorage.setItem('apex-sound-volume',String(soundVolume));}catch{}
};
$('sound').onclick=()=>{sound.enabled=!sound.enabled;sound2.enabled=sound.enabled;updateSoundButtons();try{localStorage.setItem('apex-sound',sound.enabled?'on':'off');}catch{}if(sound.enabled&&state==='driving'){sound.start();if(twoPlayer)sound2.start();}else{sound.silence();sound2.silence();}};
$('menu-sound').onclick=()=>$('sound').click();updateSoundButtons();
$('dismiss-help').onclick=()=>{helpDismissed=true;$('driving-help').hidden=true;try{localStorage.setItem('apex-driving-help','dismissed');}catch{}};
const calibOverlay=document.createElement('div');calibOverlay.id='calib-overlay';calibOverlay.hidden=true;
calibOverlay.innerHTML=`<div><span class="eyebrow">GAMEPAD SETUP</span><h2 id="calib-prompt">…</h2><div class="calib-progress"><i id="calib-bar"></i></div><p id="calib-step">1 / 11</p><div class="calib-buttons"><button id="calib-skip" class="secondary" hidden>SKIP</button><button id="calib-cancel" class="text-button">CANCEL</button></div></div>`;
document.body.append(calibOverlay);
const setupBtn=document.createElement('button');setupBtn.id='setup-pad';setupBtn.className='secondary';setupBtn.textContent="Controller settings";setupBtn.hidden=false;
$('menu-secondary').append(setupBtn);
const setupBtnPaused=document.createElement('button');setupBtnPaused.id='setup-pad-paused';setupBtnPaused.className='text-button';setupBtnPaused.textContent="Controller settings";setupBtnPaused.hidden=false;
document.querySelector('#paused section').append(setupBtnPaused);
function runCalibration(){controllerSettings.open();}
setupBtn.onclick=runCalibration;setupBtnPaused.onclick=runCalibration;
$('calib-cancel').onclick=()=>pad.cancelCalibration();
$('calib-skip').onclick=()=>pad.skipCalibrationStep();
let padName='';
const padBadge=document.createElement('div');padBadge.id='pad-badge';padBadge.hidden=true;document.body.append(padBadge);
function showPadBadge(text,ms){padBadge.textContent=text;padBadge.hidden=false;clearTimeout(showPadBadge.t);showPadBadge.t=setTimeout(()=>padBadge.hidden=true,ms);}
const pad=new GamepadInput({
  onConnect:(name)=>{padName=name;showPadBadge(`🎮 ${name} CONNECTED`,2600);pad.rumble(.4,.2,150);setupBtn.hidden=false;setupBtnPaused.hidden=false;document.querySelector('.bottom-help').textContent=pad.hasCustomMap()?'CUSTOM GAMEPAD CONTROLS ACTIVE':'🎮 STICK STEER · R2/L2 GAS/BRAKE · ✕ BOOST · □ RECOVER · △ CAMERA · ○ PAUSE';document.querySelector('.desktop').textContent='Gamepad connected · Ready to race';},
  onCalibrationInterrupted:()=>{calibOverlay.hidden=true;showPadBadge('Gamepad disconnected — setup cancelled',3200);},
  onDisconnect:()=>{if(twoPlayer)pause();showPadBadge('GAMEPAD DISCONNECTED',1800);setupBtn.hidden=false;setupBtnPaused.hidden=false;input.steering=undefined;readHeld();document.querySelector('.bottom-help').textContent='WASD / ARROWS · DRIVE   R · RECOVER   C · CAMERA   P · PAUSE';},
  onAction:(id)=>{
    if(id==='confirm'){if(state==='menu'||state==='results')begin();else if(state==='paused')resume();}
    else if(id==='back'){if(state==='driving')pause();else if(state==='paused'&&twoPlayer)resume();else if(state==='paused'||state==='results'){race.reset();setState('menu');}}
    else if(id==='menu'){if(state==='driving')pause();else if(state==='paused')resume();}
    else if(id==='camera'&&state==='driving')camera(twoPlayer?1:0);
    else if(id==='recover'){if(state==='driving'){recoverPlayer(twoPlayer?1:0);}else if(state==='paused')begin();}
  },
});
const controllerSettings=mountControllerSettings(pad,pause);
const gameSettings=$('game-settings');
const recordCelebration=mountRecordCelebration(result.firstElementChild);
const carColors=mountCarColors(document.querySelector('#game-settings .settings-controls'),()=>carColors.apply(world));
const colorButton=document.createElement('button');colorButton.id='menu-car-color';colorButton.className='icon-button';colorButton.textContent='Mashina rangi';
document.querySelector('.menu-tools').append(colorButton);
colorButton.onclick=()=>{openSettings();$('car-colors').scrollIntoView({block:'center'});document.querySelector('#car-colors button').focus({preventScroll:true});};
function closeSettings(){gameSettings.close();pad.settingsOpen=false;}
function openSettings(){pause();clearInput();pad.settingsOpen=true;for(const button of $('assist-controls').querySelectorAll('button'))button.disabled=twoPlayer;$('local-assists-note').hidden=!twoPlayer;gameSettings.showModal();}
for(const id of ['menu-settings','race-settings','pause-settings'])$(id).onclick=openSettings;
$('settings-close').onclick=$('settings-done').onclick=closeSettings;
gameSettings.addEventListener('cancel',e=>{e.preventDefault();closeSettings();});
gameSettings.addEventListener('keydown',e=>e.stopPropagation());
$('settings-controller').onclick=()=>{closeSettings();controllerSettings.open();};
// Pause/results behave as keyboard dialogs: keep Tab within their active panel.
document.addEventListener('keydown',e=>{
  if(e.key!=='Tab'||document.querySelector('dialog[open]'))return;
  const panel=state==='paused'?$('paused'):state==='results'?result:null;if(!panel)return;
  const buttons=[...panel.querySelectorAll('button:not([disabled])')].filter(b=>!b.hidden),first=buttons[0],last=buttons.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
setupBtn.textContent=setupBtnPaused.textContent='Controller settings';
const modeBar=document.createElement('div');modeBar.id='mode-select';
modeBar.innerHTML='<button id="mode-solo" aria-pressed="true">Solo race</button><button id="mode-local" aria-pressed="false">2 players</button><p id="mode-help">Race 3 rivals · Keyboard or gamepad</p>';
document.querySelector('.intro').insertBefore(modeBar,$('drive'));
const difficultySelect=document.createElement('fieldset');difficultySelect.id='difficulty-select';
difficultySelect.innerHTML='<legend>RIVAL DIFFICULTY</legend><button type="button" id="difficulty-medium"><b>MEDIUM</b><span>Competitive pace</span></button><button type="button" id="difficulty-hard"><b>HARD</b><span>Expert drivers</span></button>';
document.querySelector('.intro').insertBefore(difficultySelect,$('drive'));
function chooseDifficulty(mode){
  selectedDifficulty=mode;
  for(const key of ['medium','hard'])$('difficulty-'+key).setAttribute('aria-pressed',String(key===mode));
  try{localStorage.setItem('apex-race-difficulty',mode);}catch{}
}
$('difficulty-medium').onclick=()=>chooseDifficulty('medium');$('difficulty-hard').onclick=()=>chooseDifficulty('hard');chooseDifficulty(selectedDifficulty);
function chooseMode(multi){
  twoPlayer=multi;$('mode-solo').setAttribute('aria-pressed',String(!multi));$('mode-local').setAttribute('aria-pressed',String(multi));
  difficultySelect.hidden=multi;
  $('drive').innerHTML=(multi?'RACE TOGETHER':'RACE NOW')+' <span aria-hidden="true">→</span>';
  document.querySelector('.car-info').hidden=multi;
  document.querySelector('.intro .eyebrow').textContent=multi?'VALLE CIRCUIT · 2 LAPS / 2 PLAYERS':'VALLE CIRCUIT · 2 LAPS / 4 DRIVERS';
  document.querySelector('#welcome footer div:first-child span').textContent=multi?'Two players. One circuit. No AI rivals.':'Beat 3 rivals. Use boost on the straights.';
  document.querySelector('.intro>p').textContent=multi?'Share the screen. Settle it on the track.':'Three rivals. Two laps. One winner.';
  modeStatus();
}
function modeStatus(){
  $('drive').disabled=twoPlayer&&!pad.connected;
  $('mode-help').textContent=twoPlayer?(pad.connected?'Ready · P1: Keyboard / P2: Gamepad':'Player 2: connect a gamepad and press a button.'):'Race 3 rivals · Keyboard or gamepad';
}
$('mode-solo').onclick=()=>chooseMode(false);$('mode-local').onclick=()=>chooseMode(true);
const splitHud=document.createElement('section');splitHud.id='split-hud';splitHud.hidden=true;
splitHud.innerHTML=[0,1].map(i=>`<section class="split-player" id="player-${i+1}"><header><b>PLAYER ${i+1} <small>${i===0?'KEYBOARD':'GAMEPAD'}</small></b><span class="split-lap"></span></header><div class="split-message" role="status"></div><footer><span class="split-help">${i===0?'WASD / ARROWS · SHIFT: boost · R: recover':'LEFT STICK · RT/R2: gas · LT/L2: brake · A/×: boost'}</span><div><b class="split-speed">000</b><small> KM/H</small><span class="split-gear"></span><span class="split-energy"></span></div></footer></section>`).join('')+'<nav><button id="split-settings">Controller</button><button id="split-sound">Sound on</button><button id="split-pause">Pause · P</button></nav>';
document.body.append(splitHud);
$('split-pause').onclick=pause;$('split-settings').onclick=()=>controllerSettings.open();
$('split-sound').onclick=()=>$('sound').click();updateSoundButtons();
function recoverPlayer(index){
  if(twoPlayer){localRace.recover(index);world.splitViews[index].snapped=false;}
  else {race.recover();world.snapped=false;}
}
function updateSplitHud(){
  localRace.players.forEach((r,i)=>{
    const panel=$('player-'+(i+1));
    panel.classList.toggle('show-help',r.phase==='countdown');
    panel.classList.toggle('is-countdown',r.phase==='countdown');
    panel.querySelector('.split-lap').textContent=`P${r.position} / 2 · LAP ${r.lap} / 2 · ${formatTime(r.time)}`;
    panel.querySelector('.split-speed').textContent=String(Math.round(r.car.speed*3.6)).padStart(3,'0');
    panel.querySelector('.split-gear').textContent=' GEAR '+r.car.gear;
    panel.querySelector('.split-energy').textContent=' ERS '+Math.round(r.energy)+'%';
    panel.querySelector('.split-message').textContent=r.phase==='countdown'?String(Math.max(1,Math.ceil(r.countdown))):r.phase==='finished'?'FINISHED · Waiting for your rival':r.messageTime>0&&r.time<2?'GO!':r.car.offTrack?'OFF TRACK':'';
  });
}
const controls={KeyW:'throttle',ArrowUp:'throttle',KeyS:'brake',ArrowDown:'brake',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',ShiftLeft:'boost',ShiftRight:'boost',KeyE:'shiftUp',KeyQ:'shiftDown'};
const keyHeld=name=>Object.entries(controls).some(([key,value])=>value===name&&held.has(key));
function readHeld(){for(const name of ['throttle','brake','left','right','boost','shiftUp','shiftDown'])input[name]=keyHeld(name);}
window.addEventListener('keydown',e=>{if(controls[e.code]){if(state==='driving'){e.preventDefault();held.add(e.code);readHeld();}return;}if(e.repeat)return;if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();state==='paused'?resume():pause();}if(e.code==='KeyC'&&state==='driving')camera();if(e.code==='KeyR'&&state==='driving'){recoverPlayer(0);}if(e.code==='Enter'&&state==='menu'&&!e.target.closest('button,dialog,input'))begin();});
window.addEventListener('keyup',e=>{held.delete(e.code);if(controls[e.code])readHeld();});
window.addEventListener('blur',()=>{clearInput();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause();}});window.addEventListener('resize',()=>world?.resize());
$('trackLength').textContent=`2 LAPS / ${(TRACK.length*2/1000).toFixed(2)} KM`;
const map=$('map'),ctx=map.getContext('2d'),bounds=TRACK.points.reduce((b,p)=>({minX:Math.min(b.minX,p.x),maxX:Math.max(b.maxX,p.x),minZ:Math.min(b.minZ,p.z),maxZ:Math.max(b.maxZ,p.z)}),{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity});
const scale=Math.min(200/(bounds.maxX-bounds.minX),150/(bounds.maxZ-bounds.minZ)),mp=p=>[120+(p.x-(bounds.minX+bounds.maxX)/2)*scale,90+(p.z-(bounds.minZ+bounds.maxZ)/2)*scale];
const formatTime=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${(t%60).toFixed(2).padStart(5,'0')}`;
function updateHud(){
  $('driving-help').hidden=helpDismissed||race.time>8||pad.connected||state!=='driving';
  $('speed').textContent=String(Math.round(car.speed*3.6)).padStart(3,'0');$('gear').textContent=car.gear;$('clock').textContent=formatTime(race.time);$('distance').textContent=`${(Math.max(0,race.progress-24)/1000).toFixed(2)} KM`;
  $('position').innerHTML=`P${race.position} <small>/ 4</small>`;$('lap').textContent=`LAP ${race.lap} / 2`;
  $('standings').innerHTML=[...race.rivals.map(r=>({name:r.name,s:r.s,color:r.color})),{name:'YOU',s:race.progress,color:'#d7f35b'}].sort((a,b)=>b.s-a.s).map(r=>`<li class="${r.name==='YOU'?'is-player':''}" style="color:${r.color}">${r.name}<span>${r.name==='YOU'?'':`${r.s>race.progress?'+':'−'}${Math.abs(r.s-race.progress).toFixed(0)}m`}</span></li>`).join('');
  $('start-lights').hidden=race.phase!=='countdown';$('start-lights').innerHTML=Array.from({length:3},(_,i)=>`<i class="${3-Math.ceil(race.countdown)>=i?'on':''}"></i>`).join('')+`<span>${pad.connected?'HOLD R2 / RT':'HOLD W / ↑'} · GET READY</span>`;
  $('race-callout').textContent=race.messageTime>0?race.message:'';$('energy').style.width=`${race.energy}%`;$('boost-box').classList.toggle('active',race.boosting);
  $('slip-tag').classList.toggle('active',(race.slipstream||0)>.15);$('slip-tag').style.opacity=Math.min(1,(race.slipstream||0)*1.4);
  $('rpm').style.width=`${Math.max(0,(car.rpm-4000)/9000)*100}%`;$('throttle').style.width=`${car.throttle*100}%`;$('brake').style.width=`${car.brake*100}%`;
  const wrong=Math.abs(angleDelta(car.heading-car.location.heading))>1.8&&car.speed>3;
  const targetSpeed=cornerSpeed(car.location.s),braking=targetSpeed<78&&car.speed>targetSpeed-3;
  const pushingWide=car.frontSlip>.12&&car.speed>15,exitGrip=car.tcActive&&Math.abs(car.steer)>.035&&car.speed>20;
  $('surface').textContent=car.offTrack?'OFF TRACK':car.locked?'WHEELS LOCKED':car.tcActive?'TC ACTIVE':car.wheelspin>.2?'WHEELSPIN':car.frontSlip>.15?'UNDERSTEER':race.boosting?'ERS DEPLOY':braking?'BRAKING ZONE':`${Math.abs(car.lateralG).toFixed(1)} G`;
  $('notice').hidden=race.phase==='countdown'||!(car.offTrack||wrong||braking||pushingWide||exitGrip||race.time<9);
  $('notice').textContent=wrong?'WRONG WAY · R to recover':car.offTrack?'OFF TRACK · Ease back onto the circuit':braking?(assist?'BRAKE ASSIST · Turn into the corner':'BRAKE BEFORE THE TURN · S / ↓'):pushingWide?'EASE OFF THE GAS · Let the front tyres grip':exitGrip?'STRAIGHTEN THE WHEEL · Accelerate out':'Tap A / D for small corrections · Hold for corners';
  ctx.clearRect(0,0,240,180);ctx.beginPath();TRACK.points.forEach((p,i)=>{const [x,y]=mp(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.lineWidth=5;ctx.strokeStyle='#e9edda';ctx.stroke();
  for(const r of [...race.rivals,{...car,color:'#d7f35b'}]){const [x,y]=mp(r);ctx.beginPath();ctx.arc(x,y,r===car?5:4,0,Math.PI*2);ctx.fillStyle=r.color;ctx.fill();}
}
try{world=new FormulaWorld($('scene'));world.setRivals(race.rivals);world.update(car,0,true);$('view').textContent='T-CAM';document.querySelector('#boost-box>span').textContent='SHIFT · BOOST';document.querySelector('.bottom-help').textContent='WASD / ARROWS · DRIVE   R · RECOVER   C · CAMERA   P · PAUSE';$('track-path').setAttribute('d',TRACK.points.map((p,i)=>{const [x,y]=mp(p);return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`;}).join(' ')+' Z');$('loading').remove();}catch(error){console.error(error);$('loading').textContent='3D could not start. Enable hardware acceleration and reload.';}
carColors.apply(world);
function frame(now){
  const dt=Math.min(.1,(now-(last||now))/1000);last=now;
  const g=pad.poll(now);controllerSettings.update(g);if(state==='menu')modeStatus();
  if(twoPlayer){
    readHeld();delete input.steering;
    const [keyboard,gamepad]=splitInputs(input,g);
    Object.assign(input,keyboard);Object.assign(input2,gamepad);
    if(!g.connected&&state==='driving')pause();
  }else{
    if(g.connected){const keyboardSteer=(keyHeld('right')?1:0)-(keyHeld('left')?1:0);input.steering=keyboardSteer?undefined:g.steering;input.throttle=Math.max(keyHeld('throttle')?1:0,g.throttle);input.brake=Math.max(keyHeld('brake')?1:0,g.brake);input.boost=keyHeld('boost')||g.boost;input.shiftUp=keyHeld('shiftUp')||g.shiftUp;input.shiftDown=keyHeld('shiftDown')||g.shiftDown;}
    else{delete input.steering;readHeld();}
  }
  if(world){
    const driving=state==='driving',session=twoPlayer?localRace:race;
    if(driving){
      const target=twoPlayer?localRace.players[1].car:car,wasImpact=target.impact;
      clock.advance(dt);
      for(const r of twoPlayer?localRace.players:[race])r.car.surfaceFeedback=sampleSurface(r.car);
      const controlled=twoPlayer?localRace.players[1]:race;
      pad.surfaceRumble(g.connected&&controlled.phase==='racing'?target.surfaceFeedback.amount:0,now);
      if(target.impact>wasImpact+.15){pad.rumble(.7,.5,140);pad.nextSurfaceRumble=now+150;}
      if(session.phase==='finished'){finish();pad.rumble(.5,.8,300);}
    }
    if(twoPlayer&&state!=='menu'){
      world.updateSplit(localRace,state==='driving'?dt:0);
      sound.update(localRace.players[0].car,state==='driving'&&localRace.players[0].phase==='racing',localRace.players[0].boosting);
      sound2.update(localRace.players[1].car,state==='driving'&&localRace.players[1].phase==='racing',localRace.players[1].boosting);
      if(now-hudTime>65){updateSplitHud();hudTime=now;}
    }else{
      world.updateRace(race,state!=='menu');world.update(car,state==='driving'||state==='menu'?dt:0,state==='menu');
      sound.update(car,state==='driving'&&race.phase==='racing',race.boosting);sound2.update(localRace.players[1].car,false);
      if(now-hudTime>65){updateHud();hudTime=now;}
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
