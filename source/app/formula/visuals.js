import * as T from '../street/vendor/three.module.js';
export function surfaceTexture(kind, renderer) {
  const c=document.createElement('canvas');c.width=c.height=512;
  const ctx=c.getContext('2d'),im=ctx.createImageData(512,512);let seed=4387;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const i=(y*512+x)*4,fine=(random()-.5)*24;
    const base=kind==='grass'?[67,83,43]:[73,76,79];
    const stripe=kind==='grass'?Math.sin(y/512*Math.PI*4)*6:0;
    for(let k=0;k<3;k++)im.data[i+k]=base[k]+fine+stripe;im.data[i+3]=255;
  }
  ctx.putImageData(im,0,0);
  if(kind==='asphalt'){ctx.strokeStyle='#20252928';ctx.lineWidth=18;for(const x of [120,176,330,388]){ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+10,180,x-12,330,x,512);ctx.stroke();}}
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return texture;
}
export function setupAtmosphere(scene,renderer){
  const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
    varying vec3 direction;
    void main(){vec3 d=normalize(direction);float h=max(0.,d.y);
      vec3 col=mix(vec3(.69,.77,.80),vec3(.13,.35,.62),pow(h,.52));
      vec3 sun=normalize(vec3(-.65,.8,-.42));float glow=pow(max(dot(d,sun),0.),32.);col+=vec3(1.,.76,.43)*glow*.35;
      gl_FragColor=vec4(col,1.);
    }`});
  const sky=new T.Mesh(new T.SphereGeometry(1300,48,24),skyMaterial);sky.frustumCulled=false;scene.add(sky);
  const envScene=new T.Scene(),envSky=new T.Mesh(new T.SphereGeometry(10,32,16),skyMaterial);envScene.add(envSky);
  const generator=new T.PMREMGenerator(renderer);const environment=generator.fromScene(envScene,.06,.1,100);
  scene.environment=environment.texture;scene.environmentIntensity=.75;generator.dispose();envSky.geometry.dispose();scene.fog=new T.Fog('#a5bdc9',260,1150);
}
export function foliageMaterial(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d');let seed=871;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  // Branches and thousands of small leaf clusters produce a broken silhouette.
  ctx.strokeStyle='#454634';ctx.lineWidth=7;
  for(let i=0;i<16;i++){const a=rand()*6.28,r=60+rand()*135;ctx.beginPath();ctx.moveTo(256,460);ctx.quadraticCurveTo(256,260,256+Math.cos(a)*r,235+Math.sin(a)*r);ctx.stroke();}
  for(let i=0;i<6500;i++){
    const a=rand()*6.28,r=Math.sqrt(rand()),x=256+Math.cos(a)*r*215,y=230+Math.sin(a)*r*210;
    if(r>.86&&rand()>.55)continue;
    const light=22+rand()*18+(1-y/512)*9;ctx.fillStyle=`hsl(${82+rand()*25} 24% ${light}%)`;
    ctx.beginPath();ctx.ellipse(x,y,2+rand()*6,2+rand()*3,rand()*3.14,0,6.28);ctx.fill();
  }
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  return new T.MeshStandardMaterial({map,alphaTest:.5,side:T.DoubleSide,roughness:1});
}
export function addCircuitDetails(world){
  const {scene}=world,steel=new T.MeshStandardMaterial({color:'#77858a',metalness:.7,roughness:.48}),dummy=new T.Object3D();
  const posts=new T.InstancedMesh(new T.CylinderGeometry(.045,.045,3.4,6),steel,120),wirePositions=[];let pi=0;
  for(const side of [-1,1])for(let i=0;i<60;i++){
    const x=side*16.1,z=100-i*6;dummy.position.set(x,2.4,z);dummy.updateMatrix();posts.setMatrixAt(pi++,dummy.matrix);
    if(i<59){for(let h=.9;h<4.1;h+=.24)wirePositions.push(x,h,z,x,h,z-6);for(let k=0;k<6;k++)wirePositions.push(x,.9,z-k,x,4.1,z-k);}
  }
  scene.add(posts);const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(wirePositions,3));scene.add(new T.LineSegments(wg,new T.LineBasicMaterial({color:'#899399',transparent:true,opacity:.28})));
  const seats=new T.InstancedMesh(new T.BoxGeometry(.6,.35,.68),new T.MeshStandardMaterial({roughness:.65}),900);
  let seat=0;for(let row=0;row<6;row++)for(let i=0;i<150;i++){
    dummy.position.set(-22-row*1.9,1.2+row*.65,16-i*.62);dummy.rotation.set(0,0,0);dummy.updateMatrix();seats.setMatrixAt(seat,dummy.matrix);seats.setColorAt(seat++,new T.Color((i+row)%11===0?'#d2d9db':row%2?'#24536a':'#172c3c'));
  }scene.add(seats);
  const trim=new T.MeshStandardMaterial({color:'#263a45',metalness:.45,roughness:.4});
  for(let i=0;i<24;i++)world.box(.13,2.4,.14,20.42,6.3,8-i*4,trim);
  for(let i=0;i<12;i++){world.box(.12,.08,5.4,20.35,4.15,8-i*8,new T.MeshStandardMaterial({color:'#dce5ea',emissive:'#bacbd1',emissiveIntensity:.25}));for(let j=0;j<9;j++)world.box(.1,.035,5.35,20.36,.3+j*.3,8-i*8,trim);}
}
