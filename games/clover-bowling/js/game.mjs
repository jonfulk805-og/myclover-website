import {Alley} from './scene.mjs';
import {LanePhysics} from './physics.mjs';
import {Scorecard} from './scoring.mjs';
import {AudioFX} from './audio.mjs';
const $=id=>document.getElementById(id),manual=new URLSearchParams(location.search).has('manual');
const phys=new LanePhysics(),audio=new AudioFX();let alley;
try{alley=new Alley($('scene'));}catch(e){$('loading').textContent='WebGL is unavailable. Enable hardware acceleration or try another browser.';throw e;}
let state='menu',mode='solo',pattern='house',bumpers=false,players=[],active=0,paused=false,practiceRacks=0,practicePins=0,practiceShots=0,practiceRackThrows=0,practiceRackNumber=1,callTime=0,last=performance.now(),acc=0,time=0,lastHit=0,frameNo=0,resultInfo=null,keys={},keyRemainders={};
const shot=()=>({position:+$('position').value/100,aim:+$('aim').value,power:+$('power').value,hook:+$('hook').value/100,pattern,bumpers});
function outputs(){let s=shot();$('positionOut').textContent=s.position===0?'Center':`${Math.abs(Math.round(s.position*100))} cm ${s.position<0?'L':'R'}`;$('aimOut').textContent=s.aim===0?'Straight':`${Math.abs(s.aim).toFixed(2)}° ${s.aim<0?'L':'R'}`;$('hookOut').textContent=s.hook===0?'None':`${Math.abs(Math.round(s.hook*100))}% ${s.hook<0?'L':'R'}`;$('powerOut').textContent=Math.round(s.power)+'%';}
for(let id of ['position','aim','hook','power'])$(id).addEventListener('input',outputs);
function notify(title,sub='',duration=2.5){$('callTitle').textContent=title;$('callSub').textContent=sub;$('callout').classList.add('show');callTime=duration;}
function drawScores(){
 if(mode==='practice'){$('scoreboard').innerHTML=`<div class="score-row" style="grid-template-columns:1fr 1fr 1fr"><div class="player-name"><b>PRACTICE</b><span>${bumpers?'BUMPERS ON':'NO PRESSURE. JUST PINS.'}</span></div><div class="total"><small>PINS / THROWS</small>${practicePins} / ${practiceShots}</div><div class="total"><small>RACKS CLEARED</small>${practiceRacks}</div></div>`;return;}
 $('scoreboard').innerHTML=players.map((p,pi)=>{let scores=p.scores();return `<div class="score-row"><div class="player-name"><b>PLAYER ${pi+1}</b><span>${pi===active&&!p.done?'YOUR TURN':p.done?'FINAL': 'ON DECK'}${bumpers?' / BUMPERS':''}</span></div>${p.frames.map((f,i)=>`<div class="cell ${pi===active&&p.frame===i&&!p.done?'active':''}"><small>${i+1}</small><span class="marks">${p.symbols(i).join(' ')||'·'}</span><span class="score">${scores[i]??' '}</span></div>`).join('')}<div class="total"><small>TOTAL</small>${p.total()}</div></div>`;}).join('');
}
function setUI(){document.body.dataset.gameState=state;let aiming=state==='aim',result=state==='result';$('pinMap').hidden=!['aim','result'].includes(state);$('controls').hidden=!(aiming||result);$('status').hidden=!['aim','roll','result'].includes(state);$('scoreboard').hidden=state==='menu';$('rolling').hidden=state!=='roll';$('bowl').hidden=!aiming;$('next').hidden=!result;for(let id of ['position','aim','hook','power'])$(id).disabled=!aiming;
 $('pause').disabled=['menu','end'].includes(state);$('turnLabel').textContent=mode==='practice'?'PRACTICE':`PLAYER ${active+1}`;
 $('frameLabel').textContent=mode==='practice'?`RACK ${practiceRackNumber}`:`FRAME ${players[active]?.frame+1||1} / 10`;
 $('pinLabel').textContent=`${phys.pins.filter(p=>!p.down).length} PINS STANDING`;
 let map=$('pinMap');if(map){let standing=new Set(phys.pins.filter(p=>!p.down).map(p=>p.id));map.innerHTML=Array.from({length:10},(_,i)=>{let row=Math.floor((Math.sqrt(8*i+1)-1)/2),col=i-row*(row+1)/2;return `<span class="pin-dot ${standing.has(i)?'up':''}" style="left:${34+(col-row/2)*16}px;top:${(3-row)*14}px">${i+1}</span>`;}).join('');}
 $('hint').textContent=result?resultInfo?.hint||'':mode==='practice'?'Try the same line with different hook and power.':'Aim for the pocket, just off the head pin.';
 $('next').innerHTML=(resultInfo?.end?'See results':(resultInfo?.swap!==null&&resultInfo?.swap!==undefined)?'Pass to player '+(resultInfo.swap+1):resultInfo?.rack?'Fresh rack':'Next ball')+' <span>ENTER</span>';
 $('callout').classList.toggle('show',callTime>0);
}
function bindSounds(){for(let p of phys.pins){p.body.addEventListener('collide',e=>{let v=Math.abs(e.contact.getImpactVelocityAlongNormal());if(v>1&&time-lastHit>.055){audio.hit(v);lastHit=time;}});}}
function rack(){phys.reset();bindSounds();}
function start(){audio.init();mode=$('mode').value;pattern=$('pattern').value;bumpers=$('bumpers').checked;alley.setFinish($('finish').value);players=[new Scorecard()];if(mode==='two')players.push(new Scorecard());active=0;practiceRacks=practicePins=practiceShots=practiceRackThrows=0;practiceRackNumber=1;rack();state='aim';paused=false;resultInfo=null;$('pause').textContent='Pause';$('menu').hidden=true;$('end').hidden=true;$('pauseOverlay').hidden=true;outputs();drawScores();setUI();notify('LET’S ROLL',mode==='two'?'PLAYER 1, YOU’RE UP':bumpers?'BUMPERS ON':'TEN FRAMES. MAKE THEM COUNT.',1.8);}
function launch(){if(state!=='aim'||paused)return;audio.init();phys.launch(shot());audio.launch();state='roll';callTime=0;setUI();}
function finishRoll(){if(state!=='roll')return;let n=phys.knocked(),remaining=phys.pins.length-n,standingBefore=phys.pins.length,oldFrame=players[active].frame,p=players[active],had=p.frames[oldFrame].slice(),complete=false;
 let strike=n===10,spare=!strike&&remaining===0;
 if(mode==='practice'){practicePins+=n;practiceShots++;practiceRackThrows++;if(remaining===0){practiceRacks++;}resultInfo={rack:remaining===0||practiceRackThrows>=2,end:false,hint:remaining?`${n} down. ${remaining} left. Adjust your line for the spare.`:'A clean deck. Try a new line.'};}
 else{complete=p.add(n);let end=players.every(x=>x.done),swap=null;if(complete&&players.length===2&&!end){let other=1-active;if(!players[other].done)swap=other;}
  let resetRack=complete||(oldFrame===9&&p.remaining()===10);
  resultInfo={rack:resetRack,end,swap,hint:end?'Ten frames in the books. See your final score.':complete?(swap!==null?`Player ${swap+1}, your frame is next.`:'Fresh frame. Find your line.'):resetRack?'Bonus ball. A fresh ten pins are waiting.':`${n} down. ${remaining} left. Pick up the spare.`};
 }
 let title=strike?'STRIKE!':spare?'SPARE!':n===0?(phys.gutter?'GUTTER BALL':'NO LUCK THIS TIME'):`${n} PINS DOWN`;
 if(phys.gutter&&n===0)resultInfo.hint='Moved too far outside. Bring your position or aim back toward center.';
 notify(title,strike?'TEN OUT OF TEN. THAT’S THE SOUND.':spare?'CLEANED IT UP.':remaining+' LEFT ON THE DECK',30);if(strike||spare)audio.score(strike);
 state='result';drawScores();setUI();
}
function next(){if(state!=='result'||paused)return;callTime=0;if(resultInfo.end){endGame();return;}if(resultInfo.swap!==null&&resultInfo.swap!==undefined)active=resultInfo.swap;
 if(resultInfo.rack){rack();practiceRackThrows=0;practiceRackNumber++;}else phys.sweep();
 state='aim';drawScores();setUI();if(players.length===2&&resultInfo.swap!==null)notify(`PLAYER ${active+1}`, 'YOUR LANE. YOUR SHOT.',1.7);
}
function endGame(){state='end';$('end').hidden=false;let max=Math.max(...players.map(p=>p.total())),winner=players.findIndex(p=>p.total()===max);$('endTitle').textContent=players.length===2?(players[0].total()===players[1].total()?'It’s a tie.':`Player ${winner+1} wins!`):max===300?'PERFECT GAME.':max>=200?'Pocket perfection.':max>=150?'That’s a good line.':'Nice game.';
 $('endScores').innerHTML=players.map((p,i)=>`<div class="final-player"><span>Player ${i+1}</span><b>${p.total()}</b></div>`).join('');
 let best=0;try{let key='clover_lanes_best_'+(bumpers?'bumpers':'open');best=Number(localStorage.getItem(key)||0);if(max>best){best=max;localStorage.setItem(key,String(best));}}catch(e){}
 $('best').textContent=`Personal best${bumpers?' (bumpers)':''}: ${best}${max===best?' · Top score!':''}`;setUI();}
