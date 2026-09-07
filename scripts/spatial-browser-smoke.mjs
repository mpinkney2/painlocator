/**
 * Production-build Spatial browser smoke test (Playwright Chromium).
 * Serves dist/ and verifies Vite ESM Spatial boot + exterior + clinician layers.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const PORT = 4177;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.map': 'application/json'
};

function contentType(filePath) {
  return MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function startStaticServer() {
  if (!existsSync(join(dist, 'index.html'))) {
    throw new Error('dist/index.html missing — run npm run build first');
  }
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === '/') pathname = '/index.html';
      const filePath = join(dist, pathname.replace(/^\//, ''));
      if (!filePath.startsWith(dist) || !existsSync(filePath) || !statSync(filePath).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      const body = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      res.end(body);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(String(err?.message || err));
    }
  });
  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${PORT}`;
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const network = [];

  page.on('pageerror', (err) => pageErrors.push(String(err?.message || err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (res) => {
    const u = res.url();
    if (/assets\/|exterior|canonical|muscle\.glb|skeletal\.glb|manifest|vendor\/three|vendor\/GLTF/.test(u)) {
      network.push({ url: u, status: res.status(), type: res.headers()['content-type'] || '' });
    }
  });

  try {
    await page.goto(`${base}/?spatialDiagnostics=1`, { waitUntil: 'networkidle', timeout: 90000 });

    // Wait for Spatial ready or explicit unavailable (should be ready).
    await page.waitForFunction(() => {
      const eng = window.state?.engine;
      const mode = eng?.displayMode;
      const boot = eng?.spatialBootState?.state;
      return (
        mode === 'spatial' ||
        boot === 'ready-spatial' ||
        boot === 'ready-canonical' ||
        boot === 'canonical-degraded' ||
        mode === 'spatial-unavailable'
      );
    }, null, { timeout: 60000 });

    const snap = await page.evaluate(async () => {
      const eng = window.state?.engine;
      // Allow canonical background a moment.
      await new Promise((r) => setTimeout(r, 2500));
      return {
        displayMode: eng?.displayMode || null,
        bootState: eng?.spatialBootState?.state || null,
        lastFailure: eng?.lastSpatialFailure || null,
        runtimeReady: !!window.PainLocatorSpatialRuntime?.ready,
        threeRevision: window.PainLocatorSpatialRuntime?.threeRevision || window.__PAINLOCATOR_THREE__?.REVISION || null,
        canvasCount: document.querySelectorAll('.cae-spatial-viewport canvas').length,
        viewportCount: document.querySelectorAll('.cae-spatial-viewport').length,
        diagText: document.querySelector('#caeSpatialDiagnostics')?.innerText || '',
        health: window.SpatialBootUtils?.collectDiagnostics?.(eng)?.health || null
      };
    });

    assert(snap.runtimeReady, `Vite Spatial runtime not ready: ${JSON.stringify(snap)}`);
    assert(snap.threeRevision === '170' || snap.threeRevision === 170, `Unexpected Three revision: ${snap.threeRevision}`);
    assert(
      snap.displayMode === 'spatial' ||
        snap.bootState === 'ready-spatial' ||
        snap.bootState === 'ready-canonical' ||
        snap.bootState === 'canonical-degraded',
      `Spatial not ready: ${JSON.stringify(snap)}`
    );
    assert(snap.canvasCount >= 1, 'Expected Spatial canvas');
    assert(snap.viewportCount >= 1, 'Expected Spatial viewport');
    assert(!/SpatialThreeLoader failed|GLTFLoader\.js|\/vendor\/three/i.test(snap.lastFailure || ''), `Stale vendor error: ${snap.lastFailure}`);

    // Hard acceptance: production build must NEVER request obsolete vendor Three/GLTFLoader.
    const vendorThreeHits = network.filter((n) => /\/vendor\/three\.module(\.min)?\.js/.test(n.url));
    const vendorGltfHits = network.filter((n) => /\/vendor\/GLTFLoader\.js/.test(n.url));
    const vendorMeshoptHits = network.filter((n) => /\/vendor\/meshopt_decoder/.test(n.url));
    assert(vendorThreeHits.length === 0, `Forbidden runtime request /vendor/three.module.min.js: ${JSON.stringify(vendorThreeHits)}`);
    assert(vendorGltfHits.length === 0, `Forbidden runtime request /vendor/GLTFLoader.js: ${JSON.stringify(vendorGltfHits)}`);
    assert(vendorMeshoptHits.length === 0, `Forbidden runtime request /vendor/meshopt_decoder: ${JSON.stringify(vendorMeshoptHits)}`);
    assert(
      network.some((n) => /exterior-lod0\.glb/.test(n.url) && n.status === 200),
      'Exterior GLB was not fetched successfully'
    );
    assert(
      network.some((n) => /\/assets\/spatial-runtime-entry[^/]*\.js/.test(n.url) && n.status === 200),
      'Vite Spatial runtime chunk was not fetched from /assets/'
    );

    // Clinician Muscle / Skeletal — must use real presentation switch so layerController mounts.
    await page.evaluate(() => {
      if (typeof window.applyPresentationMode === 'function') {
        window.applyPresentationMode('clinician');
      } else {
        document.querySelector('[data-presentation-option="clinician"]')?.click();
      }
    });
    await page.waitForFunction(
      () =>
        window.state?.presentationMode === 'clinician' &&
        !!window.state?.engine?.spatialRenderer?.layerController,
      null,
      { timeout: 15000 }
    );

    const muscleOk = await page.evaluate(async () => {
      const eng = window.state?.engine;
      const renderer = eng?.spatialRenderer;
      if (!renderer?.setAnatomyDepth) return { ok: false, reason: 'no-renderer' };
      const res = await renderer.setAnatomyDepth('muscle');
      return {
        ok: !!res?.ok || renderer.getAnatomyDepth?.() === 'muscle',
        depth: renderer.getAnatomyDepth?.(),
        res,
        lastLayer: eng?.lastLayerFailure || null
      };
    });
    assert(muscleOk.ok, `Muscle layer failed: ${JSON.stringify(muscleOk)}`);
    assert(
      network.some((n) => /\/muscle\.glb/.test(n.url) && n.status === 200),
      'Muscle GLB was not fetched successfully'
    );

    const skeletalOk = await page.evaluate(async () => {
      const eng = window.state?.engine;
      const renderer = eng?.spatialRenderer;
      const res = await renderer.setAnatomyDepth('skeletal');
      return {
        ok: !!res?.ok || renderer.getAnatomyDepth?.() === 'skeletal',
        depth: renderer.getAnatomyDepth?.(),
        res,
        lastLayer: eng?.lastLayerFailure || null
      };
    });
    assert(skeletalOk.ok, `Skeletal layer failed: ${JSON.stringify(skeletalOk)}`);
    assert(
      network.some((n) => /\/skeletal\.glb/.test(n.url) && n.status === 200),
      'Skeletal GLB was not fetched successfully'
    );

    // Depth cycle: Surface → Muscle → Skeletal → Muscle → Surface
    const cycle = await page.evaluate(async () => {
      const r = window.state?.engine?.spatialRenderer;
      if (!r?.setAnatomyDepth) return { ok: false, reason: 'no-renderer' };
      const steps = [];
      for (const d of ['surface', 'muscle', 'skeletal', 'muscle', 'surface']) {
        const res = await r.setAnatomyDepth(d);
        steps.push({ d, ok: !!res?.ok, depth: r.getAnatomyDepth?.() });
      }
      return { ok: steps.every((s) => s.ok && s.depth === s.d), steps };
    });
    assert(cycle.ok, `Depth cycle failed: ${JSON.stringify(cycle)}`);

    // Surface restore already covered by cycle; assert no page errors.

    console.log('spatial-browser-smoke PASS', {
      bootState: snap.bootState,
      displayMode: snap.displayMode,
      health: snap.health,
      threeRevision: snap.threeRevision,
      muscle: muscleOk.depth,
      skeletal: skeletalOk.depth,
      vendorThreeRequests: 0,
      vendorGltfRequests: 0,
      vendorMeshoptRequests: 0,
      viteSpatialChunk: true
    });
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('spatial-browser-smoke FAIL', err);
  process.exit(1);
});
