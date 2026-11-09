import * as T from './three.module.min.js';
import {PIN_SPOTS} from './physics.mjs';
const C={green:0x75d6ad,gold:0xefbb62,red:0xbd433d,dark:0x101a1e};
export class Alley {
 constructor(canvas){
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.setSize(innerWidth,innerHeight);
  this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  this.scene=new T.Scene();this.scene.background=new T.Color(0x080d10);this.scene.fog=new T.FogExp2(0x080d10,.025);
  this.camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.05,100);this.camera.position.set(4,3.8,4);
  this.target=new T.Vector3(0,.1,-10);this.scene.add(new T.HemisphereLight(0xc7e5e5,0x3c2518,2.1));
  let light=new T.DirectionalLight(0xffdfb4,2.5);light.position.set(1,7,-7);this.scene.add(light);
  let fill=new T.PointLight(0x75d6ad,18,12,2);fill.position.set(-3,3,-17);this.scene.add(fill);
  this.materials={};this.pinMeshes=new Map();this.reflections=new Map();this.shadows=new Map();this.makeWorld();this.makeBall();this.makeGuide();
  addEventListener('resize',()=>{this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();});
 }
 mat(color,metalness=0,roughness=.5){return new T.MeshStandardMaterial({color,metalness,roughness});}
 box(w,h,d,x,y,z,mat){let m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);this.scene.add(m);return m;}
 cylinder(rt,rb,h,x,y,z,mat){let m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,24),mat);m.position.set(x,y,z);this.scene.add(m);return m;}
 texture(draw,w=1024,h=1024){let c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);let t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}
 makeWorld(){
  const wood=this.texture((c,w,h)=>{c.fillStyle='#be8a4d';c.fillRect(0,0,w,h);let seed=38;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
   for(let i=0;i<18;i++){let x=i*w/18,ww=w/18;c.fillStyle=`hsl(${32+rnd()*6},${38+rnd()*12}%,${47+rnd()*15}%)`;c.fillRect(x,0,ww,h);c.strokeStyle='#553c2635';c.strokeRect(x,0,ww,h);
    for(let j=0;j<90;j++){c.strokeStyle=`rgba(60,31,13,${rnd()*.12})`;c.lineWidth=rnd()*1.5;c.beginPath();let px=x+rnd()*ww;c.moveTo(px,0);c.bezierCurveTo(px+4,300,px-3,700,px+2,h);c.stroke();}
    for(let j=0;j<4;j++){let y=rnd()*h;c.fillStyle='#3a241820';c.fillRect(x,y,ww,2);}
   }
   let g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'#00000018');g.addColorStop(.5,'#ffffff20');g.addColorStop(1,'#00000018');c.fillStyle=g;c.fillRect(0,0,w,h);
  });wood.wrapS=T.RepeatWrapping;wood.wrapT=T.RepeatWrapping;wood.repeat.set(1,5);
  this.laneMat=new T.MeshStandardMaterial({map:wood,roughness:.19,metalness:.12});const gutter=this.mat(0x162126,.65,.32);let trim=this.mat(0x4f3a29,.55,.28);let dark=this.mat(C.dark,.25,.6);let gold=this.mat(C.gold,.6,.28);let carpet=this.mat(0x14242a,.05,.9);
  this.box(25,.22,32,0,-.45,-8,carpet);
  for(let x of [-5.4,-3.6,-1.8,0,1.8,3.6,5.4]){
   this.box(1.066,.18,21.5,x,-.09,-9.7,this.laneMat);
   for(let side of [-1,1]){this.box(.32,.1,21.5,x+side*.71,-.24,-9.7,gutter);this.box(.065,.16,21.5,x+side*.91,-.08,-9.7,trim);}
   this.box(1.7,.12,5.2,x,-.1,3.8,this.laneMat);
   this.box(1.075,.008,.035,x,.006,.2,dark);
   // Pin deck, approach dots and aiming arrows.
   for(let j=-3;j<=3;j++){
    let shape=new T.Shape();let xx=x+j*.128,zz=-4.6+Math.abs(j)*.12;shape.moveTo(xx-.018,zz+.06);shape.lineTo(xx+.018,zz+.06);shape.lineTo(xx,zz-.065);shape.closePath();
    let ar=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshBasicMaterial({color:0x3e3027,side:T.DoubleSide}));ar.rotation.x=Math.PI/2;ar.position.y=.008;this.scene.add(ar);
    let dot=this.cylinder(.012,.012,.003,xx,.008,-1.2,dark);
   }
   if(x!==0)for(let [px,pz] of PIN_SPOTS){let p=this.createPin();p.position.set(px+x,.145,pz);this.scene.add(p);}
   let strip=new T.MeshBasicMaterial({color:x===0?C.green:C.gold});this.box(.025,.015,21.3,x+.552,.01,-9.7,strip);this.box(.025,.015,21.3,x-.552,.01,-9.7,strip);
  }
  // Ceiling, trusses and warm linear pendants.
  this.box(24,.2,33,0,5.5,-8,dark);
  for(let z=3;z>-23;z-=4){this.box(22,.22,.18,0,5.15,z,this.mat(0x212e34,.6,.4));
   for(let x of [-4,0,4]){this.box(1.8,.12,.24,x,4.8,z,dark);this.box(1.65,.012,.16,x,4.735,z,new T.MeshBasicMaterial({color:0xffe2a1}));}
  }
  this.box(24,6,.3,0,2.5,-21.8,this.mat(0x111d21));
  for(let x=-10;x<=10;x+=.6)this.box(.06,3,.05,x,1.5,-21.61,this.mat(x%1.2===0?0x7e5e38:0x33464a,.4,.5));
  let sign=this.texture((c,w,h)=>{c.fillStyle='#111d21';c.fillRect(0,0,w,h);c.textAlign='center';c.font='900 98px system-ui';c.fillStyle='#efbb62';c.fillText('CLOVER LANES',w/2,140);c.font='20px system-ui';c.fillStyle='#75d6ad';c.fillText('F I N D   T H E   P O C K E T .',w/2,195);},1024,256);
  let sm=new T.Mesh(new T.PlaneGeometry(8,2),new T.MeshBasicMaterial({map:sign}));sm.position.set(0,3.25,-21.58);this.scene.add(sm);
  for(let x of [-5.4,-3.6,-1.8,0,1.8,3.6,5.4]){
   this.box(1.55,.5,.6,x,.28,-20.55,dark);this.box(1.5,.025,.025,x,.55,-20.23,new T.MeshBasicMaterial({color:C.green}));
   let screenTex=this.texture((c,w,h)=>{c.fillStyle='#0d1c22';c.fillRect(0,0,w,h);c.fillStyle='#75d6ad';c.font='bold 25px system-ui';c.fillText('CLOVER',20,38);c.fillStyle='#e9d2a0';c.font='bold 46px system-ui';c.fillText(x===0?'LANE 04':`LANE ${Math.round((x+5.4)/1.8)+1}`,20,96);c.fillStyle='#6a828a';for(let j=0;j<10;j++)c.fillRect(20+j*23,117,18,17);},256,160);
   this.box(.025,.8,.025,x,4.7,-4,dark);let screen=new T.Mesh(new T.PlaneGeometry(1.3,.8),new T.MeshBasicMaterial({map:screenTex}));screen.position.set(x,4.05,-4);screen.rotation.x=.12;this.scene.add(screen);
  }
  // Ball return and seating on the approach.
  this.box(.43,.7,1.4,1.18,.22,1.9,dark);this.box(.48,.12,1.6,1.18,.62,1.9,this.mat(0x38494e,.7,.24));
  for(let i=0;i<3;i++){let ball=new T.Mesh(new T.SphereGeometry(.11,20,12),this.mat([C.red,C.gold,C.green][i],.45,.2));ball.position.set(1.18,.78,1.45+i*.3);this.scene.add(ball);}
  for(let x of [-4,4]){this.box(1.5,.22,.65,x,.25,5.3,this.mat(0x613b30,.1,.6));this.box(1.5,.65,.15,x,.55,5.6,this.mat(0x613b30,.1,.6));for(let s of [-.6,.6])this.box(.06,.4,.45,x+s,0,5.3,gold);}
  this.makeBumpers();
 }
 createPin(){
  if(!this.pinGeometry){let points=[[0,0],[.043,0],[.051,.018],[.054,.06],[.061,.12],[.055,.16],[.038,.205],[.025,.25],[.025,.29],[.034,.325],[.033,.35],[.021,.372],[0,.38]].map(p=>new T.Vector2(...p));this.pinGeometry=new T.LatheGeometry(points,24);
   let tex=this.texture((c,w,h)=>{c.fillStyle='#f4f1e9';c.fillRect(0,0,w,h);c.fillStyle='#be3832';c.fillRect(0,h*.25,w,h*.027);c.fillRect(0,h*.31,w,h*.027);},64,256);
   this.pinMaterial=new T.MeshStandardMaterial({map:tex,roughness:.22,metalness:.08});}
  let group=new T.Group(),mesh=new T.Mesh(this.pinGeometry,this.pinMaterial);mesh.position.y=-.145;group.add(mesh);return group;
 }
 makeBall(){
  let tex=this.texture((c,w,h)=>{c.fillStyle='#174f39';c.fillRect(0,0,w,h);for(let i=0;i<50;i++){c.strokeStyle=i%3===0?'#b7d69788':'#7cb19d44';c.lineWidth=3+i%5;c.beginPath();c.moveTo(-30,i*23);c.bezierCurveTo(170,i*12,240,i*28,w+20,i*18);c.stroke();}},512,512);
  this.ballMat=new T.MeshStandardMaterial({map:tex,color:0xffffff,metalness:.45,roughness:.18});this.ballMesh=new T.Group();this.ballMesh.add(new T.Mesh(new T.SphereGeometry(.1085,40,32),this.ballMat));
  let holeMat=new T.MeshBasicMaterial({color:0x020908});for(let [x,y] of [[-.028,.04],[.028,.04],[0,-.025]]){let hole=new T.Mesh(new T.SphereGeometry(.012,10,8),holeMat);hole.scale.z=.25;hole.position.set(x,y,.099);this.ballMesh.add(hole);}this.scene.add(this.ballMesh);
  let shadowTex=this.texture((c,w,h)=>{let g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'#000000aa');g.addColorStop(.5,'#00000066');g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(0,0,w,h);},64,64);this.shadowMat=new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false});
  this.ballShadow=new T.Mesh(new T.PlaneGeometry(.35,.35),this.shadowMat);this.ballShadow.rotation.x=-Math.PI/2;this.scene.add(this.ballShadow);
  this.ballReflection=new T.Mesh(new T.SphereGeometry(.1085,24,16),new T.MeshBasicMaterial({color:0x499c74,transparent:true,opacity:.18,depthWrite:false}));this.ballReflection.scale.y=.6;this.scene.add(this.ballReflection);
 }
 makeBumpers(){this.bumpers=[];for(let side of [-1,1]){let m=this.box(.06,.13,19.8,side*.55,.08,-9.9,this.mat(0xb5a174,.65,.2));m.visible=false;this.bumpers.push(m);}}
 makeGuide(){this.guide=new T.Group();this.scene.add(this.guide);this.guideMat=new T.MeshBasicMaterial({color:C.green,transparent:true,opacity:.7,depthWrite:false});for(let i=0;i<70;i++){let dot=new T.Mesh(new T.SphereGeometry(.012,6,4),this.guideMat);dot.scale.y=.25;this.guide.add(dot);}}
 sync(phys){
  let ids=new Set(phys.pins.map(p=>p.id));for(let [id,m] of this.pinMeshes)if(!ids.has(id)){this.scene.remove(m,this.shadows.get(id));this.pinMeshes.delete(id);this.shadows.delete(id);}
  for(let p of phys.pins){let m=this.pinMeshes.get(p.id);if(!m){m=this.createPin();this.scene.add(m);this.pinMeshes.set(p.id,m);let s=new T.Mesh(new T.PlaneGeometry(.28,.28),this.shadowMat);s.rotation.x=-Math.PI/2;this.scene.add(s);this.shadows.set(p.id,s);}m.position.copy(p.body.position);m.quaternion.copy(p.body.quaternion);let s=this.shadows.get(p.id);s.position.set(m.position.x,.004,m.position.z);s.visible=m.position.y>-.1;}
  if(phys.ball){this.ballMesh.position.copy(phys.ball.position);this.ballMesh.quaternion.copy(phys.ball.quaternion);}
  this.ballShadow.position.set(this.ballMesh.position.x,.005,this.ballMesh.position.z);this.ballReflection.position.set(this.ballMesh.position.x,-.065,this.ballMesh.position.z);this.ballReflection.visible=this.ballMesh.position.y>.08;
 }
 preview(shot){this.ballMesh.position.set(shot.position,.1085,.05);this.ballMesh.quaternion.setFromAxisAngle(new T.Vector3(1,0,0),-.3);let v=5.5+shot.power*.036,angle=shot.aim*Math.PI/180;
  let x=shot.position,vx=Math.sin(angle)*v,z=0,dry=shot.pattern==='sport'?13.5:shot.pattern==='dry'?7:10.5;
  for(let i=0;i<70;i++){let delta=.25;z-=delta;let blend=Math.max(0,Math.min(1,(-z-dry)/3));vx+=shot.hook*blend*.52*delta/v;x+=vx*delta/v;let dot=this.guide.children[i];dot.position.set(x,.012,z);dot.visible=Math.abs(x)<.53;}
 }
 render({phys,shot,mode='aim',dt=.016,time=0,bumpers=false}){
  this.guide.visible=mode==='aim';this.bumpers.forEach(m=>m.visible=bumpers);
  if(mode==='aim'||mode==='menu')this.preview(shot);
  this.sync(phys);
  let dest=new T.Vector3(),target=new T.Vector3();
  let portrait=innerHeight>innerWidth;
  if(mode==='menu'){dest.set(3.3,2.4,2.9);target.set(-.3,.3,-9);}
  else if(mode==='roll'||mode==='result'){
   let z=phys.ball?phys.ball.position.z:0;z=Math.max(-18.4,Math.min(0,z));dest.set(.85,1.55,z+4.3);target.set(0,.2,Math.max(-19,z-3.8));
  }else{dest.set(portrait?.05:.18,portrait?3.4:2.3,portrait?6:4);target.set(0,.1,portrait?-2.7:-3);}
  let a=1-Math.exp(-dt*4);this.camera.position.lerp(dest,a);this.target.lerp(target,a);this.camera.lookAt(this.target);this.renderer.render(this.scene,this.camera);
 }
 setFinish(f){let colors={green:['#174f39','#98d5ad','#347958'],red:['#631e23','#ef9763','#b44a44'],gold:['#916020','#ffe4a4','#c4933e'],silver:['#29343c','#bbc9cf','#657885']}[f]||['#174f39','#98d5ad','#347958'];
  let old=this.ballMat.map;this.ballMat.map=this.texture((c,w,h)=>{c.fillStyle=colors[0];c.fillRect(0,0,w,h);for(let i=0;i<50;i++){c.strokeStyle=colors[i%2+1];c.globalAlpha=.35;c.lineWidth=3+i%5;c.beginPath();c.moveTo(-30,i*23);c.bezierCurveTo(170,i*12,240,i*28,w+20,i*18);c.stroke();}},512,512);old.dispose();this.ballMat.color.set(0xffffff);this.ballMat.needsUpdate=true;
 }
}
