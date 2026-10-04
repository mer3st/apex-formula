// Tyre contact patches match car.js, including the outer tyre edge.
export function sampleSurface(car){
  const c=Math.cos(car.heading),s=Math.sin(car.heading),half=car.track.width/2;
  let wheels=0,depth=0;
  for(const z of [-1.65,1.58])for(const side of [-1,1]){
    const x=side*(1.04+(z>0?.43:.35)/2);
    const d=car.track.nearest(car.x+x*c+z*s,car.z-x*s+z*c).distance-half;
    if(d>0){wheels++;depth+=Math.min(1,d/.6);}
  }
  const motion=Math.min(1,Math.abs(car.speed)/25);
  return {wheels,amount:wheels&&car.speed>.3?(.18+depth*.12+wheels*.06)*motion:0};
}
