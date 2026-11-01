import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const url = process.argv[2] || 'https://painlocator.vercel.app/?spatialDiagnostics=1';
mkdirSync('/opt/cursor/artifacts/screenshots', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});
const page = await browser.newPage();
const consoleLogs = [];
const pageErrors = [];
const failedRequests = [];
const responses = [];

page.on('console', (msg) => {
  consoleLogs.push({ type: msg.type(), text: msg.text() });
});
page.on('pageerror', (err) => {
  pageErrors.push(String(err?.message || err));
});
page.on('requestfailed', (req) => {
  failedRequests.push({ url: req.url(), error: req.failure()?.errorText || 'failed' });
});
page.on('response', async (res) => {
  const u = res.url();
  if (/vendor\/|spatial|three|GLTF|meshopt|exterior|canonical|muscle|skeletal|\.glb|\.js/.test(u)) {
    responses.push({
      url: u.replace(/https:\/\/painlocator\.vercel\.app/, ''),
      status: res.status(),
      type: res.headers()['content-type'] || ''
    });
  }
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(8000);

const snapshot = await page.evaluate(() => {
  const eng = window.state?.engine;
  return {
    hasSpatialThreeLoader: typeof window.SpatialThreeLoader,
    hasBootUtils: typeof window.SpatialBootUtils,
    hasTHREE: !!(window.__PAINLOCATOR_THREE__ && window.__PAINLOCATOR_THREE__.WebGLRenderer),
    threeRevision: window.__PAINLOCATOR_THREE__?.REVISION || null,
    displayMode: eng?.displayMode || null,
    bootState: eng?.spatialBootState || null,
    lastSpatialFailure: eng?.lastSpatialFailure || null,
    canvasCount: document.querySelectorAll('canvas').length,
    viewportCount: document.querySelectorAll('.cae-spatial-viewport').length,
    unavailable: !!document.querySelector('.cae-spatial-status-title') &&
      /unavailable/i.test(document.querySelector('.cae-spatial-status-title')?.textContent || ''),
    statusTitle: document.querySelector('.cae-spatial-status-title')?.textContent || null,
    statusTech: document.querySelector('.cae-spatial-status-tech')?.textContent || null,
    diagPresent: !!document.getElementById('caeSpatialDiagnostics'),
    diagText: document.querySelector('#caeSpatialDiagnostics')?.innerText?.slice(0, 1500) || null,
    webgl: (() => {
      try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        return gl ? gl.getParameter(gl.VERSION) : null;
      } catch (e) {
        return 'err:' + e;
      }
    })()
  };
});

await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/prod-spatial-repro.png', fullPage: true });
await browser.close();

const report = {
  url,
  snapshot,
  pageErrors,
  failedRequests: failedRequests.slice(0, 40),
  consoleErrors: consoleLogs.filter((l) => l.type === 'error' || l.type === 'warning').slice(0, 50),
  consoleInfoSpatial: consoleLogs.filter((l) => /Spatial|Three|PainLocator|CAE/i.test(l.text)).slice(0, 40),
  keyResponses: responses.slice(0, 60)
};
writeFileSync('/tmp/spatial-prod-repro.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
