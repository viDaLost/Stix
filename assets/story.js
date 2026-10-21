export const DURATION = 108;
export const POEM = Object.freeze([
  Object.freeze(['Тебя найду я в тишине иллюзий', 'И в тайной, но живой мечте —', 'Без лишних слов, намёков и аллюзий,', 'По свету в полной темноте.']),
  Object.freeze(['Пускай меж нами вёрсты и молчанье,', 'И ночь скрывает силуэт,', 'Я сберегу в душе твоё дыханье,', 'Как самый тихий в мире свет.']),
  Object.freeze(['И если сон растает на рассвете,', 'Оставив в сердце тишину,', 'Я отыщу тебя на белом свете,', 'Чтоб разделить с тобой весну.'])
]);
export const LINE_TIMES = Object.freeze([1.8, 8.4, 15, 21.6, 35.8, 42.4, 49, 55.6, 69.8, 76.4, 83, 89.6]);
export const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const v = clamp((x - a) / (b - a)); return v * v * (3 - 2 * v); };
export const cycle = t => ((t % DURATION) + DURATION) % DURATION;
export function storyAt(time) {
  const t = cycle(time);
  const a = smooth(28, 36, t), b = smooth(60, 68, t), c = smooth(98, 108, t);
  return { t, dream: (1 - a) + c, distance: a * (1 - b), spring: b * (1 - c),
    breath: .5 - .5 * Math.cos(t * Math.PI / 3.6), dawn: smooth(65, 83, t), bloom: smooth(80, 96, t),
    stanza: t < 34 ? 0 : t < 68 ? 1 : 2 };
}
export function lineVisibility(time, index) {
  const t = cycle(time), stanza = Math.floor(index / 4);
  const start = LINE_TIMES[index], end = [31.5, 65.5, 101][stanza];
  return smooth(start, start + 1.65, t) * (1 - smooth(end, end + 2.4, t));
}
export function artLayout(width, height) {
  const wide = width / height > 1.25;
  return wide ? { x: width * .27, y: height * .5, w: width * .51, h: height * .83 }
    : { x: width * .5, y: height * .315, w: width * .94, h: height * .49 };
}
export function random(seed = 7) {
  let n = seed >>> 0;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
}
