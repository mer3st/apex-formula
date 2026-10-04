import {clamp,steeringLock} from './physics.js';

// Invert the bicycle model's front/rear tyre response to request the lateral
// acceleration needed for the upcoming path. This only produces a steering
// input; FormulaCar still applies the same rack, tyre and grip limits.
export function expertSteering(car,target){
  const speed=car.speed;
  const travel=speed>3?Math.atan2(-car.vx,-car.vz):car.heading;
  const bearing=Math.atan2(-(target.x-car.x),-(target.z-car.z));
  const alpha=Math.atan2(Math.sin(bearing-travel),Math.cos(bearing-travel));
  if(speed<8)return clamp(-alpha*6*3.5/Math.max(7,speed)/steeringLock(speed,car.offTrack),-1,1);
  const curvature=-2*Math.sin(alpha)/Math.max(3,Math.hypot(target.x-car.x,target.z-car.z));
  const sideways=car.vx*Math.cos(car.heading)-car.vz*Math.sin(car.heading);
  const rearSlip=-Math.atan2(sideways+car.yawRate*1.65,Math.max(6,speed));
  const normal=800*9.81+2.9*speed*speed;
  const rearGrip=normal*1.85/3.5*1.95,frontGrip=normal*1.65/3.5*1.95;
  const rearForce=rearGrip*Math.tanh(rearSlip*95000/rearGrip);
  const frontForce=800*speed*speed*curvature-rearForce;
  const desiredAngle=Math.atanh(clamp(frontForce/frontGrip,-.95,.95))*frontGrip/85000+
    Math.atan2(sideways-car.yawRate*1.85,Math.max(6,speed));
  return clamp(desiredAngle/steeringLock(speed,car.offTrack),-1,1);
}
