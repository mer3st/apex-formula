// Full two-lap race records, separated by circuit and race category.
export function updateRaceBest(race,category){
  if(race.phase!=='finished'||!Number.isFinite(race.finishTime)||race.finishTime<=0)return null;
  const time=Math.round(race.finishTime*1000);
  if(!Number.isSafeInteger(time)||time<=0)return null;
  const circuit=encodeURIComponent(`${race.track.tag||race.track.name||'valle'}:${race.track.length}`);
  const key=`apex-race-best-v1:${circuit}:2-laps:${category}`;
  let previous=null;
  try{
    const value=JSON.parse(localStorage.getItem(key));
    if(Number.isSafeInteger(value)&&value>0)previous=value;
  }catch{}
  const isNew=previous===null||time<previous;
  const best=isNew?time:previous;
  let saved=!isNew;
  if(isNew){try{localStorage.setItem(key,JSON.stringify(best));saved=true;}catch{}}
  return {best,isNew,saved};
}

export function formatRaceRecord(milliseconds){
  const minutes=Math.floor(milliseconds/60000);
  const seconds=Math.floor(milliseconds%60000/1000);
  return `${minutes}:${String(seconds).padStart(2,'0')}.${String(milliseconds%1000).padStart(3,'0')}`;
}
