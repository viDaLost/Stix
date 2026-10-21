import { lineVisibility, storyAt } from './story.js';
import { createRenderer } from './renderer.js';
import { createSoundtrack } from './music.js';

const canvas = document.querySelector('#world');
const controls = document.querySelector('#sound-controls');
const button = document.querySelector('#sound-toggle');
const label = document.querySelector('#sound-label');
const status = document.querySelector('#sound-status');
const stanzas = [...document.querySelectorAll('.stanza')];
const lines = [...document.querySelectorAll('.stanza p')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const soundtrack = createSoundtrack();
let renderer, accumulated = 0, started = performance.now(), lastFrame = -Infinity;
let manualPause = false, hidden = document.hidden, pendingAudio = false, raf = 0, slowFrames = 0;
const time = () => accumulated + ((manualPause || hidden) ? 0 : (performance.now() - started) / 1000);

function freezeClock() { accumulated = time(); started = performance.now(); }
function resize() {
  renderer.resize(innerWidth, innerHeight, devicePixelRatio || 1);
  renderer.render(reduced.matches ? 94 : time());
}
function updateText(t) {
  const scene = storyAt(t);
  stanzas.forEach((stanza,i) => {
    stanza.style.opacity = '1'; stanza.dataset.current = String(scene.stanza === i);
  });
  lines.forEach((line,i) => {
    const opacity = lineVisibility(t,i);
    line.style.opacity = opacity.toFixed(3);
    line.style.transform = `translateY(${((1 - opacity) * 7).toFixed(2)}px)`;
  });
}
function frame(now) {
  raf = 0;
  if (hidden || manualPause) return;
  if (now - lastFrame >= (reduced.matches ? 95 : 1000 / 30)) {
    const t = time();
    if (!reduced.matches) {
      const before = performance.now(); renderer.render(t); updateText(t);
      slowFrames = performance.now() - before > 43 ? slowFrames + 1 : Math.max(0,slowFrames - 1);
      if (slowFrames >= 14) { renderer.reduceQuality(); slowFrames = 0; }
    }
    soundtrack.tick(t); lastFrame = now;
  }
  raf = requestAnimationFrame(frame);
}
function syncMotion() {
  document.body.classList.toggle('ready', !reduced.matches);
  document.body.classList.toggle('still', reduced.matches);
  resize();
  if (!reduced.matches) updateText(time());
}
function resumeFrames() { if (!raf && !hidden && !manualPause) raf = requestAnimationFrame(frame); }
function updateButton() {
  const playing = soundtrack.enabled;
  button.setAttribute('aria-pressed',String(playing));
  label.textContent = playing ? 'Музыка звучит' : 'Включи музыку';
}
async function toggleSound() {
  if (pendingAudio) return;
  pendingAudio = true; button.disabled = true;
  try {
    await soundtrack.setEnabled(!soundtrack.enabled);
    if (manualPause || hidden) await soundtrack.setPaused(true);
    soundtrack.tick(time()); updateButton();
    status.textContent = soundtrack.enabled ? 'Музыка включена' : 'Музыка выключена';
  } catch (error) { status.textContent = error.message; label.textContent = 'Включить ещё раз'; }
  finally { pendingAudio = false; button.disabled = false; }
}
function revealControls() { controls.hidden = false; }
async function pause() {
  freezeClock(); manualPause = !manualPause; started = performance.now();
  cancelAnimationFrame(raf); raf = 0;
  await soundtrack.setPaused(manualPause || hidden);
  if (!manualPause) resumeFrames();
  status.textContent = manualPause ? 'Пауза' : 'Анимация продолжается';
}

try {
  renderer = createRenderer(canvas); syncMotion();
  controls.hidden = false; resumeFrames();
  addEventListener('resize', resize, { passive: true });
  reduced.addEventListener('change',syncMotion);
  button.addEventListener('click',toggleSound);
  document.querySelector('#hide-controls').addEventListener('click',() => { controls.hidden = true; canvas.tabIndex = 0; canvas.focus({ preventScroll: true }); });
  canvas.addEventListener('pointerdown',revealControls);
  canvas.addEventListener('keydown',event => { if (event.key === 'Escape') revealControls(); });
  document.addEventListener('keydown',event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('button,input,textarea,select,a')) return;
    if (event.code === 'KeyM') { event.preventDefault(); revealControls(); void toggleSound(); }
    if (event.code === 'Space') { event.preventDefault(); void pause(); }
    if (event.code === 'Enter') {
      accumulated = 0; started = performance.now(); soundtrack.reset();
      if (!reduced.matches) { renderer.render(0); updateText(0); }
      status.textContent = 'Стихотворение началось заново';
    }
  });
  document.addEventListener('visibilitychange',() => {
    freezeClock(); hidden = document.hidden; started = performance.now();
    cancelAnimationFrame(raf); raf = 0;
    void soundtrack.setPaused(hidden || manualPause).catch(() => { status.textContent = 'Нажмите кнопку музыки для продолжения'; });
    resumeFrames();
  });
  addEventListener('pagehide',() => { freezeClock(); cancelAnimationFrame(raf); raf = 0; void soundtrack.setPaused(true); });
  addEventListener('pageshow',event => { if (event.persisted) { started = performance.now(); void soundtrack.setPaused(hidden || manualPause); resumeFrames(); } });
} catch (error) {
  document.body.classList.remove('ready'); document.body.classList.add('still');
  controls.hidden = true; status.textContent = 'Стихотворение доступно в спокойном режиме';
  console.error('Illustration initialization failed:',error);
}
