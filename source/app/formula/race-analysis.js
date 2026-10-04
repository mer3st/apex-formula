// Race telemetry uses simulation time: pauses and rendering rate cannot inflate it.
export class RaceAnalysis{
  constructor(race){
    this.bestLap=null;this.lapTimes=[];this.maxSpeed=0;this.overtakes=0;this.offTrackExits=0;
    this.previousProgress=race.progress;this.previousTime=race.time;this.nextLine=63;this.lapStart=null;
    this.outside=false;this.onTrackTime=0;this.opponents=new Map();
  }
  update(race,dt){
    const {car,progress,time,track}=race;
    this.maxSpeed=Math.max(this.maxSpeed,Number.isFinite(car.speed)?Math.max(0,car.speed)*3.6:0);
    if(car.offTrack){
      if(!this.outside)this.offTrackExits++;
      this.outside=true;this.onTrackTime=0;
    }else if(this.outside){
      this.onTrackTime+=dt;
      if(this.onTrackTime>=.3){this.outside=false;this.onTrackTime=0;}
    }
    // Interpolate crossings within a physics tick; reverse crossings never add laps.
    if(progress>this.previousProgress){
      while(progress>=this.nextLine&&this.nextLine<=race.finishDistance){
        const completed=Math.round((this.nextLine-63)/track.length);
        if(completed>0&&race.checkpoints<completed*4)break;
        const fraction=Math.max(0,Math.min(1,(this.nextLine-this.previousProgress)/(progress-this.previousProgress)));
        const crossing=this.previousTime+(time-this.previousTime)*fraction;
        if(this.lapStart!==null){
          const duration=crossing-this.lapStart;
          if(duration>0){this.lapTimes.push(duration);this.bestLap=this.bestLap===null?duration:Math.min(this.bestLap,duration);}
        }
        this.lapStart=crossing;this.nextLine+=track.length;
      }
    }
    this.previousProgress=progress;this.previousTime=time;
  }
  seedOpponents(race,opponents){
    this.opponents.clear();
    for(const opponent of opponents)this.opponents.set(opponent.id,{behind:opponent.progress-race.progress>=3,progress:race.progress});
  }
  updateOpponents(race,opponents){
    for(const opponent of opponents){
      const previous=this.opponents.get(opponent.id)||{behind:false,progress:race.progress};
      const gap=opponent.progress-race.progress;
      if(race.car.offTrack||opponent.finished){previous.behind=false;}
      else if(gap>=3&&gap<race.track.length/2){previous.behind=true;}
      else if(gap<=-3&&previous.behind){
        if(race.progress>previous.progress&&gap>-race.track.length/2)this.overtakes++;
        previous.behind=false;
      }
      previous.progress=race.progress;this.opponents.set(opponent.id,previous);
    }
  }
}

export function showRaceAnalysis(container,entries,formatTime){
  let panel=container.querySelector('#race-analysis');
  if(!panel){panel=document.createElement('section');panel.id='race-analysis';panel.lang='uz';container.querySelector('#result-order').after(panel);}
  panel.replaceChildren();
  const heading=document.createElement('h3');heading.textContent='Poyga tahlili';panel.append(heading);
  for(const {label,analysis} of entries){
    const group=document.createElement('div');group.className='analysis-player';
    if(entries.length>1){const name=document.createElement('h4');name.textContent=label;group.append(name);}
    const list=document.createElement('dl');
    const items=[['Eng tez aylana',analysis.bestLap===null?'—':formatTime(Math.round(analysis.bestLap*1000))],['Maksimal tezlik',`${Math.round(analysis.maxSpeed)} km/h`],['Quvib o‘tishlar',String(analysis.overtakes)],['Trekdan chiqishlar',String(analysis.offTrackExits)]];
    for(const [label,value] of items){const item=document.createElement('div'),term=document.createElement('dt'),data=document.createElement('dd');term.textContent=label;data.textContent=value;item.append(term,data);list.append(item);}
    group.append(list);panel.append(group);
  }
}
