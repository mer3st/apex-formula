// Gamepad support for APEX FORMULA — works with any HID gamepad, including
// unofficial/clone DualShock 4 controllers whose button layout doesn't match
// the W3C "standard" mapping. A best-effort default is applied immediately
// (works for well-behaved pads with zero setup); a guided calibration wizard
// lets the player teach the game their exact controller in ~15 seconds,
// which overrides the default and is the reliable fix for anything unusual.

const DEADZONE = 0;
const TRIGGER_FLOOR = 0.04;
const MIN_SIGNAL = 0.15; // a capture below this delta from baseline is treated as noise, not a real press
const STORE_KEY = "apex-pad-map-v1";

const STANDARD = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, options: 9 };
const LEGACY_DS4 = { cross: 1, circle: 2, square: 0, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, options: 9 };

function looksLegacy(pad) {
  if (pad.mapping === "standard") return false;
  return pad.buttons.length >= 13 && pad.axes.length >= 4;
}

function prettyPad(id = "") {
  const text = id.toLowerCase();
  if (text.includes("054c") || text.includes("dualsense") || text.includes("dualshock") || text.includes("wireless controller"))
    return "PLAYSTATION PAD";
  if (text.includes("xbox") || text.includes("045e")) return "XBOX PAD";
  const clean = id.split("(")[0].trim();
  return (clean || "GAMEPAD").slice(0, 22).toUpperCase();
}

function buttonValue(pad, index) {
  const b = pad.buttons[index];
  if (!b) return 0;
  return typeof b === "object" ? b.value ?? (b.pressed ? 1 : 0) : b;
}

function buttonHeld(pad, index) {
  const b = pad.buttons[index];
  if (!b) return false;
  return typeof b === "object" ? !!b.pressed || b.value > 0.5 : b > 0.5;
}

// Every raw input source on the pad, flattened to a single indexed list so
// calibration can scan "everything" without caring if it's a button or axis.
function readSources(pad) {
  const out = [];
  for (let i = 0; i < pad.buttons.length; i++) out.push({ kind: "button", index: i, value: buttonValue(pad, i) });
  for (let i = 0; i < pad.axes.length; i++) out.push({ kind: "axis", index: i, value: pad.axes[i] ?? 0 });
  return out;
}

function loadMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!parsed || typeof parsed !== "object" || !parsed.actions) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveMap(map) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch {}
}

// --- Guided calibration -----------------------------------------------
// Sequence: capture a resting baseline, then steer left/right, then one
// "hold" capture per analogue field (throttle/brake), then one "tap"
// capture per digital field. Whichever source moved the most during each
// window is bound to that field — works regardless of the pad's real
// button order or whether triggers report as buttons or axes.
const STEPS = [
  { id: "center", kind: "center", prompt: "Release the controls — wait one second…", ms: 700 },
  { id: "steerRight", kind: "hold", prompt: "Steer RIGHT and hold", ms: 900 },
  { id: "steerLeft", kind: "hold", prompt: "Steer LEFT and hold", ms: 900 },
  { id: "throttle", kind: "hold", prompt: "Hold the THROTTLE control", ms: 900 },
  { id: "brake", kind: "hold", prompt: "Hold the BRAKE control", ms: 900 },
  { id: "boost", kind: "tap", prompt: "Press BOOST / CONFIRM", ms: 1800 },
  { id: "recover", kind: "tap", prompt: "Press RECOVER", ms: 1800 },
  { id: "camera", kind: "tap", prompt: "Press CAMERA", ms: 1800 },
  { id: "pause", kind: "tap", prompt: "Press PAUSE / BACK", ms: 1800 },
  { id: "shiftUp", kind: "tap", prompt: "Press SHIFT UP (or SKIP)", ms: 1800, skippable: true },
  { id: "shiftDown", kind: "tap", prompt: "Press SHIFT DOWN (or SKIP)", ms: 1800, skippable: true },
];

export class Calibrator {
  constructor(pad, handlers = {}) {
    this.pad = pad;
    this.on = handlers;
    this.stepIndex = 0;
    this.stepStart = 0;
    this.baseline = null;
    this.captured = {};
    this.peak = null;
    this.active = true;
    this.phase = "active"; // "active" while capturing, "release" while waiting for quiet
    this.pendingResult = undefined;
    this.releaseStart = 0;
    this.on.onPrompt?.(STEPS[0].prompt, 0, STEPS.length);
  }

