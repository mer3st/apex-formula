import * as T from '../street/vendor/three.module.js';
import {TRACK} from './track.js';
import {makeFormulaCar,updateFormulaDriver} from './car.js';
import {surfaceTexture,setupAtmosphere,addCircuitDetails,foliageMaterial} from './visuals.js';
import {RACING_LINE,guidanceDemand} from './racing-line.js';
const mat=(color,roughness=.8)=>new T.MeshStandardMaterial({color,roughness});
export class FormulaWorld{
  constructor(canvas){
    this.renderer=new T.WebGLRenderer({canvas,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.scene=new T.Scene();setupAtmosphere(this.scene,this.renderer);
    this.scene.add(new T.HemisphereLight('#c7e0ff','#435039',.65));
    this.sun=new T.DirectionalLight('#fff1d9',2.4);this.sun.position.set(-80,100,-65);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:1,far:280});this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.04;this.scene.add(this.sun,this.sun.target);
    this.camera=new T.PerspectiveCamera(68,1,.1,1600);this.look=new T.Vector3();this.mode='tcam';this.snapped=false;this.orbit=0;
    this.buildTrack();this.buildScenery();addCircuitDetails(this);this.car=makeFormulaCar();this.scene.add(this.car);this.resize();
  }
  box(w,h,d,x,y,z,material){const m=new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=h>.2;this.scene.add(m);return m;}
  ribbon(inner,outer,height,material){const v=[],idx=[];for(let i=0;i<=TRACK.points.length;i++){const q=TRACK.segments[i%TRACK.segments.length],nx=-q.tz,nz=q.tx;v.push(q.a.x+nx*inner,height,q.a.z+nz*inner,q.a.x+nx*outer,height,q.a.z+nz*outer);if(i<TRACK.points.length){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();const m=new T.Mesh(g,material);m.receiveShadow=true;this.scene.add(m);return m;}
  buildTrack(){
    const grass=surfaceTexture('grass',this.renderer);grass.repeat.set(120,120);const groundMaterial=mat('#ffffff');groundMaterial.map=grass;groundMaterial.bumpMap=grass;groundMaterial.bumpScale=.05;
    const ground=new T.Mesh(new T.PlaneGeometry(3000,3000),groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-.06;ground.receiveShadow=true;this.scene.add(ground);
    const texture=surfaceTexture('asphalt',this.renderer);
    const asphalt=mat('#b5bac0',.96);asphalt.map=texture;asphalt.bumpMap=texture;asphalt.bumpScale=.018;const road=this.ribbon(-7,7,.01,asphalt);const uv=[];for(let i=0;i<=TRACK.points.length;i++){const s=i===TRACK.points.length?TRACK.length:TRACK.segments[i].start;uv.push(0,s/14,1,s/14);}road.geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    const edge=mat('#dce1df'),runoff=mat('#687b78');this.ribbon(-15,-7,0,runoff);this.ribbon(7,15,0,runoff);this.ribbon(-7,-6.85,.025,edge);this.ribbon(6.85,7,.025,edge);
    const curbRed=mat('#c7503b'),curbWhite=mat('#e4e2d2');
    const curbGeo=new T.BoxGeometry(.9,.09,3.05),wallGeo=new T.BoxGeometry(.25,.9,6.2),wallMat=mat('#d4dbd4');
    const curbCount=Math.ceil(TRACK.length/3),curbs=[new T.InstancedMesh(curbGeo,curbRed,curbCount+2),new T.InstancedMesh(curbGeo,curbWhite,curbCount+2)];const ci=[0,0],dummy=new T.Object3D();
    const wallCount=Math.ceil(TRACK.length/6),walls=new T.InstancedMesh(wallGeo,wallMat,wallCount*2);let wi=0;
    for(let i=0;i<curbCount;i++){const p=TRACK.sample(i*3);for(const side of [-1,1]){dummy.position.set(p.x+p.nx*side*7.4,.035,p.z+p.nz*side*7.4);dummy.rotation.set(0,p.heading,0);dummy.updateMatrix();curbs[i%2].setMatrixAt(ci[i%2]++,dummy.matrix);}}
    for(let i=0;i<wallCount;i++){const p=TRACK.sample(i*6);for(const side of [-1,1]){dummy.position.set(p.x+p.nx*side*15.4,.45,p.z+p.nz*side*15.4);dummy.rotation.set(0,p.heading,0);dummy.updateMatrix();walls.setMatrixAt(wi++,dummy.matrix);}}
    for(let i=0;i<2;i++){curbs[i].count=ci[i];curbs[i].receiveShadow=true;this.scene.add(curbs[i]);}this.scene.add(walls);
    // Start grid and timing stripe, kept in real track coordinates.
    for(let row=0;row<5;row++)for(const side of [-1,1]){const p=TRACK.sample(48-row*9);for(const dx of [-1,1]){const m=this.box(.08,.025,4,p.x+p.nx*(side*3+dx),.035,p.z+p.nz*(side*3+dx),edge);m.rotation.y=p.heading;}const m=this.box(2,.025,.08,p.x+p.nx*side*3,.035,p.z+p.nz*side*3,edge);m.rotation.y=p.heading;}
    const p=TRACK.sample(63);for(let i=0;i<14;i++)for(let j=0;j<2;j++){const m=this.box(1,.025,1,p.x+p.nx*(i-6.5)-p.tx*j,.04,p.z+p.nz*(i-6.5)-p.tz*j,(i+j)%2?mat('#1b2329'):edge);m.rotation.y=p.heading;}
    this.sign('VALLE   /   MOTORSPORT',63,0,6,15,1.3);
    for(const side of [-1,1])this.box(.3,6,.3,p.x+p.nx*side*7.7,3,p.z+p.nz*side*7.7,mat('#374847'));
    for(const [s,n]of [[150,'150'],[200,'100'],[250,'50'],[850,'100'],[900,'50'],[1350,'100']])this.sign(n,s,9.5,1.1,1.1,1.4);
  }
  sign(text,s,offset,height,w,h){const p=TRACK.sample(s),c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#163c3d';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#f1f3df';ctx.font='bold 66px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,68);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));m.position.set(p.x+p.nx*offset,height,p.z+p.nz*offset);m.rotation.y=p.heading;this.scene.add(m);}
  buildScenery(){
    const concrete=mat('#b7bfc0'),glass=new T.MeshPhysicalMaterial({color:'#233e50',metalness:.72,roughness:.17,clearcoat:1}),roof=mat('#d5dce0'),green=mat('#12494c');
    // Pit building parallel to the main straight, with individual garage bays.
    this.box(13,4.8,105,27,2.4,-38,concrete);this.box(14,.4,109,27,5,-38,roof);this.box(13,2.3,96,27,6.3,-38,glass);this.box(15,.3,110,27,7.65,-38,roof);
    for(let i=0;i<12;i++){this.box(.08,2.9,5.4,20.45,1.5,8-i*8,glass);this.box(.1,.3,5.4,20.35,3.2,8-i*8,green);}
    // Grandstand rows and a thin cantilever canopy.
    for(let row=0;row<6;row++){this.box(1.9,.65,94,-22-row*1.9,.4+row*.65,-30,concrete);this.box(1.1,.3,94,-22-row*1.9,.9+row*.65,-30,row%2?green:mat('#c2cbb7'));}
    this.box(15,.25,99,-27.5,6,-30,roof);for(let i=0;i<6;i++)this.box(.25,6,.25,-34,3,14-i*18,glass);
    const dummy=new T.Object3D(),trees=new T.InstancedMesh(new T.PlaneGeometry(11,12),foliageMaterial(),450),trunks=new T.InstancedMesh(new T.CylinderGeometry(.23,.48,6,8),mat('#5d554a'),150);let count=0,seed=899;
    const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<500&&count<150;i++){const x=-250+rnd()*850,z=-480+rnd()*850;if(TRACK.nearest(x,z).distance<36)continue;const size=.7+rnd()*.6,angle=rnd()*6;for(let j=0;j<3;j++){dummy.position.set(x,6*size,z);dummy.scale.setScalar(size);dummy.rotation.y=angle+j*Math.PI/3;dummy.updateMatrix();trees.setMatrixAt(count*3+j,dummy.matrix);}dummy.position.set(x,2.5,z);dummy.scale.setScalar(size);dummy.updateMatrix();trunks.setMatrixAt(count,dummy.matrix);count++;}trees.count=count*3;trunks.count=count;trees.castShadow=true;this.scene.add(trees,trunks);
    const terrain=new T.PlaneGeometry(2500,2500,100,100);terrain.rotateX(-Math.PI/2);
    const positions=terrain.attributes.position;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i),r=Math.hypot(x-100,z+50),rise=Math.max(0,Math.min(1,(r-520)/260));
      const height=85+Math.sin(x*.008+z*.003)*37+Math.cos(z*.011-x*.003)*25+Math.sin(x*.024)*Math.cos(z*.019)*9;
      positions.setY(i,-12+rise*height);
    }
    terrain.computeVertexNormals();const hills=new T.Mesh(terrain,mat('#647b6b'));this.scene.add(hills);
  }
  resize(){
    // Match display density in both modes, including when moved between monitors.
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.setSize(innerWidth,innerHeight,false);
    this.renderer.setViewport(0,0,innerWidth,innerHeight);
    this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();
    if(this.splitViews)for(const view of this.splitViews){view.camera.aspect=innerWidth/(innerHeight/2);view.camera.updateProjectionMatrix();view.snapped=false;}
  }
  setSplitMode(enabled){
    this.splitMode=enabled;
    if(enabled&&!this.splitViews){
      const second=makeFormulaCar();
      second.traverse(o=>{if(o.isMesh&&o.material.name==='body-paint'){o.material=o.material.clone();o.material.color.set('#fb6947');}});
      this.scene.add(second);
      this.splitViews=[this.car,second].map(car=>({car,camera:new T.PerspectiveCamera(68,1,.1,1600),look:new T.Vector3(),mode:'chase',snapped:false,pitch:0,roll:0}));
    }
    if(this.splitViews){this.splitViews[1].car.visible=enabled;for(const v of this.splitViews)v.snapped=false;}
    for(const model of this.rivalModels||[])model.visible=!enabled;
    if(this.guide)this.guide.visible=false;
    this.renderer.shadowMap.enabled=true;
    this.renderer.setScissorTest(false);this.snapped=false;this.resize();
  }
  updateSplit(session,dt){
    const width=innerWidth,height=innerHeight,bottom=Math.floor(height/2);
    this.car.visible=true;
    for(const model of this.rivalModels||[])model.visible=false;
    if(this.guide)this.guide.visible=false;
    session.players.forEach((race,i)=>this.update(race.car,dt,false,this.splitViews[i],false));
    this.renderer.setScissorTest(true);
    session.players.forEach((race,i)=>{
      const y=i===0?bottom:0,h=i===0?height-bottom:bottom,view=this.splitViews[i];
      view.camera.aspect=width/h;view.camera.updateProjectionMatrix();
      this.renderer.setViewport(0,y,width,h);this.renderer.setScissor(0,y,width,h);
      this.sun.position.set(race.car.x-80,100,race.car.z-65);this.sun.target.position.set(race.car.x,0,race.car.z);
      this.updateGuide(race,true);
      this.renderer.render(this.scene,view.camera);
    });
    this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,width,height);
  }
  setRivals(rivals){
    this.rivalModels=rivals.map(r=>{const model=makeFormulaCar();model.traverse(o=>{if(o.isMesh&&o.material.name==='body-paint'){o.material=o.material.clone();o.material.color.set(r.color);}if(o.isMesh)o.castShadow=false;});this.scene.add(model);return model;});
    const shape=new T.Shape();shape.moveTo(-.52,1.28);shape.lineTo(0,1.05);shape.lineTo(.52,1.28);shape.lineTo(.52,-.8);shape.lineTo(0,-1.28);shape.lineTo(-.52,-.8);shape.closePath();
    const geometry=new T.ShapeGeometry(shape);geometry.rotateX(Math.PI/2);
    this.guide=new T.InstancedMesh(geometry,new T.MeshBasicMaterial({color:'white',transparent:true,opacity:.88,side:T.DoubleSide,depthWrite:false,toneMapped:false}),80);this.guide.frustumCulled=false;this.scene.add(this.guide);
    this.guideDummy=new T.Object3D();this.guideColor=new T.Color();
    this.guideColors=['#20f54b','#ffdc16','#ff2525'].map(c=>new T.Color(c));
    this.guide.instanceMatrix.setUsage(T.DynamicDrawUsage);
  }
  updateRace(race,active){
    this.boosting=active&&race.boosting;
    this.rivalModels?.forEach((m,i)=>{const r=race.rivals[i];m.visible=active;m.position.set(r.x,.015,r.z);m.rotation.y=r.heading;for(const w of m.userData.wheels){w.wheel.rotation.x=-r.s/.36;if(w.front)w.pivot.rotation.y=-r.steer;}updateFormulaDriver(m,r.steer);});
    this.updateGuide(race,active);
  }
  updateGuide(race,active){
    if(!this.guide)return;this.guide.visible=active&&race.phase==='racing';
    if(!this.guide.visible)return;
    const s=race.car.location.s,base=Math.floor(s/RACING_LINE.step),dummy=this.guideDummy,color=this.guideColor;
    for(let i=0;i<this.guide.count;i++){
      const distance=(base+i)*RACING_LINE.step,p=RACING_LINE.sample(distance);
      dummy.position.set(p.x,.075,p.z);dummy.rotation.set(0,p.heading,0);dummy.updateMatrix();this.guide.setMatrixAt(i,dummy.matrix);
      const demand=guidanceDemand(RACING_LINE,s,race.car.speed,Math.max(0,distance-s));
      color.copy(this.guideColors[demand<.5?0:1]).lerp(this.guideColors[demand<.5?1:2],demand<.5?demand*2:(demand-.5)*2);
      this.guide.setColorAt(i,color);
    }
    this.guide.instanceMatrix.needsUpdate=true;this.guide.instanceColor.needsUpdate=true;
  }
  update(car,dt,menu=false,view=this,render=true){
    // Body dynamics: brake dive / throttle squat (pitch) and G-force lean (roll),
    // smoothed so they read as weight transfer rather than jitter.
    const targetPitch=Math.max(-.05,Math.min(.028,car.longAccel*.0013));
    const targetRoll=Math.max(-.04,Math.min(.04,-car.lateralG*.024-car.yawRate*.01));
    view.pitch=(view.pitch??0)+(targetPitch-(view.pitch??0))*Math.min(1,dt*7);
    view.roll=(view.roll??0)+(targetRoll-(view.roll??0))*Math.min(1,dt*9);
    view.car.position.set(car.x,.015,car.z);view.car.rotation.set(view.pitch,car.heading,view.roll);
    for(const w of view.car.userData.wheels){w.wheel.rotation.x-=car.speed*dt/.36;if(w.front)w.pivot.rotation.y=-car.steer;}
    updateFormulaDriver(view.car,car.steer);
    const f=new T.Vector3(-Math.sin(car.heading),0,-Math.cos(car.heading)),r=new T.Vector3(Math.cos(car.heading),0,-Math.sin(car.heading)),pos=view.car.position.clone();let eye,target;
    view.car.visible=true;
    let fov;
    if(menu){view.orbit+=dt*.06;eye=pos.clone().addScaledVector(f,6.6).addScaledVector(r,6.6);eye.y=3.2;target=pos.clone().addScaledVector(r,-1.5);target.y=.6;fov=60;}
    else{
      const tcam=view.mode==='tcam',split=this.splitMode&&view!==this;
      // Half-height viewports need their own composition, not a scaled solo view.
      eye=pos.clone().addScaledVector(f,tcam?-.45:split?-7.4:-6.8);
      eye.y=tcam?1.48:(split?3.35:2.65);
      target=pos.clone().addScaledVector(f,tcam?28:split?16:22);
      target.y=tcam?(split?-2.2:-1.5):(split?-1.1:.65);
      // Widening FOV with speed reads as acceleration — the same trick used
      // in most racing games since the track can't otherwise convey 300 km/h.
      const speedFov=Math.min(9,Math.max(0,(car.speed-14)*.135));
      // Limit the very wide horizontal projection while making road detail larger.
      const splitFov=2*Math.atan(Math.tan(52*Math.PI/360)*Math.min(1,3.2/view.camera.aspect))*180/Math.PI;
      fov=(split?(tcam?Math.max(44,splitFov)+5:Math.max(40,splitFov)):(tcam?68:60))+speedFov*(split?.55:1);
      // Impact, off-track chatter and heavy wheelspin add a small handheld
      // shake — enough to feel the car losing composure, not enough to distract.
      view.shakeClock=(view.shakeClock??0)+dt;
      const shakeAmount=car.impact*.5+(car.offTrack?Math.min(1,car.speed/22)*.05:0)+Math.max(0,car.wheelspin-.4)*.06;
      if(shakeAmount>.001){
        const t=view.shakeClock*37;
        eye.y+=Math.sin(t)*shakeAmount*.14;
        eye.addScaledVector(r,Math.sin(t*1.7)*shakeAmount*.1);
      }
    }
    view.camera.fov+=(fov-view.camera.fov)*Math.min(1,dt*6);
    if(!view.snapped||(!menu&&view.mode==='tcam')){view.camera.position.copy(eye);view.look.copy(target);view.snapped=true;}else{view.camera.position.lerp(eye,1-Math.exp(-dt*11));view.look.lerp(target,1-Math.exp(-dt*13));}
    view.camera.lookAt(view.look);view.camera.updateProjectionMatrix();
    this.sun.position.set(car.x-80,100,car.z-65);this.sun.target.position.set(car.x,0,car.z);
    if(render)this.renderer.render(this.scene,view.camera);
  }
}
