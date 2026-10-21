import { ease } from './tree-model.js?v=2.1.0';
export const VERSE_STARTS=Object.freeze([5.5,26,46.5]);
export const LINE_INTERVAL=2.1,LINE_FADE=1.6;
export function poemAt(time,selection=null){
  const index=selection?.index??(time<VERSE_STARTS[1]?0:time<VERSE_STARTS[2]?1:2);
  const start=selection?.at??VERSE_STARTS[index],next=VERSE_STARTS[index+1]??Infinity;
  const out=selection?1:1-ease((time-next+1.3)/1.3);
  return{index,visible:time>=VERSE_STARTS[0]||selection!==null,
    lines:Array.from({length:4},(_,i)=>ease((time-start-(selection?0:i*LINE_INTERVAL))/(selection ? .75 : LINE_FADE))*out)};
}
