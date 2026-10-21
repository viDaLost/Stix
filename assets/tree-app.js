import { createScene } from './tree-scene.js?v=2.1.0';
import { MATURE_AT } from './tree-model.js?v=2.1.0';
import { poemAt,VERSE_STARTS } from './postcard-poem.js?v=2.1.0';

const card=document.querySelector('#card'),canvas=document.querySelector('#garden'),seed=document.querySelector('#seed');
const controls=document.querySelector('#controls'),pauseButton=document.querySelector('#pause'),replayButton=document.querySelector('#replay');
const poem=document.querySelector('#poem'),stanzas=[...document.querySelectorAll('.postcard-stanza')];
const lines=stanzas.flatMap(s=>[...s.querySelectorAll('p')]),verseButtons=[...document.querySelectorAll('[data-verse]')];
const status=document.querySelector('#status'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const lastOpacity=Array(12).fill(-1);
let scene,active=false,paused=false,raf=0,elapsed=0,last=null,notified=false,pageHidden=false,resizeFrame=0,selection=null,verseIndex=-1,needsFit=true;

function fitPoem(){
  if(typeof getComputedStyle!=='function'){needsFit=false;return;}
  lines.forEach(line=>{line.style.fontSize='';});
  const available=poem.getBoundingClientRect().width-4;if(available<=0)return;
  const style=getComputedStyle(lines[0]),meter=document.createElement('canvas').getContext('2d');
  meter.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const natural=Math.max(...lines.map(line=>meter.measureText(line.textContent).width));
  if(natural>available){const size=parseFloat(style.fontSize)*available/natural;lines.forEach(line=>{line.style.fontSize=`${size}px`;});}
  needsFit=false;
}
function updatePoem(){
  if(!active){poem.hidden=true;return;}
  const manual=reduced.matches?{index:selection?.index??0,at:0}:selection;
  const t=reduced.matches?MATURE_AT+1:elapsed;
  const state=poemAt(t,manual);poem.hidden=!state.visible;
  if(!state.visible)return;
  if(needsFit)fitPoem();
  poem.style.opacity=reduced.matches||selection?'1':String(Math.min(1,(t-VERSE_STARTS[0])/1.2));
  if(verseIndex!==state.index){
    verseIndex=state.index;
    stanzas.forEach((s,i)=>s.setAttribute('aria-hidden',String(i!==verseIndex)));
    verseButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===verseIndex)));
  }
  lines.forEach((line,i)=>{
    const alpha=Math.floor(i/4)===state.index?state.lines[i%4]:0;
    if(lastOpacity[i]===alpha||(alpha>0&&alpha<1&&Math.abs(lastOpacity[i]-alpha)<.001))return;
    lastOpacity[i]=alpha;line.style.opacity=String(alpha);
    line.style.transform=alpha>=.999?'none':`translate3d(0,${(1-alpha)*5}px,0)`;
  });
}
function draw(){scene.render(active?(reduced.matches?MATURE_AT+1:elapsed):-1,{still:reduced.matches});updatePoem();}
function resize(){resizeFrame=0;needsFit=true;const bounds=card.getBoundingClientRect();scene.resize(bounds.width,bounds.height,devicePixelRatio||1);draw();}
function stop(){cancelAnimationFrame(raf);raf=0;last=null;}
function run(){if(active&&!paused&&!document.hidden&&!pageHidden&&!reduced.matches&&!raf)raf=requestAnimationFrame(frame);}
function frame(now){
  raf=0;
  if(paused||document.hidden||pageHidden||!active||reduced.matches){last=null;return;}
  // Every display refresh shares one clock. A long stalled frame never causes a large jump.
  if(last!==null)elapsed+=Math.min(.05,(now-last)/1000);
  last=now;draw();
  if(elapsed>=MATURE_AT&&!notified){
    notified=true;
    status.textContent='Дерево выросло. Красные и розовые сердечки медленно опадают с ветвей. Строфы стихотворения можно переключать тремя кнопками под текстом.';
  }
  run();
}
function setPaused(value){
  paused=value;pauseButton.setAttribute('aria-pressed',String(value));
  pauseButton.setAttribute('aria-label',value?'Продолжить анимацию':'Приостановить анимацию');
  document.querySelector('#pause-icon').setAttribute('d',value?'M9 5l10 7-10 7Z':'M9 6v12M15 6v12');
  stop();updatePoem();if(!paused)run();
}
function selectVerse(index){
  if(!active)return;
  selection={index,at:paused?elapsed-1:elapsed};updatePoem();
  status.textContent=['Первая строфа.','Вторая строфа.','Третья строфа.'][index]+' Автоматическое переключение остановлено, чтобы вы могли читать в своём темпе.';
}
function begin(){
  if(active)return;
  scene.setSeedSize(seed.querySelector('svg').getBoundingClientRect().width/2.4);
  active=true;elapsed=0;notified=false;paused=false;selection=null;verseIndex=-1;needsFit=true;lastOpacity.fill(-1);
  seed.classList.add('departed');seed.disabled=true;seed.tabIndex=-1;controls.hidden=false;card.focus({preventScroll:true});
  status.textContent='Сердце опускается под землю. Из этого места вырастает дерево любви, и постепенно появляются строки стихотворения.';
  if(reduced.matches){notified=true;status.textContent='Дерево любви и первая строфа стихотворения. Выберите другую строфу кнопками под текстом. Включён режим уменьшенного движения.';}
  draw();run();
}
function reset(){
  stop();active=false;elapsed=0;notified=false;selection=null;verseIndex=-1;needsFit=true;lastOpacity.fill(-1);scene.invalidate();
  setPaused(false);controls.hidden=true;poem.hidden=true;
  seed.classList.remove('departed');seed.disabled=false;seed.removeAttribute('tabindex');draw();seed.focus({preventScroll:true});
  status.textContent='Нажмите на сердце, чтобы снова открыть открытку.';
}
try{
  scene=createScene(canvas);resize();
  seed.addEventListener('click',begin);replayButton.addEventListener('click',reset);
  pauseButton.addEventListener('click',()=>setPaused(!paused));
  verseButtons.forEach((button,i)=>button.addEventListener('click',()=>selectVerse(i)));
  addEventListener('resize',()=>{if(!resizeFrame)resizeFrame=requestAnimationFrame(resize);},{passive:true});
  document.addEventListener('visibilitychange',()=>{stop();run();});
  addEventListener('pagehide',()=>{pageHidden=true;stop();});
  addEventListener('pageshow',()=>{pageHidden=false;run();});
  reduced.addEventListener('change',()=>{stop();scene.invalidate();lastOpacity.fill(-1);draw();run();});
  document.addEventListener('keydown',event=>{
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('button,a,input,textarea,select'))return;
    if(event.code==='Space'&&active){event.preventDefault();setPaused(!paused);}
    if(event.key==='Escape'&&active)setPaused(true);
  });
}catch(error){
  console.error('Card initialization failed:',error);seed.disabled=true;seed.querySelector('.invitation').textContent='Попробуй другой браузер';
  status.textContent='Браузер не поддерживает анимацию. Попробуйте открыть открытку в современном браузере.';
}
