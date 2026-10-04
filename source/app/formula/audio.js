const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export class EngineAudio{
  constructor(){this.enabled=true;this.volume=1;this.lastThrottle=0;this.lastGear=0;this.nextPop=0;this.wasPlaying=false;}
  setVolume(value){
    if(!Number.isFinite(value))return;
    this.volume=clamp(value,0,1);
    if(this.output)this.output.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.025);
  }
  silence(){
    if(!this.ctx)return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.012);
    this.wasPlaying=false;
  }
  start(){
    if(!this.ctx){
      this.ctx=new AudioContext();
      this.master=this.ctx.createGain();this.master.gain.value=0;
      const limiter=this.ctx.createDynamicsCompressor();
      limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=4;
      limiter.attack.value=.004;limiter.release.value=.12;
      this.output=this.ctx.createGain();this.output.gain.value=this.volume;
      this.master.connect(limiter);limiter.connect(this.output);this.output.connect(this.ctx.destination);
      this.gain=this.ctx.createGain();this.gain.gain.value=0;this.gain.connect(this.master);
      this.filter=this.ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.Q.value=.55;this.filter.connect(this.gain);
      // A band-limited harmonic engine avoids the thin, harsh sawtooth note.
      this.osc=this.ctx.createOscillator();
      this.osc.setPeriodicWave(this.ctx.createPeriodicWave(new Float32Array(9),new Float32Array([0,1,.48,.3,.18,.12,.07,.04,.02])));
      this.osc.connect(this.filter);this.osc.start();
      this.sub=this.ctx.createOscillator();this.sub.type='triangle';
      const subGain=this.ctx.createGain();subGain.gain.value=.32;
      this.sub.connect(subGain);subGain.connect(this.gain);this.sub.start();
      const noise=this.ctx.createBufferSource();noise.buffer=this.noiseBuffer();noise.loop=true;noise.start();
      const layer=(type,frequency,q)=>{
        const filter=this.ctx.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;
        const gain=this.ctx.createGain();gain.gain.value=0;
        noise.connect(filter);filter.connect(gain);gain.connect(this.master);return {filter,gain};
      };
      this.wind=layer('lowpass',700,.5);
      this.tyres=layer('bandpass',1450,1.1);
      this.road=layer('lowpass',600,.6);
      this.boost=layer('bandpass',1100,1.8);
      this.turbo=this.ctx.createOscillator();this.turbo.type='sine';
      this.turboGain=this.ctx.createGain();this.turboGain.gain.value=0;
      this.turbo.connect(this.turboGain);this.turboGain.connect(this.master);this.turbo.start();
    }
    this.ctx.resume().catch(()=>{});
  }
  noiseBuffer(){
    if(!this._noise){
      const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate),data=buffer.getChannelData(0);let seed=421;
      for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/4294967296*2-1;}
      this._noise=buffer;
    }
    return this._noise;
  }
  burst(strength,frequency,duration){
    const src=this.ctx.createBufferSource();src.buffer=this.noiseBuffer();
    const band=this.ctx.createBiquadFilter();band.type='bandpass';band.frequency.value=frequency;band.Q.value=1.1;
    const env=this.ctx.createGain(),now=this.ctx.currentTime;
    env.gain.setValueAtTime(0,now);env.gain.linearRampToValueAtTime(strength,now+.006);
    env.gain.exponentialRampToValueAtTime(.0001,now+duration);
    src.connect(band);band.connect(env);env.connect(this.master);
    src.start(now);src.stop(now+duration+.02);
    src.onended=()=>{src.disconnect();band.disconnect();env.disconnect();};
  }
  update(car,playing,boosting=false){
    if(!this.ctx)return;
    const now=this.ctx.currentTime,active=this.enabled&&playing;
    const set=(param,value,lag=.035)=>param.setTargetAtTime(value,now,lag);
    set(this.master.gain,active?.8:0,.015);
    const speed=clamp(car.speed/80,0,1),rough=car.surfaceFeedback?.amount||0;
    set(this.osc.frequency,car.rpm/30,.018);set(this.sub.frequency,car.rpm/90,.02);
    set(this.filter.frequency,850+car.throttle*1900+speed*400);
    set(this.gain.gain,active?(.035+car.throttle*.065)*(car.shiftTimer>0?.4:1):0,.02);
    set(this.wind.filter.frequency,350+speed*1600);
    set(this.wind.gain.gain,active?speed*speed*.12:0,.09);
    set(this.tyres.gain.gain,active&&car.speed>8?clamp(car.slip-.18,0,1)*.09+Math.min(car.brake*.008,speed*.008):0);
    set(this.road.filter.frequency,280+Math.min(60,car.speed)*22);
    set(this.road.gain.gain,active?rough*(.1+.025*Math.sin(now*(16+car.speed*.7))):0,.025);
    set(this.boost.filter.frequency,900+speed*1800,.08);
    set(this.boost.gain.gain,active&&boosting?.09:0,.045);
    set(this.turbo.frequency,650+speed*1250,.08);
    set(this.turboGain.gain,active&&boosting?.018:0,.06);
    if(active&&this.wasPlaying){
      if(car.gear!==this.lastGear&&car.speed>10)this.burst(.07,car.gear>this.lastGear?220:420,.07);
      const liftRate=(this.lastThrottle-car.throttle)/Math.max(1/240,now-(this.lastAudioTime??now));
      if(now>=this.nextPop&&liftRate>3&&car.rpm>8200&&car.speed>15){
        this.burst(.025,1100,.12);this.nextPop=now+.22;
      }
    }
    this.lastThrottle=car.throttle;this.lastGear=car.gear;this.lastAudioTime=now;this.wasPlaying=active;
  }
}
