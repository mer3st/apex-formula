export function mountControllerSettings(pad, pause) {
  const dialog=document.createElement('dialog');
  dialog.id='controller-settings';dialog.setAttribute('aria-label','Controller settings');
  const fields=[['steer','Steering','Left stick'],['throttle','Throttle','RT / R2'],['brake','Brake','LT / L2'],['boost','Boost / Confirm','A / ×'],['recover','Recover','X / □'],['camera','Camera','Y / △'],['pause','Pause','Menu / Options'],['shiftUp','Shift up','RB / R1'],['shiftDown','Shift down','LB / L1']];
  dialog.innerHTML=`<header><div><small>YOUR CONTROLS</small><h2>Controller settings</h2></div><button id="controls-close" aria-label="Close">✕</button></header>
  <p id="controls-device"></p><p>Plug in a gamepad and press a button. Remap only if you need to.</p>
  <label>Steering sensitivity <output id="sensitivity-value"></output><input id="control-sensitivity" type="range" min="70" max="180" step="5"></label>
  <label>Stick deadzone <output id="deadzone-value"></output><input id="control-deadzone" type="range" min="0" max="30" step="1"></label>
  <label class="invert"><input id="control-invert" type="checkbox"> Invert steering</label>
  <div class="control-preview"><span>STEERING <meter id="preview-steer" min="-1" max="1" value="0"></meter></span><span>THROTTLE <meter id="preview-gas" min="0" max="1"></meter></span><span>BRAKE <meter id="preview-brake" min="0" max="1"></meter></span></div>
  <p id="binding-status" role="status">Choose an action, then press a button on your gamepad.</p>
  <div class="control-bindings">${fields.map(([id,label])=>`<button data-bind="${id}"><span>${label}</span><b></b></button>`).join('')}</div>
  <footer><button id="binding-cancel" hidden>Cancel remapping</button><button id="controls-reset">Restore defaults</button><button id="controls-done" class="primary">DONE</button></footer>`;
  document.body.append(dialog);
  const vibration=document.createElement('div');
  vibration.innerHTML='<button type="button" class="secondary" id="vibration-test">TEST VIBRATION</button><p id="vibration-status" role="status">Test your gamepad vibration for one second.</p>';
  dialog.querySelector('.control-preview').after(vibration);
  const $=id=>dialog.querySelector('#'+id),status=$('binding-status');
  function refresh(){
    $('control-sensitivity').value=pad.settings.sensitivity*100;
    $('sensitivity-value').textContent=Math.round(pad.settings.sensitivity*100)+'%';
    $('control-deadzone').value=pad.settings.deadzone*100;
    $('deadzone-value').textContent=Math.round(pad.settings.deadzone*100)+'%';
    $('control-invert').checked=pad.settings.invert;
    for(const [id,,fallback] of fields){
      const desc=id==='steer'?pad.customMap?.steer:pad.customMap?.actions[id];
      dialog.querySelector(`[data-bind="${id}"] b`).textContent=desc?`${desc.kind==='axis'?'Axis':'Button'} ${desc.index+1}`:fallback;
    }
  }
  function cancel(){pad.capture=null;$('binding-cancel').hidden=true;status.textContent='Choose an action, then press a button on your gamepad.';}
  function close(){pad.stopRumble();cancel();dialog.close();pad.settingsOpen=false;}
  $('vibration-test').onclick=async()=>{
    $('vibration-test').disabled=true;
    $('vibration-status').textContent='Testing vibration…';
    const result=await pad.rumble(.85,.85,1000);
    $('vibration-status').textContent=result.message;
    $('vibration-test').disabled=false;
  };
  dialog.addEventListener('cancel',e=>{e.preventDefault();if(pad.capture)cancel();else close();});
  dialog.addEventListener('keydown',e=>e.stopPropagation());
  $('controls-close').onclick=$('controls-done').onclick=close;
  $('binding-cancel').onclick=cancel;
  $('control-sensitivity').oninput=e=>{pad.settings.sensitivity=Number(e.target.value)/100;pad.saveSettings();refresh();};
  $('control-deadzone').oninput=e=>{pad.settings.deadzone=Number(e.target.value)/100;pad.saveSettings();refresh();};
  $('control-invert').onchange=e=>{pad.settings.invert=e.target.checked;pad.saveSettings();};
  $('controls-reset').onclick=()=>{cancel();pad.clearCustomMap();pad.settings={sensitivity:1.25,deadzone:.08,invert:false};pad.saveSettings();refresh();};
  for(const button of dialog.querySelectorAll('[data-bind]'))button.onclick=()=>{
    const field=button.dataset.bind;
    if(!pad.bind(field,()=>{refresh();$('binding-cancel').hidden=true;status.textContent='Saved. You can remap another action.';})){
      status.textContent='Connect a gamepad and press any button first.';return;
    }
    $('binding-cancel').hidden=false;
    status.textContent=field==='steer'?'Release the stick. Wait one second, then push it fully RIGHT.':'Release all buttons. Wait one second, then press the button you want.';
  };
  return {
    open(){pause();cancel();pad.settingsOpen=true;refresh();dialog.showModal();},
    update(g){if(!dialog.open)return;
      $('controls-device').textContent=g.connected?`${pad.name} — CONNECTED`:'Connect a gamepad and press any button.';
      $('preview-steer').value=g.steering||0;$('preview-gas').value=g.throttle||0;$('preview-brake').value=g.brake||0;
      if(!g.connected){cancel();status.textContent='No gamepad connected. Your settings are saved.';}
    }
  };
}
