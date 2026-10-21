import { DURATION, LINE_TIMES, cycle } from './story.js';

const midi = note => 440 * 2 ** ((note - 69) / 12);
export const HARMONY = Object.freeze([
  [50,57,60,64], [46,53,57,62], [43,50,57,58], [45,52,55,60],
  [50,57,60,64], [46,53,60,62], [43,50,53,57], [48,55,62,64],
  [53,57,60,67], [48,55,59,62], [53,57,60,64], [50,57,60,64]
]);
const MELODY = [74,76,72,69, 69,67,74,76, 77,76,79,77];
export const SCORE = Object.freeze([
  ...HARMONY.map((notes,i) => Object.freeze({ id: `h${i}`, at: i * 9, kind: 'pad', notes, duration: 10.5 })),
  ...LINE_TIMES.map((at,i) => Object.freeze({ id: `l${i}`, at, kind: 'bell', notes: [MELODY[i]], duration: 4.8, gain: .12 })),
  ...Array.from({ length: 36 }, (_,i) => {
    const at = i * 3 + 4.2, chord = HARMONY[Math.floor(at / 9) % HARMONY.length];
    return Object.freeze({ id: `a${i}`, at, kind: 'bell', notes: [chord[(i + 1) % 4] + 12], duration: 3.7, gain: at > 70 && at < 99 ? .065 : .038 });
  }).filter(e => e.at < 105)
].sort((a,b) => a.at - b.at));

/** A completely local original score. No audio context exists before the listener clicks. */
export function createSoundtrack(host = globalThis) {
  let ctx, master, dry, reverb, compressor, enabled = false, lastTime = null, epoch = 0;
  const voices = new Set(), scheduled = new Set();

  function initialize() {
    if (ctx) return;
    const Audio = host.AudioContext || host.webkitAudioContext;
    if (!Audio) throw new Error('Этот браузер не поддерживает музыку');
    ctx = new Audio({ latencyHint: 'playback' });
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -23; compressor.knee.value = 18; compressor.ratio.value = 3;
    compressor.attack.value = .035; compressor.release.value = .7;
    master = ctx.createGain(); master.gain.value = 0;
    dry = ctx.createGain(); dry.gain.value = .75;
    const wet = ctx.createGain(); wet.gain.value = .29;
    reverb = ctx.createConvolver();
    const length = Math.floor(ctx.sampleRate * 3.2), impulse = ctx.createBuffer(2,length,ctx.sampleRate);
    let seed = 801;
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
        const f = i / length;
        data[i] = ((seed / 4294967296) * 2 - 1) * (1 - f) ** 3 * .35 * Math.min(1,i / (ctx.sampleRate * .025));
      }
    }
    reverb.buffer = impulse;
    dry.connect(master); reverb.connect(wet); wet.connect(master);
    master.connect(compressor); compressor.connect(ctx.destination);
  }

  function voice(note, at, duration, kind, gain, pan) {
    const envelope = ctx.createGain(), panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (panner.pan) panner.pan.value = pan;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = kind === 'pad' ? 1300 : 4400;
    envelope.connect(filter); filter.connect(panner); panner.connect(dry); panner.connect(reverb);
    const attack = kind === 'pad' ? 1.8 : .025;
    envelope.gain.setValueAtTime(0,at);
    envelope.gain.linearRampToValueAtTime(gain,at + Math.min(attack,duration * .22));
    if (kind === 'pad') {
      envelope.gain.linearRampToValueAtTime(gain * .78, at + duration * .65);
      envelope.gain.linearRampToValueAtTime(0,at + duration);
    } else {
      envelope.gain.exponentialRampToValueAtTime(.00001,at + duration);
    }
    const sources = [];
    const partials = kind === 'pad' ? [[1,1], [2,.12]] : [[1,1], [2,.19], [3,.035]];
    let remaining = partials.length;
    const entry = { stop() {
      for (const source of sources) { try { source.stop(); } catch {} }
      cleanup();
    } };
    function cleanup() {
      if (!voices.delete(entry)) return;
      sources.forEach(s => s.disconnect()); envelope.disconnect(); filter.disconnect(); panner.disconnect();
    }
    voices.add(entry);
    partials.forEach(([multiple,volume],i) => {
      const oscillator = ctx.createOscillator(), partialGain = ctx.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = midi(note) * multiple;
      oscillator.detune.value = kind === 'pad' ? (i ? 2 : -2) : 0;
      partialGain.gain.value = volume; oscillator.connect(partialGain); partialGain.connect(envelope);
      oscillator.onended = () => { partialGain.disconnect(); if (--remaining === 0) cleanup(); };
      oscillator.start(at); oscillator.stop(at + duration + .04); sources.push(oscillator);
    });
  }

  function playEvent(event, at, duration = event.duration) {
    const isPad = event.kind === 'pad';
    event.notes.forEach((note,i) => voice(note,at,duration,event.kind,isPad ? .035 : event.gain, (i - (event.notes.length - 1) / 2) * .23 + (isPad ? 0 : Math.sin(event.at) * .35)));
  }
  function clear() {
    for (const v of [...voices]) v.stop();
    scheduled.clear(); lastTime = null;
  }
  async function setEnabled(value) {
    if (!value) {
      enabled = false; clear();
      if (ctx) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0,ctx.currentTime,.08); await ctx.suspend(); }
      return false;
    }
    initialize(); await ctx.resume();
    if (ctx.state !== 'running') throw new Error('Коснитесь кнопки ещё раз, чтобы включить музыку');
    enabled = true; lastTime = null;
    master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(0,ctx.currentTime); master.gain.linearRampToValueAtTime(.42,ctx.currentTime + 1.2);
    return true;
  }
  function tick(time) {
    if (!enabled || ctx?.state !== 'running') return;
    const t = cycle(time), now = ctx.currentTime;
    if (lastTime === null || t < lastTime || t - lastTime > .8) {
      clear(); epoch++;
      const index = Math.min(11,Math.floor(t / 9));
      playEvent(SCORE.find(e => e.id === `h${index}`),now + .025,Math.max(.5,9 - (t % 9) + 1.5));
      scheduled.add(`${epoch}:h${index}`);
    }
    for (const event of SCORE) {
      const key = `${epoch}:${event.id}`;
      if (event.at >= t - .075 && event.at < t + .18 && !scheduled.has(key)) {
        scheduled.add(key); playEvent(event,now + Math.max(.025,event.at - t));
      }
    }
    lastTime = t;
  }
  async function setPaused(paused) {
    if (!ctx || !enabled) return;
    clear();
    if (paused) await ctx.suspend(); else await ctx.resume();
  }
  return { setEnabled, setPaused, tick, reset: clear,
    get enabled() { return enabled; }, get activeVoices() { return voices.size; }, get contextState() { return ctx?.state || 'uninitialized'; } };
}
