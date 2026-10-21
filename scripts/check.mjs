import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { POEM, LINE_TIMES, DURATION } from '../assets/story.js';
const html = await readFile(new URL('../index.html',import.meta.url),'utf8');
for (const line of POEM.flat()) if (!html.includes(`<p>${line}</p>`)) throw new Error(`Poem text differs: ${line}`);
if (LINE_TIMES.length !== 12 || LINE_TIMES.at(-1) + 8 > DURATION) throw new Error('Insufficient reading time');
for (const file of await readdir(new URL('../assets/',import.meta.url))) {
  if (!file.endsWith('.js')) continue;
  const result = spawnSync(process.execPath,['--check',new URL(`../assets/${file}`,import.meta.url).pathname],{encoding:'utf8'});
  if (result.status) throw new Error(result.stderr);
}
for (const [,path] of html.matchAll(/(?:href|src)="\.\/(.*?)"/g)) await readFile(new URL(`../${path}`,import.meta.url));
if (/<(?:script|link)[^>]+(?:src|href)="https?:/.test(html)) throw new Error('Unexpected external dependency');
console.log('12 original lines verified; modules parse; all assets are local.');
