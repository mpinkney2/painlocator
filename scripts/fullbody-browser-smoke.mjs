/**
 * Optional full-body anatomy smoke (?fullBodyAnatomy=1) against dist/.
 * Run after npm run build. Skipped from default unit tests (payload/network heavy).
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const PORT = 4188;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.map': 'application/json'
};

function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = join(dist, pathname.replace(/^\//, ''));
    if (!filePath.startsWith(dist) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end('nf');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
  return new Promise((r) => server.listen(PORT, '127.0.0.1', () => r(server)));
}

const server = await startServer();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader']
});
const page = await browser.newPage();
const packs = [];
page.on('response', (res) => {
  if (/prototype-bp3d-fullbody-msk\/packs\/.+\.glb/.test(res.url()) && res.status() === 200) {
    packs.push(res.url());
  }
});
try {
  await page.goto(`http://127.0.0.1:${PORT}/?fullBodyAnatomy=1&spatialDiagnostics=1`, {
    waitUntil: 'networkidle',
    timeout: 120000
  });
  await page.waitForFunction(
    () => window.state?.engine?.displayMode === 'spatial',
    null,
    { timeout: 90000 }
  );
  await page.evaluate(() => window.applyPresentationMode?.('clinician'));
  await page.waitForFunction(
    () => !!window.state?.engine?.spatialRenderer?.layerController,
    null,
    { timeout: 20000 }
  );
  const muscle = await page.evaluate(async () => {
    const r = window.state.engine.spatialRenderer;
    const res = await r.setAnatomyDepth('muscle');
    const pack = r.layerController?._packs?.get('muscle');
    return {
      ok: !!res?.ok,
      meshCount: pack?.meshById?.size || 0,
      fullBody: !!pack?.fullBody,
      packs: pack?.loadedPackIds || []
    };
  });
  if (!muscle.ok || !muscle.fullBody || muscle.meshCount < 100) {
    throw new Error(`Muscle full-body failed: ${JSON.stringify(muscle)}`);
  }
  const skeletal = await page.evaluate(async () => {
    const r = window.state.engine.spatialRenderer;
    const res = await r.setAnatomyDepth('skeletal');
    const pack = r.layerController?._packs?.get('skeletal');
    return {
      ok: !!res?.ok,
      meshCount: pack?.meshById?.size || 0,
      fullBody: !!pack?.fullBody
    };
  });
  if (!skeletal.ok || !skeletal.fullBody || skeletal.meshCount < 50) {
    throw new Error(`Skeletal full-body failed: ${JSON.stringify(skeletal)}`);
  }
  console.log('fullbody-browser-smoke PASS', {
    muscleMeshes: muscle.meshCount,
    skeletalMeshes: skeletal.meshCount,
    musclePacks: muscle.packs.length,
    glbHits: packs.length
  });
} finally {
  await browser.close();
  server.close();
}