function menu(){if(['aim','roll','result'].includes(state)&&!confirm('Leave this game and return to the menu?'))return;state='menu';paused=false;phys.clearBall();rack();$('menu').hidden=false;$('pauseOverlay').hidden=true;$('end').hidden=true;callTime=0;setUI();}
function pause(){if(['menu','end'].includes(state))return;paused=!paused;$('pauseOverlay').hidden=!paused;$('pause').textContent=paused?'Resume':'Pause';}
$('start').onclick=start;$('again').onclick=start;$('bowl').onclick=launch;$('next').onclick=next;$('menuBtn').onclick=menu;$('endMenu').onclick=menu;$('pause').onclick=pause;$('resume').onclick=pause;$('sound').onclick=()=>{audio.init();audio.muted=!audio.muted;$('sound').textContent='Sound: '+(audio.muted?'off':'on');};
$('skip').onclick=()=>{if(state==='roll'&&!paused){for(let i=0;i<1200&&state==='roll';i++)step(1/120);}};
addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes(document.activeElement?.tagName))return;if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.repeat)return;
 if(e.code==='Space')launch();if(e.code==='Enter'){if(state==='menu')start();else if(state==='result')next();else if(state==='aim')launch();}
 if(e.code==='KeyP'||e.code==='Escape')pause();});addEventListener('keyup',e=>keys[e.code]=false);addEventListener('blur',()=>{keys={};if(['aim','roll','result'].includes(state)&&!paused)pause();});
