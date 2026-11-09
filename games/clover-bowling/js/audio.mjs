export class AudioFX {
 constructor(){this.ctx=null;this.muted=false;this.rollNode=null;}
 init(){if(!this.ctx){let AC=window.AudioContext||window.webkitAudioContext;if(AC)this.ctx=new AC();}if(this.ctx?.state==='suspended')this.ctx.resume();}
 tone(f,d=.15,type='sine',volume=.12){if(!this.ctx||this.muted)return;let t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(this.ctx.destination);o.start(t);o.stop(t+d);}
 noise(d,vol,low){if(!this.ctx||this.muted)return;let n=this.ctx.sampleRate*d,b=this.ctx.createBuffer(1,n,this.ctx.sampleRate),a=b.getChannelData(0);for(let i=0;i<n;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/n,2);let s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();s.buffer=b;f.type='lowpass';f.frequency.value=low;g.gain.value=vol;s.connect(f).connect(g).connect(this.ctx.destination);s.start();}
 launch(){this.noise(.5,.25,450);this.tone(80,.3,'sine',.18);}
 hit(v){this.noise(.1,Math.min(.4,v*.04),1900);this.tone(150+Math.random()*200,.07,'triangle',.07);}
 score(strike){[0,1,2,3].forEach((n)=>{if(!this.ctx||this.muted)return;let t=this.ctx.currentTime+n*.12,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.frequency.value=(strike?[392,494,587,784]:[330,392,494,659])[n];g.gain.setValueAtTime(.08,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g).connect(this.ctx.destination);o.start(t);o.stop(t+.3);});}
}
