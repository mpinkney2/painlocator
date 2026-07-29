/**
 * Static production build for Vercel.
 * Copies index.html, src/, and public/ (→ dist root) without bundling globals.
 */
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

execSync('npm run typecheck', { cwd: root, stdio: 'inherit' });

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

cpSync(join(root, 'index.html'), join(dist, 'index.html'));
cpSync(join(root, 'src'), join(dist, 'src'), { recursive: true });
cpSync(join(root, 'public'), dist, { recursive: true });

const anatomyFront = join(dist, 'anatomy', 'adult-male', 'front.png');
if (!existsSync(anatomyFront)) {
  console.error('Build verification failed: missing', anatomyFront);
  process.exit(1);
}

const overlaySample = join(dist, 'anatomy', 'overlays', 'overlay_muscle_male_front.svg');
if (!existsSync(overlaySample)) {
  console.error('Build verification failed: missing', overlaySample);
  process.exit(1);
}

console.log('Build complete → dist/');
console.log('  index.html');
console.log('  src/');
console.log('  anatomy/ (from public/anatomy/)');
console.log('  anatomy/overlays/ (schematic reference SVGs)');
