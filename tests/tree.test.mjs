import test from 'node:test';
import assert from 'node:assert/strict';
import { createFall, FALL, GROW_AT, MATURE_AT, createTree, pointOn, driftingLeaf, layout } from '../assets/tree-model.js';

test('heart accelerates under gravity, loses rebound energy and rests on the ground',()=>{
  const fall=createFall(250,1400,.2);
  const a=fall.at(.1),b=fall.at(.2),c=fall.at(.3);
  assert.ok(b.y-a.y<c.y-b.y);
  assert.ok(Math.abs(a.y-.5*1400*.1**2)<1e-10);
  for(let t=0;t<4;t+=.001)assert.ok(fall.at(t).y<=250+1e-9);
  assert.ok(fall.at(fall.impact+.001).velocity<0);
  assert.ok(Math.abs(fall.at(fall.impact+.001).velocity)<1400*fall.impact*.21);
  assert.deepEqual(fall.at(10),{y:250,velocity:0,landed:true,impactAge:10-fall.impact});
  assert.ok(Math.abs(fall.at(fall.impact-.00001).y-fall.at(fall.impact+.00001).y)<.02);
  assert.ok(GROW_AT>FALL.duration);
});

test('every branch grows from an existing parent and tapers toward its tip',()=>{
  const tree=createTree();
  for(const b of tree.branches){
    assert.ok(b.width>b.tip&&b.tip>0);
    if(b.parent===null)continue;
    const parent=tree.branches[b.parent],point=pointOn(parent,b.attach);
    assert.ok(Math.hypot(point.x-b.a.x,point.y-b.a.y)<1e-8);
    assert.ok(b.born>=parent.born+parent.duration*b.attach-1e-8);
    assert.ok(b.width<=parent.width);
  }
  assert.ok(GROW_AT+tree.maxBloom<MATURE_AT,'leaves finish unfurling before the first one falls');
});

test('fallen leaves settle without sliding and fade after resting',()=>{
  const tree=createTree();
  for(const leaf of tree.leaves.filter((_,i)=>i%27===0)){
    const initial=driftingLeaf(0,leaf),landed=driftingLeaf(42,leaf),later=driftingLeaf(46,leaf);
    assert.ok(Math.abs(initial.x-leaf.x)<1e-9);
    assert.ok(Math.abs(initial.y-leaf.y)<1e-9);
    assert.ok(landed.settled);
    assert.equal(landed.x,later.x);
    assert.ok(later.y<=0);
    assert.ok(later.alpha<=landed.alpha);
    for(const value of Object.values(later))assert.ok(typeof value==='boolean'||Number.isFinite(value));
  }
});

test('entire crown and trunk fit narrow phones, tablets, desktop and landscape',()=>{
  for(const [w,h] of [[320,568],[390,844],[430,932],[768,1024],[1440,900],[844,390]]){
    const b=layout(w,h);
    assert.ok(b.x-250*b.scale>=0&&b.x+250*b.scale<=w);
    assert.ok(b.ground-700*b.scale>=0&&b.ground<h);
  }
});