function step(dt){if(paused)return;time+=dt;if(callTime>0){callTime-=dt;if(callTime<=0)$('callout').classList.remove('show');}
 if(state==='aim'){
  const alter=(id,delta)=>{let e=$(id);let stepSize=+e.step||1;keyRemainders[id]=(keyRemainders[id]||0)+delta;let steps=Math.trunc(keyRemainders[id]/stepSize);if(steps){e.value=Math.max(+e.min,Math.min(+e.max,+e.value+steps*stepSize));keyRemainders[id]-=steps*stepSize;}};
  if(keys.KeyA||keys.KeyD)alter('aim',(Number(!!keys.KeyD)-Number(!!keys.KeyA))*dt*1.3);
  if(keys.ArrowLeft||keys.ArrowRight)alter('position',(Number(!!keys.ArrowRight)-Number(!!keys.ArrowLeft))*dt*28);
  if(keys.KeyQ||keys.KeyE)alter('hook',(Number(!!keys.KeyE)-Number(!!keys.KeyQ))*dt*70);
  if(keys.KeyW||keys.KeyS)alter('power',(Number(!!keys.KeyW)-Number(!!keys.KeyS))*dt*35);outputs();
 }
 if(state==='roll'&&phys.step(dt))finishRoll();
}
function render(dt=.016){alley.render({phys,shot:shot(),mode:state==='end'?'result':state,dt,time,bumpers});}
function frame(now){let dt=Math.min(.08,(now-last)/1000);last=now;acc+=dt;while(acc>=1/120){step(1/120);acc-=1/120;}render(dt);requestAnimationFrame(frame);}
outputs();setUI();render(10);$('loading').hidden=true;if(!manual)requestAnimationFrame(frame);
window.__BL={get state(){return state},get players(){return players},get active(){return active},get phys(){return phys},get result(){return resultInfo},get paused(){return paused},start,launch,next,step(n=1){for(let i=0;i<n;i++)step(1/120);},render,finishRoll,alley,shot,scoreClass:Scorecard};
