import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoundtrack, SCORE } from '../assets/music.js';
import { DURATION } from '../assets/story.js';

// A graph-level audio fake checks scheduling and lifecycle without claiming acoustic verification.
class AudioParam {
  value = 0;
  setValueAtTime(v,t) { assert.ok(Number.isFinite(v) && Number.isFinite(t)); return this; }
  linearRampToValueAtTime(v,t) { return this.setValueAtTime(v,t); }
  exponentialRampToValueAtTime(v,t) { assert.ok(v > 0); return this.setValueAtTime(v,t); }
  setTargetAtTime(v,t) { return this.setValueAtTime(v,t); }
  cancelScheduledValues() {}
}
class Node {
  gain = new AudioParam(); frequency = new AudioParam(); detune = new AudioParam(); pan = new AudioParam();
  threshold = new AudioParam(); knee = new AudioParam(); ratio = new AudioParam(); attack = new AudioParam(); release = new AudioParam();
  connect() {} disconnect() {} start(t) { assert.ok(Number.isFinite(t)); }
  stop(t) { if (t === undefined) this.onended?.(); }
}
class FakeAudio {
  static instances = 0;
  currentTime = 0; sampleRate = 8000; destination = new Node(); state = 'suspended';
  constructor() { FakeAudio.instances++; }
  createGain() { return new Node(); } createOscillator() { return new Node(); } createStereoPanner() { return new Node(); }
  createBiquadFilter() { return new Node(); } createDynamicsCompressor() { return new Node(); } createConvolver() { return new Node(); }
  createBuffer(c,n) { return { getChannelData:() => new Float32Array(n) }; }
  async resume() { this.state = 'running'; } async suspend() { this.state = 'suspended'; }
}
test('music is silent until requested and mute releases every voice',async () => {
  const music = createSoundtrack({AudioContext:FakeAudio});
  assert.equal(music.contextState,'uninitialized'); music.tick(15); assert.equal(FakeAudio.instances,0);
  await music.setEnabled(true); music.tick(15); assert.equal(music.enabled,true); assert.ok(music.activeVoices > 0);
  await music.setEnabled(false); assert.equal(music.activeVoices,0); assert.equal(music.contextState,'suspended');
});
test('pause, resume, restart and loop reset scheduling without accumulating voices',async () => {
  const music = createSoundtrack({AudioContext:FakeAudio}); await music.setEnabled(true);
  for (let loop = 0; loop < 5; loop++) {
    music.tick(107.9); music.tick(0); assert.ok(music.activeVoices <= 5);
    await music.setPaused(true); assert.equal(music.activeVoices,0);
    await music.setPaused(false); music.tick(50); assert.ok(music.activeVoices > 0);
    music.reset(); assert.equal(music.activeVoices,0);
  }
});
test('score cues use valid times, gentle note ranges and unique identities',() => {
  assert.equal(new Set(SCORE.map(e => e.id)).size,SCORE.length);
  for (const event of SCORE) {
    assert.ok(event.at >= 0 && event.at < DURATION);
    assert.ok(event.duration > 0 && event.duration <= 11);
    assert.ok(event.notes.every(n => n >= 43 && n <= 81));
  }
});
