/**
 * Static production build for Vercel.
 * Copies index.html, src/, public/ (→ dist root), and api/ without bundling globals.
 */
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

execSync('npm run typecheck', { cwd: root, stdio: 'inherit' });
execSync('npm test', { cwd: root, stdio: 'inherit' });

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

cpSync(join(root, 'index.html'), join(dist, 'index.html'));
cpSync(join(root, 'src'), join(dist, 'src'), { recursive: true });
cpSync(join(root, 'public'), dist, { recursive: true });
if (existsSync(join(root, 'api'))) {
  cpSync(join(root, 'api'), join(dist, 'api'), { recursive: true });
}

const anatomyFront = join(dist, 'anatomy', 'adult-male', 'front.png');
if (!existsSync(anatomyFront)) {
  console.error('Build verification failed: missing', anatomyFront);
  process.exit(1);
}

const spatialGlb = join(dist, 'anatomy', 'spatial', 'adult-male', 'exterior-lod0.glb');
const spatialManifest = join(dist, 'anatomy', 'spatial', 'manifest.json');
if (!existsSync(spatialGlb) || !existsSync(spatialManifest)) {
  console.error('Build verification failed: missing spatial exterior assets');
  process.exit(1);
}

console.log('Build complete → dist/');
console.log('  index.html');
console.log('  src/');
console.log('  anatomy/ (from public/anatomy/)');
console.log('  api/ (serverless feedback)');
