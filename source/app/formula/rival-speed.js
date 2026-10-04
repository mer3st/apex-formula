import {RACING_LINE} from './racing-line.js';

// Plan backwards from corner limits: spend grip on straight-line braking before
// turn-in. The player guidance keeps its more forgiving braking envelope.
export function createRivalSpeed(line=RACING_LINE,{cornerMargin=1,deceleration=26}={}){
  const speeds=line.points.map(p=>Math.min(84,p.cornerSpeed*cornerMargin));
  for(let lap=0;lap<3;lap++)for(let i=speeds.length-1;i>=0;i--){
    const next=(i+1)%speeds.length;
    speeds[i]=Math.min(speeds[i],Math.sqrt(speeds[next]**2+2*deceleration*line.points[i].length));
  }
  return s=>{
    const u=((s%line.length)+line.length)%line.length/line.step,i=Math.floor(u),t=u-i;
    return speeds[i]*(1-t)+speeds[(i+1)%speeds.length]*t;
  };
}
// The skidpad table uses fixed full lock. The model-based driver follows a
// smoother line; calibrate its target against real full-race asphalt tests.
export const EXPERT_CORNER_FACTOR=1.09;
export const rivalSpeed=createRivalSpeed(RACING_LINE,{cornerMargin:EXPERT_CORNER_FACTOR});
