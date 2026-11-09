import * as C from './cannon-es.js';
export const PIN_SPOTS=[];
for(let row=0;row<4;row++)for(let col=0;col<=row;col++)PIN_SPOTS.push([(col-row/2)*.305,-18.29-row*.264]);
export class LanePhysics {
 constructor(){
  this.world=new C.World({gravity:new C.Vec3(0,-9.81,0)});this.world.solver.iterations=16;this.world.allowSleep=true;
  this.floorMat=new C.Material('wood');this.pinMat=new C.Material('pin');this.ballMat=new C.Material('ball');
  this.world.addContactMaterial(new C.ContactMaterial(this.pinMat,this.floorMat,{friction:.28,restitution:.08}));
  this.world.addContactMaterial(new C.ContactMaterial(this.pinMat,this.pinMat,{friction:.22,restitution:.35}));
  this.world.addContactMaterial(new C.ContactMaterial(this.ballMat,this.pinMat,{friction:.15,restitution:.8}));
  this.world.addContactMaterial(new C.ContactMaterial(this.ballMat,this.floorMat,{friction:.018,restitution:.08}));
  this.staticBox([.533,.1,10.6],[0,-.1,-9.6]);
  this.staticBox([1,.1,11],[0,-.32,-9.5]);
  for(let x of [-.94,.94])this.staticBox([.05,.35,10.6],[x,.02,-9.6]);
  this.staticBox([1,.7,.1],[0,.35,-20.2]);
  this.pins=[];this.ball=null;this.elapsed=0;this.rolling=false;this.gutter=false;this.bumpers=false;this.pattern='house';this.reset();
 }
 staticBox(s,p){let b=new C.Body({mass:0,material:this.floorMat,shape:new C.Box(new C.Vec3(...s)),position:new C.Vec3(...p)});this.world.addBody(b);}
 reset(){for(let p of this.pins)this.world.removeBody(p.body);this.pins=PIN_SPOTS.map(([x,z],id)=>{
  let b=new C.Body({mass:1.53,material:this.pinMat,position:new C.Vec3(x,.145,z),linearDamping:.14,angularDamping:.18,sleepSpeedLimit:.08,sleepTimeLimit:.5});
  // Compound pin profile, centered near its actual center of mass.
  let base=new C.Cylinder(.048,.052,.09,12);
  b.addShape(base,new C.Vec3(0,-.095,0));
  b.addShape(new C.Sphere(.060),new C.Vec3(0,-.015,0));
  b.addShape(new C.Sphere(.046),new C.Vec3(0,.065,0));
  b.addShape(new C.Sphere(.026),new C.Vec3(0,.135,0));
  b.addShape(new C.Sphere(.034),new C.Vec3(0,.197,0));
  this.world.addBody(b);return {body:b,id,x,z,down:false};
 });this.clearBall();}
 clearBall(){if(this.ball)this.world.removeBody(this.ball);this.ball=null;this.rolling=false;this.gutter=false;}
 sweep(){let gone=this.pins.filter(p=>p.down);for(let p of gone)this.world.removeBody(p.body);this.pins=this.pins.filter(p=>!p.down);for(let p of this.pins){p.body.velocity.setZero();p.body.angularVelocity.setZero();p.body.quaternion.set(0,0,0,1);p.body.position.y=.145;p.body.wakeUp();}this.clearBall();}
 launch({position=0,aim=0,power=70,hook=0,bumpers=false,pattern='house'}={}){
  this.clearBall();this.bumpers=bumpers;this.pattern=pattern;this.hook=hook;this.elapsed=0;this.rolling=true;
  let speed=5.5+power*.036;
  this.ball=new C.Body({mass:6.5,shape:new C.Sphere(.1085),material:this.ballMat,position:new C.Vec3(position,.113,0),linearDamping:.006,angularDamping:.01});
  this.ball.velocity.set(Math.sin(aim*Math.PI/180)*speed,0,-Math.cos(aim*Math.PI/180)*speed);
  this.ball.angularVelocity.set(-speed/.1085,0,hook*6);this.world.addBody(this.ball);
 }
 step(dt=1/120){
  if(!this.rolling)return false;this.elapsed+=dt;let b=this.ball;
  if(b.position.z<-.25&&b.position.z>-19.8){
   if(this.bumpers&&Math.abs(b.position.x)>.423){b.position.x=Math.sign(b.position.x)*.422;b.velocity.x=-Math.sign(b.position.x)*Math.abs(b.velocity.x)*.72;}
   if(!this.bumpers&&Math.abs(b.position.x)>.65)this.gutter=true;
   if(this.gutter){b.position.x=Math.sign(b.position.x)*.73;b.velocity.x=0;}
   else {let dry=this.pattern==='sport'?13.5:this.pattern==='dry'?7:10.5;
    let blend=Math.max(0,Math.min(1,(-b.position.z-dry)/3));b.velocity.x+=this.hook*blend*.52*dt;}
  }
  this.world.step(dt);
  for(let p of this.pins){let up=p.body.quaternion.vmult(new C.Vec3(0,1,0));p.down=up.y<.6||p.body.position.y<.095||Math.abs(p.body.position.x)>.63||p.body.position.z<-19.35;}
  let moving=this.pins.some(p=>p.body.velocity.length()>.08||p.body.angularVelocity.length()>.3);
  if(this.elapsed>9||(this.elapsed>4.2&&b.position.z<-19.7&&!moving)){this.rolling=false;return true;}return false;
 }
 knocked(){return this.pins.filter(p=>p.down).length;}
}
