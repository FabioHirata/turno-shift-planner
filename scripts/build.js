import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of ['index.html', 'style.css']) await copyFile(new URL(file, root), new URL(file, dist));
await cp(new URL('src/', root), new URL('src/', dist), { recursive: true });
console.log('Static site built in dist/');
