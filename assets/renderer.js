import { artLayout, clamp, mix, random, smooth, storyAt, DURATION } from './story.js';

const TAU = Math.PI * 2;
const INK = '#06080e';
const HUES = [[127,193,215],[139,151,220],[191,169,224],[233,189,133],[246,155,168],[238,216,174],[144,189,154],[249,237,215]];
const HUE_NORMALS = HUES.map(color => color.map(value => value / Math.max(...color)));
const GLYPHS = ' .·,:;~+=icxvoa*%8@';
const CW = 10, CH = 17, LEVELS = 16;
const rgba = (rgb, alpha = 1) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${clamp(alpha)})`;

function atlasFor(makeCanvas) {
  const atlas = makeCanvas(GLYPHS.length * CW, HUES.length * LEVELS * CH);
  const ctx = atlas.getContext('2d');
  ctx.font = '600 14px "Courier New", monospace'; ctx.textBaseline = 'alphabetic';
  for (let h = 0; h < HUES.length; h++) for (let l = 0; l < LEVELS; l++) {
    const gain = (l + 1) / LEVELS;
    ctx.fillStyle = rgba(HUES[h].map(v => Math.round(v * gain)));
    for (let c = 1; c < GLYPHS.length; c++) ctx.fillText(GLYPHS[c], c * CW + .7, (h * LEVELS + l) * CH + 13);
  }
  return atlas;
}

/** All illustration geometry is original, projected in 3D, and finally typeset as glyphs. */
export function createRenderer(canvas, makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h })) {
  const out = canvas.getContext('2d', { alpha: false });
  if (!out) throw new Error('Canvas 2D is unavailable');
  const raw = makeCanvas(1, 1), ctx = raw.getContext('2d', { willReadFrequently: true });
  const atlas = atlasFor(makeCanvas);
  const rng = random(8265);
  const stars = Array.from({ length: 230 }, () => ({ x: rng(), y: rng(), z: rng(), phase: rng() * TAU, a: rng() }));
  const seeds = Array.from({ length: 155 }, () => ({ x: rng(), y: rng(), z: rng(), p: rng() * TAU }));
  const branches = makeBranches();
  let width = 1, height = 1, cols = 1, rows = 1, pixelRatio = 1, layout, scale, cellX, cellY, quality = 1;
  let state, angle = 0, driftX = 0, driftY = 0;

  function resize(w, h, ratio = 1) {
    width = Math.max(1, w); height = Math.max(1, h);
    pixelRatio = Math.min(ratio, 1.75, Math.sqrt(3000000 / (width * height)));
    canvas.width = Math.round(width * pixelRatio); canvas.height = Math.round(height * pixelRatio);
    cols = Math.round(Math.min(204, Math.max(88, width / (width < 600 ? 3.5 : 6.7))) * quality);
    rows = Math.max(1, Math.round(cols * height / width * CW / CH));
    raw.width = cols; raw.height = rows;
    cellX = width / cols; cellY = height / rows;
    layout = artLayout(width, height);
    scale = Math.min(layout.w / (width / height > 1.25 ? 4.2 : 3.9), layout.h / 3.25);
  }

  function project([x, y, z = 0]) {
    const rx = x * Math.cos(angle) + z * Math.sin(angle);
    const rz = z * Math.cos(angle) - x * Math.sin(angle);
    const depth = 5.5 / Math.max(2.6, 5.5 + rz);
    return [(layout.x + (rx + driftX) * scale * depth) / cellX,
      (layout.y - (y + driftY) * scale * depth) / cellY, depth];
  }

  function line(points, color, alpha = 1, thickness = .75) {
    if (alpha < .002 || points.length < 2) return;
    ctx.beginPath();
    points.forEach((p, i) => { const q = project(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = thickness; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }

  function dot(point, color, alpha, size = .8) {
    if (alpha < .005) return;
    const p = project(point); ctx.fillStyle = rgba(color, alpha);
    ctx.fillRect(p[0] - size * .5, p[1] - size * .5, size, size);
  }

  function glow(point, size, color, alpha) {
    if (alpha < .002) return;
    const p = project(point), radius = size * scale * p[2] / cellX;
    ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(1, cellX / cellY);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(.1, radius));
    grad.addColorStop(0, rgba(color, alpha)); grad.addColorStop(.18, rgba(color, alpha * .55)); grad.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = grad; ctx.fillRect(-radius,-radius,radius * 2,radius * 2); ctx.restore();
  }

  function figure(x, y, z, size, alpha, color = HUES[2], facing = 0) {
    const head = [];
    for (let i = 0; i <= 32; i++) { const a = i / 32 * TAU; head.push([x + Math.cos(a) * .105 * size, y + (.88 + Math.sin(a) * .12) * size, z]); }
    line(head, color, alpha * .8, .65);
    for (const side of [-1, 1]) {
      line([[x + side * .07 * size, y + .75 * size, z], [x + side * .19 * size, y + .59 * size, z + .02],
        [x + side * .15 * size, y + .23 * size, z], [x + side * .28 * size, y - .11 * size, z + .04]], color, alpha, .9);
      line([[x + side * .055 * size, y + .18 * size, z], [x + side * .09 * size, y - .34 * size, z]], color, alpha * .75);
      line([[x + side * .18 * size, y + .56 * size, z], [x + side * (.30 + facing * .05) * size, y + .22 * size, z]], color, alpha * .65);
    }
    for (let i = 0; i < 7; i++) line([[x + (i - 3) * .034 * size, y + .64 * size, z], [x + (i - 3) * .06 * size, y - .08 * size, z]], color, alpha * .13, .6);
  }

  function water(alpha, warm = 0) {
    const color = warm > .5 ? HUES[3] : HUES[0];
    for (let row = 0; row < 26; row++) {
      const z = row * .21 - 1.4, points = [];
      for (let i = 0; i <= 68; i++) {
        const x = (i / 68 - .5) * 7;
        const ripple = Math.sin(x * 5.1 + z * 3.7 + state.t * TAU / 18) * .023;
        points.push([x, -1.04 + ripple, z]);
      }
      line(points, color, alpha * (.11 + (row / 26) * .08), .55);
    }
    for (let i = 0; i < 24; i++) {
      const z = 2.8 - i * .18, x = Math.sin(i * 1.9 + state.t * TAU / 18) * .10;
      const w = .035 + i * .007;
      line([[x - w, -1.02, z], [x + w, -1.02, z]], warm > .5 ? HUES[5] : HUES[2], alpha * .35, .7);
    }
  }

  function dream(alpha) {
    if (alpha < .002) return;
    water(alpha * .8);
    glow([0, .30, 2.8], .95, HUES[1], .20 * alpha);
    for (let frame = 6; frame >= 0; frame--) {
      const z = frame * .70, points = [[-.86, -1.02, z], [-.86, .48, z]];
      for (let i = 0; i <= 66; i++) { const a = Math.PI - i / 66 * Math.PI; points.push([Math.cos(a) * .86, .48 + Math.sin(a) * .91, z]); }
      points.push([.86, -1.02, z]);
      line(points, frame % 2 ? HUES[2] : HUES[0], alpha * (.65 - frame * .07), frame ? .65 : 1.1);
      // Small etched columns give the arch material instead of a neon outline.
      for (const side of [-1, 1]) line([[side * .92, -1.02, z], [side * .92, .50, z]], HUES[1], alpha * .23, .5);
    }
    figure(-.025, -.72, 3.45, .91, alpha * (.33 + state.breath * .18));
    const path = [];
    for (let i = 0; i <= 90; i++) { const f = i / 90, z = 3.5 - f * 5.2; path.push([Math.sin(f * 4.4 + state.t * TAU / DURATION) * .10 * f, -1 + Math.sin(f * 8 - state.t * TAU / 18) * .016, z]); }
    line(path, HUES[5], alpha * .85, 1.1);
    glow([-.02, -.25, 3.30], .25, HUES[5], alpha * (.48 + state.breath * .13));
    mist(alpha, HUES[1]);
  }

  function mist(alpha, color) {
    for (let band = 0; band < 8; band++) {
      const points = [];
      for (let i = 0; i <= 90; i++) {
        const x = (i / 90 - .5) * 6.2;
        points.push([x, -.35 + band * .145 + Math.sin(x * 1.3 + band + state.t * TAU / 36) * .12, 2.2 + band * .14]);
      }
      line(points, color, alpha * .075, 1.8);
    }
  }

  function distance(alpha) {
    if (alpha < .002) return;
    const care = smooth(45, 53, state.t);
    const landscape = alpha * (1 - care * .85);
    for (const side of [-1, 1]) {
      for (let j = 0; j < 9; j++) {
        const points = [];
        for (let i = 0; i <= 50; i++) { const f = i / 50; points.push([side * (.62 + f * 2.5), -.60 - j * .06 + Math.sin(f * 4 + j * .2) * .15, 1.7 + j * .08]); }
        line(points, HUES[1], landscape * .22, .65);
      }
      figure(side * 1.14, -.50, 1.75, .56, landscape * .65, HUES[0]);
      glow([side * 1.14, -.12, 1.74], .14, HUES[5], landscape * .52);
    }
    const thread = [];
    for (let i = 0; i <= 120; i++) {
      const f = i / 120, x = mix(-1.15, 1.15, f);
      thread.push([x, -.14 + Math.sin(f * Math.PI) * .38 + Math.sin(f * 9 + state.t * TAU / 18) * .025, 1.7 - Math.sin(f * Math.PI) * .5]);
    }
    line(thread, HUES[3], landscape * .7, .85);
    mist(landscape * 1.3, HUES[1]);
    if (care > 0) {
      const hold = care * alpha;
      hands(hold);
      const breath = .88 + state.breath * .12;
      glow([0, .16, 0], .83 * breath, HUES[3], hold * .21);
      glow([0, .16, -.1], .24 * breath, HUES[5], hold * .93);
      // A slow, rotating cloud makes the held light a volume, never a flat heart icon.
      for (let i = 0; i < 170; i++) {
        const a = i * 2.39996 + state.t * TAU / 36, y = 1 - 2 * (i + .5) / 170;
        const r = Math.sqrt(1 - y * y) * .155 * breath;
        dot([Math.cos(a) * r, .16 + y * .22 * breath, Math.sin(a) * r], HUES[i % 3 ? 3 : 5], hold * (.45 + .25 * Math.sin(a)), .58);
      }
      for (let k = 0; k < 4; k++) {
        const ribbon = [];
        for (let i = 0; i <= 64; i++) { const f = i / 64; ribbon.push([Math.sin(f * 6.5 + state.t * TAU / 18 + k) * (.07 + f * .16), .31 + f * .81, Math.cos(f * 6.5 + k) * .14]); }
        line(ribbon, k % 2 ? HUES[5] : HUES[2], hold * .16, .60);
      }
    }
  }

  function hands(alpha) {
    const segments = [
      [[1.67,-1.10,.15],[1.24,-.92,0],[1.07,-.70,0],[.78,-.65,0]],
      [[.78,-.65,0],[.50,-.62,0],[.20,-.44,0],[.04,-.34,0]],
      [[.04,-.34,0],[-.03,-.25,-.06],[.12,-.16,-.08],[.30,-.28,-.08]],
      [[.30,-.28,-.08],[.50,-.34,-.05],[.65,-.35,-.02],[.75,-.25,0]],
      [[.75,-.25,0],[.84,-.15,.02],[.87,.02,.03],[.96,-.01,.03]],
      [[.96,-.01,.03],[1.10,-.08,.02],[1.01,-.43,0],[1.08,-.46,.01]],
      [[1.08,-.46,.01],[1.27,-.63,.05],[1.46,-.64,.11],[1.91,-.77,.15]]
    ];
    for (const side of [-1, 1]) {
      for (const segment of segments) line(bezier(segment).map(p => [p[0] * side, p[1], p[2]]), HUES[5], alpha * .78, .9);
      for (let finger = 0; finger < 4; finger++) {
        const points = bezier([[.15 + finger * .09,-.40 - finger * .035,0],[.46,-.48 - finger * .035,0],[.69,-.45 - finger * .04,0],[.81 + finger * .035,-.40 - finger * .06,0]]);
        line(points.map(p => [p[0] * side,p[1],p[2]]), HUES[3], alpha * .37, .55);
      }
      for (let n = 0; n < 11; n++) line([[side * (.67 + n * .05), -.59 - n * .025, .02],[side * (.95 + n * .045), -.55 - n * .018, .04]], HUES[3], alpha * .12, .55);
    }
  }

  function spring(alpha) {
    if (alpha < .002) return;
    const dawn = state.dawn, bloom = state.bloom;
    glow([0, -.12, 3.3], 2.4, HUES[4], alpha * .12 * dawn);
    glow([0, -.23, 3.5], 1.05, HUES[5], alpha * .34 * dawn);
    const horizon = [];
    for (let i = 0; i <= 90; i++) { const x = (i / 90 - .5) * 6; horizon.push([x,-.89 + Math.sin(x * 2) * .025,2]); }
    line(horizon, HUES[4], alpha * .48, .8);
    water(alpha * .5, 1);
    const sun = [];
    for (let i = 0; i <= 65; i++) { const a = i / 65 * Math.PI; sun.push([Math.cos(a) * .54, -.57 + dawn * .34 + Math.sin(a) * .54, 3.4]); }
    line(sun, HUES[5], alpha * .65 * dawn, 1.0);
    for (const branch of branches) {
      const growth = smooth(branch.start, branch.start + .20, bloom);
      if (growth <= 0) continue;
      const sway = Math.sin(state.t * TAU / 18 + branch.side) * .025;
      const path = branch.path.slice(0, Math.max(2, Math.round(branch.path.length * growth))).map(p => [p[0] + sway * (p[1] + 1.3), p[1], p[2]]);
      line(path, HUES[6], alpha * .64, branch.level === 0 ? 1.2 : .65);
      if (branch.level > 0 && growth > .9) {
        const end = path[path.length - 1];
        flower(end, .055 + .040 * (1 - branch.level / 4), alpha * smooth(.9, 1, growth), branch.seed);
      }
    }
    const together = smooth(81, 89, state.t);
    figure(-mix(.62,.23,together), -.69, 2.5, .79, alpha * .73, HUES[5], 1);
    figure(mix(.62,.23,together), -.69, 2.5, .75, alpha * .73, HUES[4], -1);
    const joining = [];
    for (let i = 0; i <= 50; i++) { const f = i / 50; joining.push([mix(-.25,.25,f), -.31 - Math.sin(f * Math.PI) * .04, 2.46]); }
    line(joining, HUES[5], alpha * together * .8, .8);
    for (let i = 0; i < 20; i++) {
      const x = (i / 19 - .5) * 4.5, z = -1.1 + (i % 5) * .35, h = .12 + .21 * (Math.sin(i * 7.3) + 1) / 2;
      const sway = Math.sin(state.t * TAU / 18 + i) * .05;
      const growth = smooth(.10 + (i % 5) * .08, .65 + (i % 5) * .06, bloom);
      line([[x,-1.07,z],[x + sway,-1.07 + h * growth,z]], HUES[6], alpha * growth * .45, .6);
      flower([x + sway,-1.07 + h * growth,z], .04 + i % 3 * .009, alpha * growth * .7, i);
    }
  }

  function flower(center, radius, alpha, seed) {
    const opening = .78 + Math.sin(state.t * TAU / 36 + seed) * .05;
    for (let p = 0; p < 5; p++) {
      const a = p / 5 * TAU + seed;
      const points = [];
      for (let i = 0; i <= 14; i++) {
        const f = i / 14 * TAU, r = radius * opening;
        const d = .48 + .48 * Math.cos(f);
        points.push([center[0] + Math.cos(a) * r * d + Math.sin(a) * Math.sin(f) * r * .35,
          center[1] + Math.sin(a) * r * d - Math.cos(a) * Math.sin(f) * r * .35, center[2] + Math.sin(f) * .025]);
      }
      line(points, seed % 3 ? HUES[4] : HUES[5], alpha * .86, .75);
    }
    dot(center, HUES[5], alpha, .8);
  }

  function atmosphere() {
    for (const s of stars) {
      const x = (s.x + Math.sin(state.t * TAU / DURATION + s.phase) * .008 + 1) % 1;
      const y = s.y * (width / height > 1.25 ? .95 : .55);
      const twinkle = .65 + .35 * Math.sin(state.t * TAU / (s.a > .5 ? 12 : 18) + s.phase);
      ctx.fillStyle = rgba(HUES[s.a > .5 ? 1 : 0], (.10 + s.z * .27) * twinkle * (1 - state.spring * .8));
      ctx.fillRect(x * cols, y * rows, s.z > .92 ? .9 : .5, s.z > .92 ? .9 : .5);
    }
    for (const s of seeds) {
      // Integral windings over 108 s: petals and the opening dust share a seamless orbit.
      const phase = state.t * TAU / DURATION;
      const x = (s.x + phase / TAU * 2 + Math.sin(phase * 3 + s.p) * .03) % 1;
      const y = (s.y + phase / TAU + Math.sin(phase * 2 + s.p) * .025) % 1;
      const p = [(x - .5) * 5.3, (y - .5) * 3.2, s.z * 3 - 1];
      const a = (.07 + state.spring * .4 * state.bloom) * (.4 + s.z * .6);
      const color = state.spring > .4 ? (s.z > .5 ? HUES[4] : HUES[5]) : HUES[2];
      dot(p, color, a, state.spring > .5 ? .8 : .55);
      if (state.spring > .5 && s.z > .78) {
        const q = [p[0] + Math.cos(phase * 6 + s.p) * .028, p[1] + .018, p[2]];
        line([p,q], color, a, .6);
      }
    }
  }

  function typeset() {
    out.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); out.fillStyle = INK; out.fillRect(0,0,width,height);
    out.imageSmoothingEnabled = true;
    const data = ctx.getImageData(0,0,cols,rows).data;
    for (let i = 0; i < cols * rows; i++) {
      const j = i * 4, r = data[j], g = data[j+1], b = data[j+2];
      const peak = Math.max(r,g,b);
      if (peak < 10) continue;
      const brightness = clamp(peak / 155);
      let hue = 7, best = Infinity;
      for (let h = 0; h < HUES.length; h++) {
        const dr = r / peak - HUE_NORMALS[h][0], dg = g / peak - HUE_NORMALS[h][1], db = b / peak - HUE_NORMALS[h][2];
        const difference = dr * dr + dg * dg + db * db;
        if (difference < best) { best = difference; hue = h; }
      }
      const glyph = Math.max(1, Math.min(GLYPHS.length - 1, Math.floor(Math.pow(brightness, .66) * (GLYPHS.length - 1))));
      const level = Math.min(LEVELS - 1, Math.floor(Math.pow(brightness, .50) * LEVELS));
      out.drawImage(atlas, glyph * CW, (hue * LEVELS + level) * CH, CW, CH, (i % cols) * cellX, Math.floor(i / cols) * cellY, cellX + .15, cellY + .15);
    }
  }

  function render(time) {
    state = storyAt(time);
    const phase = state.t * TAU / DURATION;
    angle = Math.sin(phase) * .075; driftX = Math.sin(phase * 2) * .025; driftY = Math.sin(phase * 3) * .018;
    ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle = '#000'; ctx.fillRect(0,0,cols,rows);
    atmosphere(); dream(state.dream); distance(state.distance); spring(state.spring);
    typeset();
  }
  resize(canvas.width || 1, canvas.height || 1);
  return { resize, render, reduceQuality() { if (quality <= .70) return false; quality *= .84; resize(width,height,pixelRatio); return true; }, get grid() { return { cols, rows }; } };
}

function bezier([a,b,c,d], samples = 32) {
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples, u = 1 - t;
    return [0,1,2].map(k => a[k] * u ** 3 + 3 * b[k] * u * u * t + 3 * c[k] * u * t * t + d[k] * t ** 3);
  });
}

function makeBranches() {
  const result = [], rng = random(42);
  for (const side of [-1,1]) {
    function grow(start, angle, length, level, delay) {
      const end = [start[0] + Math.sin(angle) * length, start[1] + Math.cos(angle) * length, start[2] + (rng() - .5) * .25];
      const points = bezier([start, [start[0] + Math.sin(angle + .10) * length * .3, start[1] + length * .34, start[2]],
        [end[0] - Math.sin(angle) * length * .30, end[1] - length * .27, end[2]], end], 22);
      result.push({ path: points, level, start: delay, seed: result.length, side });
      if (level < 3) {
        grow(end, angle + side * .44, length * .64, level + 1, delay + .15);
        grow(points[16], angle - side * .56, length * .55, level + 1, delay + .18);
      }
    }
    grow([side * 1.84,-1.12,.20], -side * .42, 1.18, 0, 0);
  }
  return result;
}
