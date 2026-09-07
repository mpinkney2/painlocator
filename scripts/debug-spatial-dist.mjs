import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const PORT = 4178;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png', '.glb':'model/gltf-binary', '.map':'application/json' };
const server = createServer((req,res)=>{
  const url = new URL(req.url||'/', `http://127.0.0.1:${PORT}`);
  let pathname = decodeURIComponent(url.pathname); if (pathname==='/') pathname='/index.html';
  const filePath = join(dist, pathname.replace(/^\//,''));
  if (!filePath.startsWith(dist) || !existsSync(filePath) || !statSync(filePath).isFile()) { res.writeHead(404); res.end('nf '+pathname); return; }
  res.writeHead(200, {'Content-Type': MIME[extname(filePath)]||'application/octet-stream'});
  res.end(readFileSync(filePath));
});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const browser = await chromium.launch({ headless:true, args:['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page = await browser.newPage();
const logs=[]; const errs=[]; const fails=[];
page.on('console', m=>logs.push({t:m.type(),x:m.text()}));
page.on('pageerror', e=>errs.push(String(e)));
page.on('requestfailed', r=>fails.push({u:r.url(),e:r.failure()?.errorText}));
page.on('response', async res => {
  if (res.status()>=400) logs.push({t:'net', x:`${res.status()} ${res.url()}`});
});
await page.goto(`http://127.0.0.1:${PORT}/?spatialDiagnostics=1`, {waitUntil:'networkidle', timeout:60000});
await page.waitForTimeout(10000);
const snap = await page.evaluate(()=>({
  loadFn: typeof window.loadPainLocatorSpatialRuntime,
  runtime: !!window.PainLocatorSpatialRuntime,
  threeLoader: typeof window.SpatialThreeLoader,
  boot: typeof window.SpatialBootUtils,
  state: !!window.state,
  engine: !!window.state?.engine,
  displayMode: window.state?.engine?.displayMode,
  bootState: window.state?.engine?.spatialBootState,
  lastFailure: window.state?.engine?.lastSpatialFailure,
  status: document.querySelector('.cae-spatial-status-title')?.textContent,
  tech: document.querySelector('.cae-spatial-status-tech')?.textContent,
  canvas: document.querySelectorAll('canvas').length,
  bodyClass: document.body.className
}));
console.log(JSON.stringify({snap, errs, fails:fails.slice(0,20), logs:logs.filter(l=>l.t==='error'||l.t==='warning'||l.t==='net').slice(0,40)}, null, 2));
await browser.close(); server.close();