  skip() {
    if (this.phase === "active" && STEPS[this.stepIndex]?.skippable) this.beginRelease(null);
  }

  cancel() {
    this.active = false;
    this.on.onCancel?.();
  }

  // Once a step's data is captured, don't advance immediately — a human's
  // press/hold naturally outlasts the exact moment we detected it, and if we
  // moved on right away the still-held button would bleed into the next
  // step's capture. Wait for the pad to go quiet (or a short timeout) first.
  beginRelease(result) {
    this.phase = "release";
    this.pendingResult = result;
    this.releaseStart = 0;
  }

  finishStep(result) {
    const step = STEPS[this.stepIndex];
    if (step.id === "center") this.baseline = result;
    else this.captured[step.id] = result;
    this.stepIndex++;
    if (this.stepIndex >= STEPS.length) return this.finish();
    this.stepStart = 0;
    this.phase = "active";
    this.peak = null;
    this.on.onPrompt?.(STEPS[this.stepIndex].prompt, this.stepIndex, STEPS.length);
  }

  finish() {
    this.active = false;
    const map = { steer: buildSteer(this.baseline, this.captured), actions: {} };
    for (const field of ["throttle", "brake"]) map.actions[field] = buildRange(this.baseline, this.captured[field]);
    for (const field of ["boost", "recover", "camera", "pause", "shiftUp", "shiftDown"])
      if (this.captured[field]) map.actions[field] = buildRange(this.baseline, this.captured[field]);
    saveMap(map);
    this.on.onDone?.(map);
  }

  // Call every animation frame while calibration is active.
  tick(now) {
    if (!this.active) return;
    const list = this.pad.pads();
    const raw = readSources(list[0] || { buttons: [], axes: [] });

    if (this.phase === "release") {
      if (!this.releaseStart) this.releaseStart = now;
      const quiet = raw.every((s) => Math.abs(s.value - baseOf(this.baseline, s)) < 0.3);
      if (quiet || now - this.releaseStart >= 1200) this.finishStep(this.pendingResult);
      return;
    }

    if (!this.stepStart) this.stepStart = now;
    const elapsed = now - this.stepStart;
    const step = STEPS[this.stepIndex];

    if (step.kind === "center") {
      if (elapsed >= step.ms) this.finishStep(raw);
      return;
    }

    if (step.kind === "hold") {
      this.peak = furthestFrom(this.baseline, raw, this.peak);
      if (elapsed >= step.ms) {
        const captured = this.peak;
        this.peak = null;
        this.beginRelease(captured);
      }
      return;
    }

    if (step.kind === "tap") {
      const hit = firstBeyondThreshold(this.baseline, raw, 0.5);
      if (hit) return this.beginRelease(hit);
      if (elapsed >= step.ms) this.beginRelease(null); // no press seen — leave unbound
    }
  }
}

function furthestFrom(baseline, raw, currentBest) {
  let best = currentBest;
  let bestDelta = best ? Math.abs(best.value - baseOf(baseline, best)) : -1;
  for (const s of raw) {
    const delta = Math.abs(s.value - baseOf(baseline, s));
    if (delta > bestDelta) {
      bestDelta = delta;
      best = s;
    }
  }
  return best;
}

function firstBeyondThreshold(baseline, raw, threshold) {
  for (const s of raw) if (Math.abs(s.value - baseOf(baseline, s)) > threshold) return s;
  return null;
}

function baseOf(baseline, source) {
  if (!source) return 0;
  return baseline?.find((b) => b.kind === source.kind && b.index === source.index)?.value ?? 0;
}

function buildSteer(baseline, captured) {
  const right = captured.steerRight;
  const left = captured.steerLeft;
  const rightOk = right && Math.abs(right.value - baseOf(baseline, right)) >= MIN_SIGNAL;
  const leftOk = left && Math.abs(left.value - baseOf(baseline, left)) >= MIN_SIGNAL;
  const src = rightOk ? right : leftOk ? left : null;
  if (!src) return null; // neither direction produced a real signal — leave steering unbound rather than guess from noise
  const center = baseOf(baseline, src);
  const rightVal = rightOk ? right.value : center + (center - (left?.value ?? center));
  const leftVal = leftOk ? left.value : center - (rightVal - center);
  return { kind: src.kind, index: src.index, center, rightVal, leftVal };
}

