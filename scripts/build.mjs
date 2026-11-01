/**
 * Production build for Vercel.
 * Uses Vite to emit the Spatial ESM runtime chunk, while copying classic app scripts
 * and public anatomy assets into dist/.
 */
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

execSync('npm run typecheck', { cwd: root, stdio: 'inherit' });
execSync('npm test', { cwd: root, stdio: 'inherit' });

rmSync(dist, { recursive: true, force: true });
execSync('npx vite build', { cwd: root, stdio: 'inherit' });

// Vite copies public/ → dist. Ensure classic `src/` tree is present for non-module scripts.
if (!existsSync(join(dist, 'src'))) {
  cpSync(join(root, 'src'), join(dist, 'src'), { recursive: true });
} else {
  // Merge any classic files Vite did not emit as hashed assets.
  cpSync(join(root, 'src'), join(dist, 'src'), { recursive: true });
}

if (existsSync(join(root, 'api'))) {
  cpSync(join(root, 'api'), join(dist, 'api'), { recursive: true });
}

const anatomyFront = join(dist, 'anatomy', 'adult-male', 'front.png');
if (!existsSync(anatomyFront)) {
  console.error('Build verification failed: missing', anatomyFront);
  process.exit(1);
}

const requiredAnatomy = [
  join(dist, 'anatomy', 'spatial', 'manifest.json'),
  join(dist, 'anatomy', 'spatial', 'adult-male', 'manifest.json'),
  join(dist, 'anatomy', 'spatial', 'adult-male', 'exterior-lod0.glb'),
  join(dist, 'anatomy', 'spatial', 'prototype-bp3d-fullbody', 'canonical-body.glb'),
  join(dist, 'anatomy', 'spatial', 'prototype-bp3d', 'muscle.glb'),
  join(dist, 'anatomy', 'spatial', 'prototype-bp3d', 'skeletal.glb'),
  join(dist, 'anatomy', 'spatial', 'prototype-bp3d', 'manifest.json'),
  join(dist, 'anatomy', 'spatial', 'registration', 'bp3d-shoulder-adult-male.json')
];
for (const asset of requiredAnatomy) {
  if (!existsSync(asset)) {
    console.error('Build verification failed: missing spatial anatomy asset', asset);
    process.exit(1);
  }
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (!/spatial-bootstrap|assets\/.*\.js/.test(html)) {
  console.error('Build verification failed: Vite Spatial bootstrap chunk missing from index.html');
  process.exit(1);
}
if (/type="importmap"/.test(html)) {
  console.error('Build verification failed: obsolete Three import map still present');
  process.exit(1);
}

const assetsDir = join(dist, 'assets');
if (!existsSync(assetsDir)) {
  console.error('Build verification failed: dist/assets missing (Vite Spatial chunk)');
  process.exit(1);
}
const assetFiles = readdirSync(assetsDir);
const hasSpatialChunk = assetFiles.some((f) => /spatial|bootstrap|three|runtime/i.test(f) || f.endsWith('.js'));
if (!hasSpatialChunk) {
  console.error('Build verification failed: no JS assets emitted for Spatial runtime');
  process.exit(1);
}

console.log('Build complete → dist/');
console.log('  index.html (Vite-transformed)');
console.log('  assets/ (Spatial ESM runtime + hashed chunks)');
console.log('  src/ (classic CAE / app scripts)');
console.log('  anatomy/ (from public/anatomy/)');
console.log('  api/ (serverless feedback)');
