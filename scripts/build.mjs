import { cp, mkdir, rm } from 'node:fs/promises';
const root = new URL('../',import.meta.url), dist = new URL('../dist/',import.meta.url);
await rm(dist,{recursive:true,force:true}); await mkdir(dist,{recursive:true});
for (const item of ['index.html','poem.html','.nojekyll','assets']) await cp(new URL(item,root),new URL(item,dist),{recursive:true});
console.log('Static GitHub Pages site prepared in dist/');

