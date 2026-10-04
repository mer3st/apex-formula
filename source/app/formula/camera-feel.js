const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const blend=(from,to,rate,dt)=>from+(to-from)*(1-Math.exp(-rate*dt));

// Store only relative motion. Filtering world positions leaves a fast car metres
// ahead of its camera and makes the car shrink as it accelerates.
export function cameraFeel(state,car,dt,{snap=false,boosting=false}={}){
  const surge=clamp(car.longAccel/18,-1,1);
  if(snap||state.heading===undefined){
    state.heading=car.heading;state.surge=surge;
    state.boost=boosting?1:0;state.speedFov=clamp((car.speed-10)*.18,0,11);
  }
  const delta=Math.atan2(Math.sin(car.heading-state.heading),Math.cos(car.heading-state.heading));
  state.heading+=delta*(1-Math.exp(-18*dt));
  state.surge=blend(state.surge,surge,7,dt);
  state.boost=blend(state.boost,boosting?1:0,boosting?7:4,dt);
  state.speedFov=blend(state.speedFov,clamp((car.speed-10)*.18,0,11),5,dt);
  return state;
}
