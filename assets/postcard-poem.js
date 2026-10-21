import { clamp,ease } from './tree-model.js?v=2.2.0';
export const VERSE_DURATION=25.4;
export const VERSE_STARTS=Object.freeze([6.2,31.6,57]);
export const LINE_INTERVAL=1.45,LINE_FADE=1.35;
export const FULL_REVEAL=LINE_INTERVAL*3+LINE_FADE;
export const POEM_END=VERSE_STARTS[2]+VERSE_DURATION;
export function poemAt(time,selection=null){
  const index=selection?.index??(time<VERSE_STARTS[1]?0:time<VERSE_STARTS[2]?1:2);
  const start=selection?.at??VERSE_STARTS[index],next=VERSE_STARTS[index+1]??Infinity;
  const out=selection?1:1-ease((time-next+1.5)/1.5);
  return{index,visible:time>=VERSE_STARTS[0]||selection!==null,
    progress:clamp((time-VERSE_STARTS[index])/VERSE_DURATION),
    lines:Array.from({length:4},(_,i)=>ease((time-start-(selection?0:i*LINE_INTERVAL))/(selection ? .65 : LINE_FADE))*out)};
}

// Reading has its own clock, so pausing the poem keeps the tree alive.
export function createPoemPlayer(){
  let clock=0,automatic=true,selection=null;
  const fullTime=index=>VERSE_STARTS[index]+FULL_REVEAL;
  return{
    tick(delta){if(automatic){clock=Math.min(POEM_END,clock+Math.max(0,delta));if(clock>=POEM_END)automatic=false;}},
    select(index,animationTime,instant=false){
      const i=clamp(index,0,2);automatic=false;clock=fullTime(i);
      selection={index:i,at:instant?animationTime-1:animationTime};
    },
    toggle(animationTime){
      if(automatic){
        const index=poemAt(clock).index;automatic=false;clock=Math.max(clock,fullTime(index));
        selection={index,at:animationTime-1};
      }else{
        if(clock>=POEM_END)clock=VERSE_STARTS[0];
        automatic=true;selection=null;
      }
    },
    read(animationTime,{reduced=false}={}){
      const still=reduced?{index:selection?.index??poemAt(clock).index,at:-1}:selection;
      const state=poemAt(still?animationTime:clock,still);
      return{...state,automatic:automatic&&!reduced,manual:!!still,ended:clock>=POEM_END&&!selection,
        progress:clamp((clock-VERSE_STARTS[state.index])/VERSE_DURATION),intro:still?1:ease((clock-VERSE_STARTS[0])/1.2)};
    },
    reset(){clock=0;automatic=true;selection=null;}
  };
}
