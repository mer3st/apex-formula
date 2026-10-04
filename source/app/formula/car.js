import * as T from '../street/vendor/three.module.js';
// Original procedural AF-02 model. Textures are generated locally and shared.
let cachedMaps;
function surfaceMaps(){
  if(cachedMaps)return cachedMaps;
  const canvas=(size,draw)=>{const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t;};
  const carbon=canvas(256,(ctx,n)=>{ctx.fillStyle='#171a1d';ctx.fillRect(0,0,n,n);for(let y=0;y<n;y+=8)for(let x=0;x<n;x+=8){const horizontal=((x+y)/8)%4<2;ctx.fillStyle=horizontal?'#363a3d':'#202428';ctx.fillRect(x,y,8,8);ctx.strokeStyle=horizontal?'#45494c':'#2e3235';ctx.lineWidth=.6;for(let i=1;i<8;i+=2){ctx.beginPath();ctx.moveTo(x+(horizontal?0:i),y+(horizontal?i:0));ctx.lineTo(x+(horizontal?8:i),y+(horizontal?i:8));ctx.stroke();}}});carbon.repeat.set(5,5);
  const rubber=canvas(512,(ctx,n)=>{ctx.fillStyle='#666';ctx.fillRect(0,0,n,n);let seed=721;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);for(let i=0;i<7000;i++){const v=75+Math.floor(rand()*95);ctx.strokeStyle=`rgba(${v},${v},${v},.35)`;const x=rand()*n,y=rand()*n;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*35+3,y+rand()*1.5);ctx.stroke();}});
  const sidewall=canvas(512,(ctx,n)=>{ctx.clearRect(0,0,n,n);ctx.translate(n/2,n/2);ctx.strokeStyle='#eb2032';ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,0,214,0,Math.PI*2);ctx.stroke();const arcText=(text,angle)=>{ctx.font='italic bold 35px Arial';ctx.fillStyle='#f02b3b';ctx.textAlign='center';ctx.textBaseline='middle';for(let i=0;i<text.length;i++){ctx.save();ctx.rotate(angle+(i-(text.length-1)/2)*.14);ctx.fillText(text[i],0,-184);ctx.restore();}};arcText('APEX',0);arcText('P ZERO',Math.PI);ctx.fillStyle='#aeb1b4';ctx.font='12px Arial';ctx.fillText('AF / SOFT',-163,5);ctx.fillText('18',163,5);});
  cachedMaps={carbon,rubber,sidewall};return cachedMaps;
}
export function makeFormulaCar(){
  const car=new T.Group();car.name='AF-02';
  const paint=new T.MeshPhysicalMaterial({color:'#737b84',metalness:.86,roughness:.3,clearcoat:1,clearcoatRoughness:.18});paint.name='body-paint';
  const maps=surfaceMaps();
  const carbon=new T.MeshPhysicalMaterial({color:'#73777c',map:maps.carbon,metalness:.4,roughness:.39,clearcoat:.35}),rubber=new T.MeshStandardMaterial({color:'#353638',map:maps.rubber,bumpMap:maps.rubber,bumpScale:.002,roughness:.92});
  const alloy=new T.MeshStandardMaterial({color:'#7d8b92',metalness:.93,roughness:.26}),lime=new T.MeshPhysicalMaterial({color:'#db071c',metalness:.35,roughness:.26,clearcoat:1});
  const black=new T.MeshStandardMaterial({color:'#07090c',roughness:.65});
  const white=new T.MeshPhysicalMaterial({color:'#e6e8dd',metalness:.25,roughness:.24,clearcoat:1});
  const add=(geometry,material,x=0,y=0,z=0,parent=car)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=!material.transparent;m.receiveShadow=true;parent.add(m);return m;};
  const box=(w,h,d,x,y,z,m=carbon,parent=car)=>add(new T.BoxGeometry(w,h,d),m,x,y,z,parent);
  const rod=(a,b,r,m=carbon,parent=car)=>{const start=new T.Vector3(...a),end=new T.Vector3(...b),v=end.clone().sub(start);const mesh=add(new T.CylinderGeometry(r,r,v.length(),12),m,0,0,0,parent);mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return mesh;};
  const tube=(points,r,material=carbon,parent=car)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(12,points.length*6),r,8,false),material,0,0,0,parent);
  // Interpolated sections give continuous highlights along the nose and sidepods.
  const body=(sections,material=paint)=>{
    const curves=[1,2,3].map(k=>new T.CatmullRomCurve3(sections.map(s=>new T.Vector3(s[0],s[k],0)),false,'catmullrom',.25));
    const rows=(sections.length-1)*5;sections=Array.from({length:rows+1},(_,i)=>{const [w,b,t]=curves.map(c=>c.getPoint(i/rows));return [w.x,w.y,b.y,t.y];});
    const pts=[],ids=[],uv=[],steps=40,stride=steps+1;
    // Duplicate the UV seam without blending the end-cap normals into the skin.
    for(const [j,[z,w,b,t]]of sections.entries())for(let i=0;i<=steps;i++){const a=i/steps*Math.PI*2;pts.push(Math.cos(a)*w,(b+t)/2+Math.sin(a)*(t-b)/2,z);uv.push(i/steps,j/(sections.length-1));}
    for(let s=0;s<sections.length-1;s++)for(let i=0;i<steps;i++){const a=s*stride+i,b=a+1;ids.push(a,b,a+stride,b,b+stride,a+stride);}
    for(const end of [0,sections.length-1]){const center=pts.length/3,[z,w,b,t]=sections[end];pts.push(0,(b+t)/2,z);uv.push(.5,.5);const ring=pts.length/3;for(let i=0;i<=steps;i++){const a=i/steps*Math.PI*2;pts.push(Math.cos(a)*w,(b+t)/2+Math.sin(a)*(t-b)/2,z);uv.push(.5+Math.cos(a)*.5,.5+Math.sin(a)*.5);}for(let i=0;i<steps;i++){const a=ring+i;end?ids.push(center,a,a+1):ids.push(center,a+1,a);}}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ids);geo.computeVertexNormals();
    const n=geo.attributes.normal;for(let j=0;j<sections.length;j++){const a=j*stride,b=a+steps,v=new T.Vector3().fromBufferAttribute(n,a).add(new T.Vector3().fromBufferAttribute(n,b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
    const mesh=add(geo,material);mesh.userData.profile=sections;return mesh;
  };
  const floor=new T.Shape();floor.moveTo(-.26,-1.6);floor.lineTo(-.67,-.7);floor.quadraticCurveTo(-.96,-.35,-.88,.7);floor.lineTo(-.76,1.78);floor.lineTo(-.54,2.02);floor.lineTo(.54,2.02);floor.lineTo(.76,1.78);floor.lineTo(.88,.7);floor.quadraticCurveTo(.96,-.35,.67,-.7);floor.lineTo(.26,-1.6);floor.closePath();
  const floorGeo=new T.ExtrudeGeometry(floor,{depth:.035,bevelEnabled:true,bevelSize:.012,bevelThickness:.008,bevelSegments:2,curveSegments:16});floorGeo.rotateX(Math.PI/2);add(floorGeo,carbon,0,.19,0);
  // Keep the nose low and rounded in the T-cam instead of a tall needle shape.
  const chassis=body([[-2.62,.05,.25,.3],[-2.5,.09,.25,.33],[-2.15,.13,.28,.39],[-1.7,.17,.32,.49],[-1.25,.22,.32,.59],[-.8,.29,.27,.7],[-.42,.365,.24,.76],[.1,.36,.23,.66],[.62,.31,.23,.68],[1.28,.2,.24,.49],[1.97,.05,.26,.33]]);chassis.name='chassis';
  function sectionAt(mesh,z){const sections=mesh.userData.profile;for(let i=1;i<sections.length;i++)if(sections[i][0]>=z){const a=sections[i-1],b=sections[i],t=T.MathUtils.clamp((z-a[0])/(b[0]-a[0]),0,1);return a.map((v,k)=>T.MathUtils.lerp(v,b[k],t));}return sections[sections.length-1];}
  function chassisMount(z,side,angle){const [,w,b,t]=sectionAt(chassis,z);return [side*w*Math.cos(angle)*.94,(b+t)/2+Math.sin(angle)*(t-b)/2*.94,z];}
  function topSurface(mesh,x,z){const [,w,b,t]=sectionAt(mesh,z);return (b+t)/2+Math.sqrt(Math.max(0,1-(x/w)**2))*(t-b)/2;}
  for(const side of [-1,1]){
    const pod=body([[-.49,.14,.44,.63],[-.31,.24,.33,.68],[.05,.285,.29,.67],[.48,.25,.28,.6],[.91,.16,.29,.45],[1.45,.035,.28,.34]]);pod.position.x=side*.56;
    const inlet=add(new T.SphereGeometry(1,24,12),black,side*.56,.535,-.485);inlet.scale.set(.17,.084,.024);
    tube([[side*.4,.54,-.50],[side*.43,.607,-.50],[side*.57,.619,-.50],[side*.72,.57,-.49],[side*.69,.485,-.49],[side*.47,.465,-.5],[side*.4,.54,-.50]],.01,lime);
    // Colour the same surface to avoid overlapping meshes and flickering panels.
    const podColors=[],podPosition=pod.geometry.attributes.position;
    for(let i=0;i<podPosition.count;i++){const z=podPosition.getZ(i);const red=z>.4&&z<.76;podColors.push(1,red?.015:1,red?.027:1);}
    pod.geometry.setAttribute('color',new T.Float32BufferAttribute(podColors,3));pod.material=paint.clone();pod.material.vertexColors=true;
    tube([[side*.7,.205,-.7],[side*.88,.203,-.25],[side*.9,.204,.49],[side*.78,.23,1.28]],.015,carbon);
    // Louver openings follow the pod curvature, including the narrowing tail.
    for(let i=0;i<6;i++){
      const z=.52+i*.1,positions=[],indices=[];
      for(let row=0;row<=2;row++){const zz=z+(row-1)*.012,[,w]=sectionAt(pod,zz);for(let col=0;col<=4;col++){const x=side*w*T.MathUtils.lerp(-.75,-.05,col/4);positions.push(pod.position.x+x,topSurface(pod,x,zz)+.0015,zz);if(row<2&&col<4){const a=row*5+col;side>0?indices.push(a,a+5,a+1,a+1,a+5,a+6):indices.push(a,a+1,a+5,a+1,a+6,a+5);}}}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();add(g,black);
    }
    for(const z of [-1.65,1.58]){
      rod(chassisMount(z-.4,side,-.45),[side*.99,.3,z],.018);
      rod(chassisMount(z+.34,side,-.45),[side*.99,.3,z],.018);
      rod(chassisMount(z+.26,side,.65),[side*.99,.43,z],.016);
      rod(chassisMount(z+.32,side,1.02),[side*.97,.32,z],.012,alloy);
    }
    box(.025,.14,1.5,side*.86,.245,.55);
  }
  body([[.3,.125,.91,1.26],[.48,.2,.47,1.22],[.68,.2,.37,1.18],[.96,.165,.33,.98],[1.36,.1,.3,.64],[1.85,.025,.28,.39]],carbon);
  const intake=add(new T.SphereGeometry(1,24,16),black,0,1.13,.285);intake.scale.set(.128,.128,.025);
  const intakeLip=add(new T.TorusGeometry(.137,.014,10,40),paint,0,1.13,.256);intakeLip.scale.x=.94;
  const intakeRed=add(new T.TorusGeometry(.119,.006,6,40),lime,0,1.13,.25);intakeRed.scale.x=.94;rod([0,1.013,.247],[0,1.246,.247],.008,lime);
  const intakeDuct=add(new T.CylinderGeometry(.135,.137,.08,40,1,true),carbon,0,1.13,.296);intakeDuct.rotation.x=Math.PI/2;intakeDuct.scale.x=.94;
  rod([0,1.165,.64],[0,1.34,.68],.021);const tcam=add(new T.SphereGeometry(1,24,12),carbon,0,1.345,.66);tcam.scale.set(.2,.022,.075);
  const cameraLens=add(new T.CircleGeometry(.012,16),black,.14,1.345,.598);cameraLens.rotation.y=Math.PI;
  const coaming=new T.Shape();coaming.absellipse(0,0,.34,.515,0,Math.PI*2,false);const opening=new T.Path();opening.absellipse(0,0,.289,.455,0,Math.PI*2,true);coaming.holes.push(opening);
  const coamingGeo=new T.ExtrudeGeometry(coaming,{depth:.21,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:3,curveSegments:32});coamingGeo.rotateX(Math.PI/2);add(coamingGeo,carbon,0,.76,-.02);
  const cockpitMaterial=new T.MeshStandardMaterial({color:'#030405',roughness:1,envMapIntensity:.08});
  const cockpit=add(new T.CircleGeometry(1,64),cockpitMaterial,0,.765,-.02);cockpit.rotation.x=-Math.PI/2;cockpit.scale.set(.292,.46,1);
  const driver=new T.Group();driver.name='seated-driver';car.add(driver);
  const suit=new T.MeshStandardMaterial({color:'#222831',roughness:.94}),suitRed=new T.MeshStandardMaterial({color:'#760b1b',roughness:.92});
  const fabricWhite=new T.MeshStandardMaterial({color:'#d9dce0',roughness:.92}),stitch=new T.MeshStandardMaterial({color:'#636975',roughness:1});
  const gloveMaterial=new T.MeshStandardMaterial({color:'#e0e3e5',roughness:.86}),bootMaterial=new T.MeshStandardMaterial({color:'#10151a',roughness:.85});
  const soft=(scale,position,material,parent=driver)=>{const m=add(new T.SphereGeometry(1,16,12),material,...position,parent);m.scale.set(...scale);return m;};
  // Reclined torso, pelvis and bent legs extend below the cockpit coaming.
  const pelvis=soft([.125,.09,.11],[0,.6,.12],suit);
  const torso=soft([.147,.167,.101],[0,.757,.11],suitRed);torso.rotation.x=.25;
  const chestPoint=(x,y)=>new T.Vector3(x,y,-.101*Math.sqrt(Math.max(0,1-(x/.147)**2-(y/.167)**2))-.0025).applyEuler(torso.rotation).add(torso.position);
  soft([.082,.044,.065],[0,.897,.141],black);
  const collar=add(new T.TorusGeometry(.065,.014,8,32),fabricWhite,0,.91,.135,driver);collar.rotation.x=Math.PI/2;
  for(const side of [-1,1]){
    const thigh=rod([side*.076,.602,.09],[side*.08,.52,-.23],.064,suit,driver);
    soft([.059,.06,.063],[side*.08,.52,-.23],suitRed);
    rod([side*.08,.52,-.23],[side*.075,.39,-.63],.044,suit,driver);
    const boot=soft([.047,.048,.107],[side*.075,.396,-.696],bootMaterial);boot.rotation.x=-.2;
    tube([[side*.116,.58,.015],[side*.13,.54,-.12],[side*.12,.505,-.26],[side*.111,.44,-.45],[side*.107,.405,-.6]],.004,suitRed,driver);
    soft([.053,.053,.053],[side*.127,.867,.098],suitRed);
    // HANS pads and shoulder belts lie on the upper chest.
    tube([[side*.072,.892,.18],[side*.087,.881,.09],[side*.072,.839,.014]],.019,black,driver);
    const bp=[],bi=[];for(let j=0;j<=14;j++){const yy=T.MathUtils.lerp(-.1,.13,j/14),xx=side*T.MathUtils.lerp(.039,.064,j/14);for(const edge of [-1,1])bp.push(...chestPoint(xx+edge*.016,yy).toArray());if(j<14){const a=j*2;bi.push(a,a+2,a+1,a+1,a+2,a+3);}}
    const bg=new T.BufferGeometry();bg.setAttribute('position',new T.Float32BufferAttribute(bp,3));bg.setIndex(bi);bg.computeVertexNormals();add(bg,black,0,0,0,driver);
    for(const edge of [-1,1]){const points=[];for(let j=0;j<=6;j++){const yy=T.MathUtils.lerp(-.095,.127,j/6),xx=side*T.MathUtils.lerp(.039,.064,j/6);points.push(chestPoint(xx+edge*.012,yy).toArray());}tube(points,.0015,stitch,driver);}
    const bucklePoint=chestPoint(side*.057,.065);box(.027,.015,.01,...bucklePoint.toArray(),alloy,driver);
    tube([[side*.112,.785,.052],[side*.105,.704,.04],[side*.075,.661,.043]],.0025,stitch,driver);
  }
  const beltBuckle=chestPoint(0,-.096);box(.039,.028,.013,...beltBuckle.toArray(),alloy,driver);
  const release=add(new T.CylinderGeometry(.01,.01,.006,16),lime,beltBuckle.x,beltBuckle.y,beltBuckle.z-.008,driver);release.rotation.x=Math.PI/2;
  tube([[0,.877,.034],[0,.839,.003],[0,.752,.009]],.002,stitch,driver);
  // Full-face helmet: shaped chin, rubber seal, front-only visor and side pivots.
  const head=new T.Group();head.name='driver-helmet';head.position.set(0,1.037,.14);driver.add(head);
  const helmetProfile=[[0,-.124],[.079,-.124],[.106,-.105],[.124,-.065],[.13,.018],[.123,.071],[.095,.122],[.047,.148],[0,.155]].map(p=>new T.Vector2(...p));
  const helmetSmooth=new T.SplineCurve(helmetProfile).getPoints(36).map(p=>new T.Vector2(Math.max(0,p.x),p.y));
  const shell=add(new T.LatheGeometry(helmetSmooth,48),white,0,0,0,head);shell.scale.z=1.12;
  soft([.103,.035,.04],[0,-.079,-.1],white,head);
  const chinSeal=add(new T.TorusGeometry(.084,.007,8,40),black,0,-.12,0,head);chinSeal.rotation.x=Math.PI/2;chinSeal.scale.y=1.12;
  function visorPatch(material,top,bottom,radius,width){const p=[],uv=[],idx=[];for(let j=0;j<=4;j++)for(let i=0;i<=40;i++){const angle=(i/40-.5)*width,y=T.MathUtils.lerp(bottom,top,j/4);p.push(Math.sin(angle)*radius,y,-Math.cos(angle)*radius*1.12);uv.push(i/40,j/4);if(j<4&&i<40){const a=j*41+i;idx.push(a,a+41,a+1,a+1,a+41,a+42);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return add(g,material,0,0,0,head);}
  visorPatch(black,.051,-.024,.1315,2.63);
  const visorMaterial=new T.MeshPhysicalMaterial({color:'#071c2c',metalness:.85,roughness:.15,clearcoat:1});
  visorPatch(visorMaterial,.041,-.015,.133,2.48).name='helmet-visor';
  for(const side of [-1,1]){
    const pivot=add(new T.CylinderGeometry(.013,.013,.004,20),alloy,side*.129,.013,-.039,head);pivot.rotation.z=Math.PI/2;
    const screw=add(new T.CylinderGeometry(.004,.004,.005,10),black,side*.132,.013,-.039,head);screw.rotation.z=Math.PI/2;
    for(let i=0;i<3;i++){const vent=box(.013,.006,.004,side*(.026+i*.018),-.081,-.139+i*.004,black,head);vent.rotation.y=side*-.12;}
  }
  const crown=helmetSmooth.filter(p=>p.y>.082),sp=[],si=[],crownPath=[...crown.map(p=>[p,-1]),...crown.slice(0,-1).reverse().map(p=>[p,1])];
  crownPath.forEach(([p,front],j)=>{const w=Math.min(.012,p.x*.8);for(const side of [-1,1])sp.push(side*w,p.y+.0015,front*Math.sqrt(Math.max(0,p.x*p.x-w*w))*1.12);if(j<crownPath.length-1){const a=j*2;si.push(a,a+2,a+1,a+1,a+2,a+3);}});
  const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(sp,3));sg.setIndex(si);sg.computeVertexNormals();add(sg,lime,0,0,0,head);
  box(.039,.01,.004,0,-.053,-.143,black,head);
  const haloPoints=[[-.31,.86,.43],[-.36,1.06,-.12],[0,1.075,-.65],[.36,1.06,-.12],[.31,.86,.43]].map(p=>new T.Vector3(...p));
  add(new T.TubeGeometry(new T.CatmullRomCurve3(haloPoints),48,.031,10,false),paint);rod([0,.71,-.64],[0,1.075,-.65],.027,paint);
  // Steering assembly and gloves share one pivot: palms cannot drift off the grips.
  rod([0,.66,-.32],[0,.885,-.275],.019,black);
  const steering=new T.Group();steering.name='driver-steering';steering.position.set(0,.885,-.275);driver.add(steering);
  tube([[-.12,-.033,.005],[-.125,.023,0],[-.085,.034,-.005],[.085,.034,-.005],[.125,.023,0],[.12,-.033,.005]],.012,black,steering);
  box(.165,.052,.025,0,0,0,carbon,steering);box(.067,.024,.002,0,.01,.015,new T.MeshStandardMaterial({color:'#14292c',emissive:'#10322d',emissiveIntensity:.3}),steering);
  for(const side of [-1,1])for(let i=0;i<2;i++){const button=add(new T.CylinderGeometry(.006,.006,.004,10),i?lime:alloy,side*.061,-.014+i*.022,.017,steering);button.rotation.x=Math.PI/2;}
  const arms=[],hands=[];
  for(const side of [-1,1]){
    const hand=new T.Group();hand.name=side<0?'driver-hand-left':'driver-hand-right';hand.position.set(side*.119,.002,.015);steering.add(hand);
    soft([.026,.035,.025],[0,0,0],gloveMaterial,hand);
    soft([.024,.031,.007],[0,0,.021],suitRed,hand);
    for(let i=0;i<4;i++)tube([[side*-.015,.023-i*.014,.006],[side*-.023,.023-i*.014,-.01],[side*-.006,.023-i*.014,-.021]],.006,gloveMaterial,hand);
    soft([.012,.022,.013],[side*-.023,-.019,.008],gloveMaterial,hand);
    const shoulder=new T.Vector3(side*.141,.86,.1);
    const makeLimb=(r1,r2,material)=>{const g=new T.Group();driver.add(g);add(new T.CylinderGeometry(r1,r2,1,16),material,0,0,0,g);return g;};
    const upper=makeLimb(.042,.051,suitRed),fore=makeLimb(.03,.042,suitRed);
    const elbow=new T.Group();driver.add(elbow);soft([.043,.044,.043],[0,0,0],suit,elbow);
    add(new T.CylinderGeometry(.05,.052,.12,16),fabricWhite,0,-.35,0,upper);
    box(.026,.2,.006,0,0,-.043,stitch,upper);
    const cuff=add(new T.CylinderGeometry(.033,.034,.12,16),fabricWhite,0,.43,0,fore);
    hands.push(hand);arms.push({side,shoulder,upper,fore,elbow,hand,upperLength:.216,foreLength:.216,target:new T.Vector3(),axis:new T.Vector3(),bend:new T.Vector3(),joint:new T.Vector3(),delta:new T.Vector3()});
  }
  let lastSteer=NaN;const up=new T.Vector3(0,1,0),steeringAxis=new T.Vector3(0,0,1);
  function updateDriver(steer){
    const input=T.MathUtils.clamp(Number.isFinite(steer)?steer:0,-.6,.6);if(Math.abs(input-lastSteer)<.00001)return;lastSteer=input;
    steering.rotation.z=-input*1.25;head.rotation.y=-input*.12;
    for(const arm of arms){
      const {shoulder,target,axis,bend,joint,delta}=arm;
      target.copy(arm.hand.position).applyAxisAngle(steeringAxis,steering.rotation.z).add(steering.position);
      // Two-bone IK keeps both sleeve lengths fixed while the steering wheel turns.
      axis.copy(target).sub(shoulder);const distance=axis.length();axis.normalize();
      const a=arm.upperLength,b=arm.foreLength,along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
      bend.set(arm.side*.4,.7,-.04).sub(shoulder);bend.addScaledVector(axis,-bend.dot(axis)).normalize();joint.copy(shoulder).addScaledVector(axis,along).addScaledVector(bend,height);
      const place=(group,start,end)=>{delta.copy(end).sub(start);group.position.copy(start).add(end).multiplyScalar(.5);group.quaternion.setFromUnitVectors(up,delta.clone().normalize());group.scale.set(1,delta.length(),1);};
      place(arm.upper,shoulder,joint);place(arm.fore,joint,target);arm.elbow.position.copy(joint);
    }
  }
  updateDriver(0);
  const roundedRect=(w,h,r)=>{const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;};
  const mirrorGlass=new T.MeshPhysicalMaterial({color:'#c2d8df',metalness:1,roughness:.085,clearcoat:1});mirrorGlass.name='mirror-glass';
  const mirrors=[];
  for(const side of [-1,1]){
    const mirror=new T.Group();mirror.name=side<0?'mirror-left':'mirror-right';mirror.position.set(side*.61,.8,-.43);mirror.rotation.y=-side*.14;car.add(mirror);
    const housing=new T.ExtrudeGeometry(roundedRect(.214,.078,.025),{depth:.043,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:3,curveSegments:8});housing.translate(0,0,-.037);
    add(housing,carbon,0,0,0,mirror).name='mirror-housing';
    add(new T.ShapeGeometry(roundedRect(.189,.057,.019),12),black,0,0,.0155,mirror).name='mirror-gasket';
    add(new T.ShapeGeometry(roundedRect(.176,.045,.015),12),mirrorGlass,0,0,.0165,mirror).name='mirror-glass';
    // Glass faces rearward (+Z), with a slight inward angle towards the driver.
    const stem=tube([chassisMount(-.45,side,.6),[side*.39,.704,-.443],[side*.52,.752,-.438],[side*.607,.769,-.437]],.012,carbon);stem.name='mirror-stem';
    for(const x of [-.086,.086]){const screw=add(new T.CylinderGeometry(.003,.003,.003,8),alloy,x,0,.0168,mirror);screw.rotation.x=Math.PI/2;}
    mirrors.push(mirror);
  }
  function wing(span,chord,x,y,z,material,camber=.07){
    // Shared skin vertices smooth the highlights; separate caps keep tips sharp.
    const profile=[];for(let i=0;i<=32;i++){const t=i/32;profile.push([(1-t)**2*(-chord/2)+2*(1-t)*t*(-chord*.1)+t*t*chord/2,2*(1-t)*t*camber+t*t*.018]);}
    for(let i=1;i<32;i++){const t=i/32;profile.push([(1-t)**2*chord/2-t*t*chord/2,(1-t)**2*.018-2*(1-t)*t*.018]);}
    const p=[],uv=[],idx=[],n=profile.length;for(const side of [-1,1])for(let i=0;i<n;i++){p.push(side*span/2,profile[i][1],-profile[i][0]);uv.push((side+1)/2,i/n);}
    for(let i=0;i<n;i++){const j=(i+1)%n;idx.push(i,i+n,j,j,i+n,j+n);}
    for(const side of [-1,1]){const center=p.length/3;p.push(side*span/2,0,0);uv.push(.5,.5);const start=p.length/3;for(const [z,y]of profile){p.push(side*span/2,y,-z);uv.push(z/chord+.5,y/camber);}for(let i=0;i<n;i++){const a=start+i,b=start+(i+1)%n;side<0?idx.push(center,a,b):idx.push(center,b,a);}}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return add(geo,material,x,y,z);
  }
  // Curved aerofoils sweep upward at their tips, with real gaps between flaps.
  function sweptWing(span,chord,y,z,material,rise=.2,sweep=.15){
    const p=[],uv=[],idx=[],ns=32,nc=8,layer=(ns+1)*(nc+1);
    for(let face=0;face<2;face++)for(let s=0;s<=ns;s++)for(let c=0;c<=nc;c++){const t=s/ns*2-1,u=c/nc,edge=Math.pow(Math.abs(t),5);p.push(t*span/2,y+edge*rise+Math.sin(u*Math.PI)*.028+(face?-.014:0)+u*.02,z+(u-.5)*chord+edge*sweep);uv.push(s/ns,u);}
    for(let f=0;f<2;f++)for(let s=0;s<ns;s++)for(let c=0;c<nc;c++){const a=f*layer+s*(nc+1)+c,b=a+nc+1;f?idx.push(a,b,a+1,a+1,b,b+1):idx.push(a,a+1,b,a+1,b+1,b);}
    const join=(a,b)=>idx.push(a,b,a+layer,b,b+layer,a+layer);
    for(let s=0;s<ns;s++){join(s*(nc+1),(s+1)*(nc+1));join((s+1)*(nc+1)+nc,s*(nc+1)+nc);}for(let c=0;c<nc;c++){join(c+1,c);join(ns*(nc+1)+c,ns*(nc+1)+c+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return add(g,material);
  }
  for(let i=0;i<4;i++)sweptWing(2.16-i*.045,.185,.16+i*.047,-2.53+i*.11,i===3?paint:carbon,.1+i*.01,.025);
  for(const side of [-1,1]){
    const tip=new T.Shape();tip.moveTo(-2.64,.19);tip.quadraticCurveTo(-2.42,.27,-2.25,.39);tip.quadraticCurveTo(-2.15,.44,-2.1,.4);tip.lineTo(-2.09,.24);tip.quadraticCurveTo(-2.3,.16,-2.64,.19);tip.closePath();
    const tipGeo=new T.ExtrudeGeometry(tip,{depth:.02,bevelEnabled:true,bevelSize:.007,bevelThickness:.007,bevelSegments:2});tipGeo.translate(0,0,-.01);tipGeo.rotateY(-Math.PI/2);add(tipGeo,carbon,side*1.063,0,0);rod([side*.11,.31,-2.34],[side*.18,.2,-2.52],.02);
    const endplate=new T.Shape();endplate.moveTo(1.7,.79);endplate.quadraticCurveTo(1.66,1.05,1.75,1.26);endplate.lineTo(2.2,1.26);endplate.quadraticCurveTo(2.28,.95,2.18,.76);endplate.closePath();
    const endGeo=new T.ExtrudeGeometry(endplate,{depth:.022,bevelEnabled:true,bevelSize:.008,bevelThickness:.005,bevelSegments:2});endGeo.translate(0,0,-.011);endGeo.rotateY(-Math.PI/2);add(endGeo,carbon,side*.94,0,0);
    tube([[side*.948,1.25,1.77],[side*.948,1.267,1.96],[side*.948,1.25,2.17]],.007,lime);rod(chassisMount(1.68,side,.6),[side*.25,1.04,1.94],.024);
  }
  sweptWing(1.87,.43,1.02,1.92,carbon,.13);wing(1.84,.23,0,1.2,2.12,carbon);wing(1.5,.24,0,.45,1.95,carbon);
  for(let i=-3;i<=3;i++)box(.022,.16,.5,i*.19,.22,1.88);
  box(.13,.105,.048,0,.4,2.073,black);
  const rearLight=new T.MeshStandardMaterial({color:'#ff2523',emissive:'#d90c08',emissiveIntensity:.8});
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)add(new T.SphereGeometry(.011,8,6),rearLight,x*.029,.4+y*.026,2.101);
  const exhaust=add(new T.CylinderGeometry(.045,.045,.27,24,1,true),alloy,0,.52,1.895);exhaust.rotation.x=Math.PI/2;
  tube([[0,.37,1.69],[0,.47,1.735],[0,.52,1.79]],.043,alloy);
  const bore=add(new T.CircleGeometry(.038,24),black,0,.52,2.016);bore.rotation.y=0;
  const exhaustLip=add(new T.TorusGeometry(.042,.004,8,24),alloy,0,.52,2.032);
  // Conform the pinstripe to the actual loft, rather than estimating its height.
  const stripePositions=[],stripeIndices=[];for(let i=0;i<=40;i++){const z=T.MathUtils.lerp(-2.46,-.83,i/40),[,w,b,t]=sectionAt(chassis,z),halfWidth=T.MathUtils.lerp(.01,.027,i/40);for(const side of [-1,1])stripePositions.push(side*halfWidth,(b+t)/2+Math.sqrt(1-(halfWidth/w)**2)*(t-b)/2+.0015,z);if(i<40){const a=i*2;stripeIndices.push(a,a+2,a+1,a+1,a+2,a+3);}}
  const stripeGeo=new T.BufferGeometry();stripeGeo.setAttribute('position',new T.Float32BufferAttribute(stripePositions,3));stripeGeo.setIndex(stripeIndices);stripeGeo.computeVertexNormals();add(stripeGeo,lime);
  function decal(text,width,height){const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#e8f1e9';ctx.font='italic bold 145px Arial';ctx.textAlign='center';ctx.fillText(text,512,183);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshStandardMaterial({map:t,transparent:true,roughness:.38,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));}
  // Mount the rear wordmark to an actual wing surface, never in the air below it.
  const rearLogo=decal('APEX',1.05,.15),logoPositions=[],logoUV=[],logoIndices=[];
  for(let i=0;i<=16;i++){const t=T.MathUtils.lerp(.18,.82,i/16),x=(1-t)**2*(-.115)+2*(1-t)*t*(-.023)+t*t*.115,y=2*(1-t)*t*.07+t*t*.018;for(const side of [-1,1]){logoPositions.push(side*.525,1.2+y+.0015,2.12-x);logoUV.push((side+1)/2,i/16);}if(i<16){const a=i*2;logoIndices.push(a,a+1,a+2,a+1,a+3,a+2);}}
  rearLogo.geometry.dispose();rearLogo.geometry=new T.BufferGeometry();rearLogo.geometry.setAttribute('position',new T.Float32BufferAttribute(logoPositions,3));rearLogo.geometry.setAttribute('uv',new T.Float32BufferAttribute(logoUV,2));rearLogo.geometry.setIndex(logoIndices);rearLogo.geometry.computeVertexNormals();car.add(rearLogo);
  const num=decal('07',.2,.16),numPositions=[],numUV=[],numIndices=[];
  for(let row=0;row<=8;row++)for(let col=0;col<=4;col++){const x=(col/4-.5)*.2,z=-.77+(row/8-.5)*.16;numPositions.push(x,topSurface(chassis,x,z)+.002,z);numUV.push(col/4,1-row/8);if(row<8&&col<4){const a=row*5+col;numIndices.push(a,a+5,a+1,a+1,a+5,a+6);}}
  num.geometry.dispose();num.geometry=new T.BufferGeometry();num.geometry.setAttribute('position',new T.Float32BufferAttribute(numPositions,3));num.geometry.setAttribute('uv',new T.Float32BufferAttribute(numUV,2));num.geometry.setIndex(numIndices);num.geometry.computeVertexNormals();car.add(num);
  const sidewallMaterial=new T.MeshStandardMaterial({map:maps.sidewall,transparent:true,roughness:.8,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const wheels=[];
  for(const z of [-1.65,1.58])for(const side of [-1,1]){
    const width=z>0?.43:.35,pivot=new T.Group(),wheel=new T.Group();pivot.position.set(side*1.04,.36,z);car.add(pivot);pivot.add(wheel);
    const profile=[[.225,-width/2],[.29,-width/2],[.335,-width*.46],[.357,-width*.33],[.36,width*.33],[.335,width*.46],[.29,width/2],[.225,width/2]].map(p=>new T.Vector2(...p));
    const tyre=add(new T.LatheGeometry(profile,64),rubber,0,0,0,wheel);tyre.rotation.z=Math.PI/2;
    for(const face of [-1,1]){
      const x=face*(width/2+.003),disc=add(new T.CylinderGeometry(.228,.228,.014,48),carbon,x,0,0,wheel);disc.rotation.z=Math.PI/2;
      const rim=add(new T.TorusGeometry(.209,.009,8,48),alloy,x+face*.008,0,0,wheel);rim.rotation.y=Math.PI/2;
      for(let i=0;i<10;i++){const a=i/10*Math.PI*2;rod([x+face*.014,Math.cos(a)*.055,Math.sin(a)*.055],[x+face*.012,Math.cos(a+.16)*.198,Math.sin(a+.16)*.198],.007,alloy,wheel);}
      const hub=add(new T.CylinderGeometry(.052,.052,.035,12),side<0?lime:alloy,x+face*.018,0,0,wheel);hub.rotation.z=Math.PI/2;
      const hubRecess=add(new T.CircleGeometry(.028,24),black,x+face*.036,0,0,wheel);hubRecess.rotation.y=face*Math.PI/2;
      const spindle=add(new T.CylinderGeometry(.014,.014,.005,6),alloy,x+face*.039,0,0,wheel);spindle.rotation.z=Math.PI/2;
      rod([x+face*.006,-.172,.058],[x+face*.022,-.172,.058],.004,black,wheel);
    }
    for(const face of [-1,1]){const label=add(new T.PlaneGeometry(.716,.716),sidewallMaterial,face*(width/2+.008),0,0,wheel);label.rotation.y=face*Math.PI/2;label.castShadow=false;}
    // Open-wheel tyres have no floating arches or rigid rods on their tread.
    wheels.push({pivot,wheel,front:z<0});
  }
  // Batch rigid parts by material; wheel pivots remain separate for animation.
  function batch(group){
    const groups=new Map();
    for(const child of [...group.children])if(child.isMesh&&child.name!=='chassis'){const key=child.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(child);}
    for(const meshes of groups.values()){
      if(meshes.length<2)continue;const positions=[],normals=[],uvs=[],indices=[];let offset=0;
      for(const mesh of meshes){mesh.updateMatrix();const geo=mesh.geometry.clone().applyMatrix4(mesh.matrix),p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;
        for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0);}
        if(geo.index)for(let i=0;i<geo.index.count;i++)indices.push(offset+geo.index.getX(i));else for(let i=0;i<p.count;i++)indices.push(offset+i);
        offset+=p.count;geo.dispose();group.remove(mesh);mesh.geometry.dispose();
      }
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);add(geometry,meshes[0].material,0,0,0,group);
    }
  }
  for(const w of wheels){batch(w.wheel);batch(w.pivot);}batch(car);
  for(const group of [driver,head,steering,...hands,...arms.flatMap(a=>[a.upper,a.fore,a.elbow])])batch(group);
  car.userData.wheels=wheels;car.userData.mirrors=mirrors;car.userData.driver={root:driver,head,steering,hands,arms,update:updateDriver};return car;
}

export function updateFormulaDriver(model,steer){model.userData.driver?.update(steer);}