function buildRange(baseline, captured) {
  if (!captured) return null;
  const base = baseOf(baseline, captured);
  if (Math.abs(captured.value - base) < MIN_SIGNAL) return null; // too weak to be a real press — leave unbound
  return { kind: captured.kind, index: captured.index, base, peak: captured.value };
}

function readMapped(pad, desc) {
  if (!desc) return 0;
  return desc.kind === "button" ? buttonValue(pad, desc.index) : pad.axes[desc.index] ?? 0;
}

function analogValue(pad, desc) {
  if (!desc) return 0;
  const raw = readMapped(pad, desc);
  const span = desc.peak - desc.base;
  if (Math.abs(span) < 0.05) return 0;
  const t = Math.max(0, Math.min(1, (raw - desc.base) / span));
  return t < TRIGGER_FLOOR ? 0 : t;
}

function digitalHeld(pad, desc) {
  if (!desc) return false;
  const raw = readMapped(pad, desc);
  const span = desc.peak - desc.base;
  if (Math.abs(span) < 0.05) return false;
  return (raw - desc.base) / span > 0.5;
}

function steerValue(pad, desc) {
  if (!desc) return 0;
  const raw = desc.kind === "button" ? buttonValue(pad, desc.index) : pad.axes[desc.index] ?? 0;
  let t = 0;
  if ((raw - desc.center) * (desc.rightVal - desc.center) >= 0) {
    const span = desc.rightVal - desc.center;
    t = Math.abs(span) < 0.05 ? 0 : (raw - desc.center) / span;
  } else {
    const span = desc.center - desc.leftVal;
    t = Math.abs(span) < 0.05 ? 0 : -(desc.center - raw) / span;
  }
  t = Math.max(-1, Math.min(1, t));
  return Math.abs(t) < DEADZONE ? 0 : t;
}

function defaultSteer(pad) {
  const rawX = pad.axes[0] ?? 0;
  const v = Math.abs(rawX) < DEADZONE ? 0 : Math.max(-1, Math.min(1, rawX));
  return v;
}

function defaultTrigger(pad, index) {
  const v = buttonValue(pad, index);
  return v < TRIGGER_FLOOR ? 0 : v;
}

