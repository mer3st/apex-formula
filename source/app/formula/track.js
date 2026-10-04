// Closed circuit geometry shared by driving physics, road rendering and minimap.
const controls = [[0,80],[0,-110],[0,-270],[75,-350],[190,-345],[245,-250],[210,-150],[285,-65],[340,65],[300,175],[175,190],[135,95],[80,20],[55,160],[-55,230],[-120,140],[-95,45]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const spline=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
export function createTrack() {
  const points=[],count=controls.length*40;
  for(let i=0;i<count;i++){
    const u=i/count*controls.length,k=Math.floor(u),t=u-k,n=controls.length;
    const a=controls[(k+n-1)%n],b=controls[k%n],c=controls[(k+1)%n],d=controls[(k+2)%n];
    points.push({x:spline(a[0],b[0],c[0],d[0],t),z:spline(a[1],b[1],c[1],d[1],t)});
  }
  let length=0;
  const segments=points.map((a,i)=>{const b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);const segment={a,b,dx,dz,len,start:length,tx:dx/len,tz:dz/len};length+=len;return segment;});
  const sample=(distance)=>{
    const s=((distance%length)+length)%length;
    let lo=0,hi=segments.length-1;
    while(lo<hi){const mid=(lo+hi+1)>>1;if(segments[mid].start<=s)lo=mid;else hi=mid-1;}
    const q=segments[lo],t=(s-q.start)/q.len;
    return {x:q.a.x+q.dx*t,z:q.a.z+q.dz*t,tx:q.tx,tz:q.tz,nx:-q.tz,nz:q.tx,s,heading:Math.atan2(-q.tx,-q.tz)};
  };
  const nearest=(x,z)=>{
    let best=null,bestD=Infinity;
    for(const q of segments){const t=clamp(((x-q.a.x)*q.dx+(z-q.a.z)*q.dz)/(q.len*q.len),0,1),px=q.a.x+t*q.dx,pz=q.a.z+t*q.dz,d=(x-px)**2+(z-pz)**2;if(d<bestD){bestD=d;best={...sample(q.start+t*q.len),distance:Math.sqrt(d),offset:(x-px)*(-q.tz)+(z-pz)*q.tx};}}
    return best;
  };
  return {name:'VALLE CIRCUIT',points,segments,length,width:14,sample,nearest};
}
export const TRACK=createTrack();
