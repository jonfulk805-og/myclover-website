export class Scorecard {
 constructor(){this.frames=Array.from({length:10},()=>[]);this.frame=0;this.done=false;}
 add(n){
  if(this.done)throw Error('Game is over');
  let f=this.frames[this.frame],max=this.remaining();
  if(!Number.isInteger(n)||n<0||n>max)throw Error('Invalid pin count '+n+' / '+max);
  f.push(n);let complete=this.frame<9?(f[0]===10||f.length===2):(f.length===3||(f.length===2&&f[0]+f[1]<10));
  if(complete){if(this.frame===9)this.done=true;else this.frame++;}
  return complete;
 }
 remaining(){let f=this.frames[this.frame];if(this.frame<9)return f.length?10-f[0]:10;
  if(!f.length)return 10;if(f.length===1)return f[0]===10?10:10-f[0];
  return f[1]===10||f[0]!==10?10:10-f[1];
 }
 scores(){let flat=this.frames.flat(),off=0,total=0,waiting=false;return this.frames.map((f,i)=>{
  if(!f.length||waiting)return null;let score=null;
  if(i===9){if(this.done)score=f.reduce((a,b)=>a+b,0);}
  else if(f[0]===10){if(flat.length>=off+3)score=10+flat[off+1]+flat[off+2];}
  else if(f.length===2&&f[0]+f[1]===10){if(flat.length>=off+3)score=10+flat[off+2];}
  else if(f.length===2)score=f[0]+f[1];
  off+=f.length;if(score===null){waiting=true;return null;}total+=score;return total;
 });}
 total(){return this.scores().filter(x=>x!==null).at(-1)||0;}
 symbols(i){let f=this.frames[i];return f.map((n,j)=>{
   if(n===0)return '-';
   if(i<9)return n===10?'X':j===1&&f[0]+n===10?'/':String(n);
   if(n===10&&(j===0||f[j-1]===10||(j===2&&f[0]!==10)))return 'X';
   if(j===1&&f[0]!==10&&f[0]+n===10)return '/';
   if(j===2&&f[0]===10&&f[1]!==10&&f[1]+n===10)return '/';
   return String(n);
  });}
}
