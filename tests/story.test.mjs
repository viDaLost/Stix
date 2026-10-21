import test from 'node:test';
import assert from 'node:assert/strict';
import { DURATION, LINE_TIMES, POEM, artLayout, lineVisibility, storyAt } from '../assets/story.js';

test('each original line has enough uninterrupted time and every stanza can be read in full',() => {
  assert.equal(POEM.flat().length,12);
  for (let i = 0; i < 12; i++) {
    assert.equal(lineVisibility(LINE_TIMES[i] - .1,i),0);
    assert.equal(lineVisibility(LINE_TIMES[i] + 2,i),1);
    assert.equal(lineVisibility(LINE_TIMES[i] + 7.5,i),1);
  }
  for (let stanza = 0; stanza < 3; stanza++) {
    const t = LINE_TIMES[stanza * 4 + 3] + 8;
    assert.ok([0,1,2,3].every(n => lineVisibility(t,stanza * 4 + n) === 1));
  }
});
test('scene transitions preserve brightness and form a continuous loop',() => {
  for (let t = 0; t <= DURATION; t += .05) {
    const s = storyAt(t);
    assert.ok(Math.abs(s.dream + s.distance + s.spring - 1) < 1e-9);
    for (const key of ['dream','distance','spring','breath','dawn','bloom']) assert.ok(s[key] >= 0 && s[key] <= 1);
  }
  const first = storyAt(0), last = storyAt(DURATION - .0001);
  for (const key of ['dream','distance','spring','breath']) assert.ok(Math.abs(first[key] - last[key]) < .0001);
  assert.deepEqual(storyAt(-1),storyAt(DURATION - 1));
});
test('illustrations occupy the intended space on phone, desktop and short landscape',() => {
  for (const [w,h] of [[320,568],[390,844],[768,1024],[1440,900],[844,390]]) {
    const b = artLayout(w,h);
    assert.ok(b.x - b.w / 2 >= 0 && b.x + b.w / 2 <= w);
    assert.ok(b.y - b.h / 2 >= 0 && b.y + b.h / 2 <= h);
    if (w / h <= 1.25) assert.ok(b.y + b.h / 2 < h * .58);
    else assert.ok(b.x + b.w / 2 <= w * .53);
  }
});