export class GamepadInput {
  constructor(handlers = {}) {
    this.on = handlers;
    this.connected = false;
    this.name = "";
    this.available = typeof navigator !== "undefined" && !!navigator.getGamepads;
    this.wasHeld = new Set();
    this.customMap = loadMap();
    this.calibrator = null;
    this.settingsOpen = false;
    this.capture = null;
    this.settings = { sensitivity: 1.25, deadzone: .08, invert: false };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('apex-controls-v2')) || {}); } catch {}
    if (typeof window !== "undefined") {
      window.addEventListener("gamepadconnected", (e) => {
        this.connected = true;
        this.name = prettyPad(e.gamepad?.id || "");
        this.on.onConnect?.(this.name);
      });
      window.addEventListener("gamepaddisconnected", () => {
        if (!this.pads().length) {
          this.connected = false;
          this.wasHeld.clear();
          this.on.onDisconnect?.();
        }
      });
    }
  }

  pads() {
    try {
      return [...(navigator.getGamepads?.() || [])].filter(Boolean);
    } catch {
      return [];
    }
  }

  hasCustomMap() {
    return !!this.customMap;
  }

  saveSettings() {
    try { localStorage.setItem('apex-controls-v2', JSON.stringify(this.settings)); } catch {}
  }

  bind(field, done) {
    const raw = this.pads()[0];
    if (!raw) return false;
    this.capture = { field, done, baseline: readSources(raw), ready: false };
    return true;
  }

  captureTick(pad, now) {
    const c = this.capture;
    if (!c) return;
    const raw = readSources(pad);
    if (!c.started) c.started = now;
    // First wait for a quiet controller; never advance on a capture timeout.
    if (!c.ready) {
      if (raw.some(s => Math.abs(s.value-baseOf(c.baseline,s)) > .12)) c.started=now;
      c.baseline=raw;
      if (now-c.started>500) c.ready=true;
      return;
    }
    const hit = raw.find(s => (c.field!=='steer'||s.kind==='axis') && Math.abs(s.value-baseOf(c.baseline,s))>.65);
    if (!hit) return;
    const map=this.customMap || {steer:null,actions:{}};
    if(c.field==='steer') {
      const center=baseOf(c.baseline,hit),sign=Math.sign(hit.value-center);
      map.steer={kind:hit.kind,index:hit.index,center,rightVal:sign,leftVal:-sign};
    } else {
      const desc=buildRange(c.baseline,hit);
      // Use the full physical range rather than the first partial trigger press.
      desc.peak=hit.kind==='button'?1:Math.sign(hit.value-desc.base);
      map.actions[c.field]=desc;
    }
    this.customMap=map;saveMap(map);this.capture=null;c.done?.();
  }

  startCalibration(handlers) {
    if (this.calibrator) return false;
    const pad = this.pads()[0];
    if (!pad) return false;
    this.calibrator = new Calibrator(this, {
      ...handlers,
      onDone: (map) => {
        this.customMap = map;
        this.calibrator = null;
        handlers.onDone?.(map);
      },
      onCancel: () => {
        this.calibrator = null;
        handlers.onCancel?.();
      },
    });
    return true;
  }

  cancelCalibration() {
    this.calibrator?.cancel();
  }

  skipCalibrationStep() {
    this.calibrator?.skip();
  }

  clearCustomMap() {
    this.customMap = null;
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {}
  }

  // Called once per animation frame. Returns the continuous driving state,
  // and fires discrete onAction() calls for menu keys.
  poll(now) {
    if (!this.available) return { connected: false };
    const pad = this.pads()[0];
    if (!pad) {
      this.capture=null;
      if (this.connected) {
        this.connected = false;
        this.wasHeld.clear();
        if (this.calibrator) {
          this.calibrator.active = false;
          this.calibrator = null;
          this.on.onCalibrationInterrupted?.();
        }
        this.on.onDisconnect?.();
      }
      return { connected: false };
    }
    if (!this.connected) {
      this.connected = true;
      this.name = prettyPad(pad.id || "");
      this.on.onConnect?.(this.name);
    }

    if (this.calibrator) {
      this.calibrator.tick(now);
      return { connected: true, steering: 0, throttle: 0, brake: 0, boost: false, shiftUp: false, shiftDown: false, calibrating: true };
    }

    if(this.settingsOpen) this.captureTick(pad,now);
    const action=this.on.onAction;
    if(this.settingsOpen) this.on.onAction=undefined;
    let result;
    try { result=this.customMap?this.pollCustom(pad):this.pollDefault(pad); }
    finally { this.on.onAction=action; }
    const zone=Math.max(0,Math.min(.3,Number(this.settings.deadzone)||0));
    const raw=result.steering,amount=Math.max(0,(Math.abs(raw)-zone)/(1-zone));
    result.steering=Math.sign(raw)*Math.min(1,amount*(Number(this.settings.sensitivity)||1))*(this.settings.invert?-1:1);
    return result;
  }

  pollCustom(pad) {
    const m = this.customMap;
    const dmap = looksLegacy(pad) ? LEGACY_DS4 : STANDARD;
    const steering = m.steer ? steerValue(pad, m.steer) : defaultSteer(pad);
    const throttle = m.actions.throttle ? analogValue(pad, m.actions.throttle) : defaultTrigger(pad, dmap.r2);
    const brake = m.actions.brake ? analogValue(pad, m.actions.brake) : defaultTrigger(pad, dmap.l2);
    const held = new Set();
    const fieldButton = { boost: "cross", recover: "square", camera: "triangle", pause: "options", shiftUp: "r1", shiftDown: "l1" };
    for (const field of ["boost", "recover", "camera", "pause", "shiftUp", "shiftDown"]) {
      const isHeld = m.actions[field] ? digitalHeld(pad, m.actions[field]) : buttonHeld(pad, dmap[fieldButton[field]]);
      if (isHeld) held.add(field);
    }
    const pressed = (name) => held.has(name) && !this.wasHeld.has(name);
    // Boost doubles as menu "confirm" (start/resume), matching the default
    // mapping's Cross button, which also serves both roles.
    if (pressed("boost")) this.on.onAction?.("confirm");
    if (pressed("recover")) this.on.onAction?.("recover");
    if (pressed("camera")) this.on.onAction?.("camera");
    if (pressed("pause")) this.on.onAction?.("back");
    this.wasHeld = held;
    return {
      connected: true,
      steering,
      throttle,
      brake,
      boost: held.has("boost"),
      shiftUp: held.has("shiftUp"),
      shiftDown: held.has("shiftDown"),
    };
  }

  pollDefault(pad) {
    const map = looksLegacy(pad) ? LEGACY_DS4 : STANDARD;
    const rawX = pad.axes[0] ?? 0;
    const steering = Math.abs(rawX) < DEADZONE ? 0 : Math.max(-1, Math.min(1, rawX));
    let throttle = buttonValue(pad, map.r2);
    let brake = buttonValue(pad, map.l2);
    if (throttle < TRIGGER_FLOOR) throttle = 0;
    if (brake < TRIGGER_FLOOR) brake = 0;

    const held = new Set();
    for (const [name, index] of Object.entries(map)) if (buttonHeld(pad, index)) held.add(name);
    const pressed = (name) => held.has(name) && !this.wasHeld.has(name);
    if (pressed("cross")) this.on.onAction?.("confirm");
    if (pressed("circle")) this.on.onAction?.("back");
    if (pressed("triangle")) this.on.onAction?.("camera");
    if (pressed("square")) this.on.onAction?.("recover");
    if (pressed("options")) this.on.onAction?.("menu");
    this.wasHeld = held;

    return {
      connected: true,
      steering,
      throttle,
      brake,
      boost: held.has("cross"),
      shiftUp: held.has("r1"),
      shiftDown: held.has("l1"),
    };
  }

  async rumble(strong = 0.55, weak = 0.3, duration = 160) {
    const pad=this.pads()[0];
    if(!pad)return {ok:false,message:'No gamepad detected. Connect it and press any button.'};
    const sony=pad.id?.match(/Vendor: 054c Product: (09cc|05c4)/i);
    if(sony&&globalThis.APEX_RUMBLE){
      const result=await globalThis.APEX_RUMBLE.play(parseInt(sony[1],16),strong,weak,duration).catch(()=>({ok:false,message:'The Windows vibration service is unavailable.'}));
      // USB DS4s and other platforms keep the normal Gamepad API path.
      if(result.ok||!result.message?.includes('NO_BLUETOOTH_DS4'))return result;
    }
    const actuator=[pad.vibrationActuator,...(pad.hapticActuators||[])].find(a=>a&&(typeof a.playEffect==='function'||typeof a.pulse==='function'));
    if(!actuator)return {ok:false,message:'Controls work, but vibration is unavailable over this connection. Try a USB cable.'};
    try{
      this.rumbleActuator=actuator;
      const result=await (actuator.playEffect?actuator.playEffect('dual-rumble',{startDelay:0,duration,strongMagnitude:strong,weakMagnitude:weak}):actuator.pulse(Math.max(strong,weak),duration));
      return result==='preempted'||result===false?{ok:false,message:'Vibration was interrupted. Keep the game focused and try again.'}:{ok:true,message:'Vibration signal sent. Did you feel it?'};
    }catch(error){return {ok:false,message:`Vibration unavailable: ${error.name||'Error'}. Try a USB cable.`};}
  }

  stopRumble(){
    globalThis.APEX_RUMBLE?.stop().catch(()=>{});
    try{Promise.resolve(this.rumbleActuator?.reset?.()).catch(()=>{});}catch{}
    this.surfaceRumbling=false;this.nextSurfaceRumble=0;
  }

  surfaceRumble(amount,now){
    if(!amount){if(this.surfaceRumbling)this.stopRumble();return;}
    if(now<(this.nextSurfaceRumble||0))return;
    this.surfaceRumbling=true;this.nextSurfaceRumble=now+90;
    this.rumble(Math.min(.75,.2+amount*.65),Math.min(.95,.25+amount*.7),150);
  }
}
