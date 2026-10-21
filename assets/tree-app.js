import { createScene } from './tree-scene.js';
import { MATURE_AT } from './tree-model.js';

const card=document.querySelector('#card'),canvas=document.querySelector('#garden'),seed=document.querySelector('#seed');
const controls=document.querySelector('#controls'),pauseButton=document.querySelector('#pause'),replayButton=document.querySelector('#replay');
const status=document.querySelector('#status'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
let scene,active=false,paused=false,raf=0,elapsed=0,last=null,lastPaint=-Infinity,notified=false,pageHidden=false,resizeFrame=0;

function draw(){scene.render(active?(reduced.matches?MATURE_AT+1:elapsed):-1,{still:reduced.matches});}
function resize(){
  resizeFrame=0;
  const bounds=card.getBoundingClientRect();
  scene.resize(bounds.width,bounds.height,devicePixelRatio||1);draw();
}
function stop(){cancelAnimationFrame(raf);raf=0;last=null;}
function run(){if(active&&!paused&&!document.hidden&&!pageHidden&&!reduced.matches&&!raf)raf=requestAnimationFrame(frame);}
function frame(now){
  raf=0;
  if(paused||document.hidden||pageHidden||!active||reduced.matches){last=null;return;}
  if(last!==null)elapsed+=(now-last)/1000;
  last=now;
  if(now-lastPaint>=1000/60-.5){draw();lastPaint=now;}
  if(elapsed>=MATURE_AT&&!notified){
    notified=true;controls.hidden=false;
    status.textContent='Из сердца выросло дерево. Розовые и красные сердечки покачиваются на ветвях и медленно опадают. Можно приостановить или повторить открытку.';
  }
  run();
}
function setPaused(value){
  paused=value;pauseButton.setAttribute('aria-pressed',String(value));
  pauseButton.setAttribute('aria-label',value?'Продолжить анимацию':'Приостановить анимацию');
  document.querySelector('#pause-icon').setAttribute('d',value?'M9 5l10 7-10 7Z':'M9 6v12M15 6v12');
  stop();if(!paused)run();
}
function begin(){
  if(active)return;
  const heart=seed.querySelector('svg').getBoundingClientRect();
  scene.setSeedSize(heart.width/2.4);
  active=true;elapsed=0;lastPaint=-Infinity;notified=false;paused=false;
  seed.classList.add('departed');seed.disabled=true;seed.tabIndex=-1;card.focus({preventScroll:true});
  status.textContent='Сердце падает на землю. На его месте начинает расти дерево.';
  if(reduced.matches){controls.hidden=false;notified=true;status.textContent='Из сердца выросло дерево с розовыми и красными сердечками. Включён режим уменьшенного движения.';draw();}
  else{draw();run();}
}
function reset(){
  stop();active=false;elapsed=0;notified=false;scene.invalidate();
  setPaused(false);controls.hidden=true;
  seed.classList.remove('departed');seed.disabled=false;seed.removeAttribute('tabindex');
  draw();seed.focus({preventScroll:true});
  status.textContent='Нажмите на сердце, чтобы снова вырастить дерево.';
}
try{
  scene=createScene(canvas);resize();
  seed.addEventListener('click',begin);replayButton.addEventListener('click',reset);
  pauseButton.addEventListener('click',()=>setPaused(!paused));
  addEventListener('resize',()=>{if(!resizeFrame)resizeFrame=requestAnimationFrame(resize);},{passive:true});
  document.addEventListener('visibilitychange',()=>{stop();run();});
  addEventListener('pagehide',()=>{pageHidden=true;stop();});
  addEventListener('pageshow',()=>{pageHidden=false;run();});
  reduced.addEventListener('change',()=>{stop();scene.invalidate();draw();if(active)controls.hidden=false;run();});
  document.addEventListener('keydown',event=>{
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('button,a,input,textarea,select'))return;
    if(event.code==='Space'&&active){event.preventDefault();setPaused(!paused);}
    if(event.key==='Escape'&&active)setPaused(true);
  });
}catch(error){
  console.error('Card initialization failed:',error);
  seed.disabled=true;seed.querySelector('.invitation').textContent='Попробуй другой браузер';
  status.textContent='Браузер не поддерживает анимацию. Попробуйте открыть открытку в современном браузере.';
}
