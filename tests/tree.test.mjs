import test from 'node:test';
import assert from 'node:assert/strict';
import { createFall,FALL,GROW_AT,MATURE_AT,createTree,pointOn,branchProgress,insidePolygon,driftingLeaf,layout } from '../assets/tree-model.js';
import { poemAt,VERSE_STARTS,LINE_INTERVAL,LINE_FADE,createPoemPlayer,POEM_END } from '../assets/postcard-poem.js';

const tree=createTree();
test('heart accelerates, passes through the ground and slows in the soil without bouncing',()=>{
  const fall=createFall(250,1400,70),a=fall.at(.1),b=fall.at(.2),c=fall.at(.3);
  assert.ok(b.y-a.y<c.y-b.y);
  assert.ok(Math.abs(a.y-.5*1400*.1**2)<1e-10);
  let previous=0;
  for(let t=0;t<4;t+=.001){const s=fall.at(t);assert.ok(s.y>=previous);assert.ok(s.velocity>=0);previous=s.y;}
  assert.ok(fall.at(fall.impact+.2).y>250);
  assert.ok(Math.abs(fall.at(fall.impact-.00001).velocity-fall.at(fall.impact+.00001).velocity)<.2);
  assert.ok(Math.abs(fall.at(5).y-320)<1e-7);
  assert.ok(fall.at(5).buried);
  assert.ok(GROW_AT>FALL.duration);
});

test('curved branches remain connected as the smoother growth reaches each fork',()=>{
  for(const b of tree.branches){
    assert.ok(b.width>b.tip&&b.tip>0);
    if(b.parent===null)continue;
    const parent=tree.branches[b.parent],point=pointOn(parent,b.attach);
    assert.ok(Math.hypot(point.x-b.a.x,point.y-b.a.y)<1e-8);
    assert.ok(branchProgress(parent,b.born)>=b.attach-1e-7);
  }
  assert.ok(GROW_AT+tree.maxBloom<MATURE_AT);
});

test('the heart crown contains every branch and no leaf belongs to the bare trunk',()=>{
  for(const b of tree.branches.slice(1))for(let i=0;i<=80;i++){
    const p=pointOn(b,i/80);assert.ok(insidePolygon(p.x,p.y,tree.crown),`branch ${b.id} protrudes from the heart`);
  }
  for(const l of tree.leaves){assert.notEqual(l.branchId,0);assert.ok(insidePolygon(l.x,l.y,tree.crown));}
});

test('detached leaves begin at the attached pose, drift smoothly and settle without sliding',()=>{
  for(const leaf of tree.leaves.filter((_,i)=>i%43===0)){
    const initial=driftingLeaf(0,leaf),next=driftingLeaf(1/120,leaf),landed=driftingLeaf(42,leaf),later=driftingLeaf(46,leaf);
    assert.ok(Math.abs(initial.x-leaf.x)<1e-9);assert.ok(Math.abs(initial.y-leaf.y)<1e-9);
    assert.equal(initial.squash,1);assert.equal(initial.rotation,leaf.angle);
    assert.ok(Math.hypot(next.x-initial.x,next.y-initial.y)<.02);
    assert.ok(landed.settled);assert.equal(landed.x,later.x);assert.ok(later.y<=0);
    assert.ok(later.alpha<=landed.alpha);
    for(const v of Object.values(later))assert.ok(typeof v==='boolean'||Number.isFinite(v));
  }
});

test('responsive composition leaves a clear reading area on phones, tablets and landscape screens',()=>{
  for(const[w,h]of[[320,568],[390,844],[430,932],[768,1024],[1440,900],[844,390]]){
    const b=layout(w,h);
    assert.ok(b.x-250*b.scale>=0&&b.x+250*b.scale<=w);
    assert.ok(b.ground-700*b.scale>=0&&b.ground<h);
    if(b.wide)assert.ok(b.x+250*b.scale<w*.52);
    else assert.ok(b.ground<h*.62);
    const before=layout(w,h,3.19999),after=layout(w,h,3.20001);
    assert.ok(Math.abs(before.x-after.x)+Math.abs(before.ground-after.ground)<1e-6);
  }
});

test('all three stanzas receive uninterrupted reading time and the final verse remains visible',()=>{
  for(let i=0;i<3;i++){
    const full=VERSE_STARTS[i]+LINE_INTERVAL*3+LINE_FADE+.001;
    assert.deepEqual(poemAt(full).lines,[1,1,1,1]);
    assert.deepEqual(poemAt(full+17).lines,[1,1,1,1]);
  }
  assert.equal(poemAt(300).index,2);
  assert.deepEqual(poemAt(300).lines,[1,1,1,1]);
  const selected=poemAt(300,{index:0,at:12});
  assert.equal(selected.index,0);assert.deepEqual(selected.lines,[1,1,1,1]);
});


test('poem autoplay pauses independently, resumes the same verse and can restart after the end',()=>{
  const player=createPoemPlayer();player.tick(20);
  assert.equal(player.read(20).index,0);assert.equal(player.read(20).automatic,true);
  player.toggle(20);player.tick(60);
  assert.equal(player.read(80).index,0);assert.equal(player.read(80).automatic,false);
  assert.deepEqual(player.read(80).lines,[1,1,1,1]);
  player.toggle(80);player.tick(13);
  assert.equal(player.read(93).index,1);
  player.select(2,93,true);player.tick(100);
  assert.equal(player.read(193).index,2);assert.equal(player.read(193).automatic,false);
  player.toggle(193);player.tick(POEM_END);
  assert.equal(player.read(300).ended,true);assert.equal(player.read(300).automatic,false);
  player.toggle(300);player.tick(8);
  assert.equal(player.read(308).index,0);assert.equal(player.read(308).automatic,true);
  assert.deepEqual(player.read(308).lines,[1,1,1,1]);
});
