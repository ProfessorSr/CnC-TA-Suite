import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateModuleCatalog } from './generate-module-catalog.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const out = resolve(repo, 'dist/chrome');
await generateModuleCatalog({ repo });
await import('./generate-research-assets.mjs');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await cp(resolve(repo, 'manifest/chrome/manifest.json'), resolve(out, 'manifest.json'));
await cp(resolve(repo, 'manifest/chrome/bridge.js'), resolve(out, 'manifest/chrome/bridge.js'), { recursive: true });
await cp(resolve(repo, 'manifest/chrome/suite.js'), resolve(out, 'manifest/chrome/suite.js'), { recursive: true });
await cp(resolve(repo, 'manifest/chrome/suite.css'), resolve(out, 'manifest/chrome/suite.css'), { recursive: true });
await cp(resolve(repo, 'core'), resolve(out, 'core'), { recursive: true });
await cp(resolve(repo, 'modules'), resolve(out, 'modules'), { recursive: true });
await cp(resolve(repo, 'assets'), resolve(out, 'assets'), { recursive: true, force: true });

console.log(`Built Chrome extension at ${out}`);
