#!/usr/bin/env node
/**
 * Local-only evaluation server for vendor geometry QA.
 * Serves harness UI + data/vendor-eval (NOT public/, NOT production).
 *
 *   npm run vendor-eval:serve
 *   open http://127.0.0.1:5510/
 */
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = Number(process.env.VENDOR_EVAL_PORT || 5510);
const HOST = "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8"
};

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split("?")[0]);
  const clean = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(root, clean);
  if (!full.startsWith(root)) return null;
  return full;
}

function send(res, code, body, type = "text/plain; charset=utf-8") {
  res.writeHead(code, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-PainLocator-Vendor-Eval": "local-only"
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = req.url || "/";
  if (url === "/" || url.startsWith("/index.html")) {
    const html = path.join(ROOT, "tools/anatomy-vendor/qa/index.html");
    return send(res, 200, readFileSync(html), MIME[".html"]);
  }
  if (url.startsWith("/adapter/")) {
    const file = safeJoin(path.join(ROOT, "src/engine/anatomy/vendor"), url.slice("/adapter".length));
    if (!file || !existsSync(file)) return send(res, 404, "not found");
    return send(res, 200, readFileSync(file), MIME[path.extname(file)] || "text/plain");
  }
  if (url.startsWith("/map/")) {
    const file = safeJoin(path.join(ROOT, "data/anatomy-vendor"), url.slice("/map".length));
    if (!file || !existsSync(file)) return send(res, 404, "not found");
    return send(res, 200, readFileSync(file), MIME[path.extname(file)] || "application/octet-stream");
  }
  if (url.startsWith("/bp3d-compare/")) {
    const file = safeJoin(
      path.join(ROOT, "docs/visual-targets/bp3d-source-tier-comparison"),
      url.slice("/bp3d-compare".length)
    );
    if (!file || !existsSync(file)) return send(res, 404, "not found");
    return send(res, 200, readFileSync(file), MIME[path.extname(file)] || "application/octet-stream");
  }
  if (url.startsWith("/vendor-eval/")) {
    const file = safeJoin(path.join(ROOT, "data/vendor-eval"), url.slice("/vendor-eval".length));
    if (!file || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, "not found");
    return send(res, 200, readFileSync(file), MIME[path.extname(file)] || "application/octet-stream");
  }
  if (url.startsWith("/checklist")) {
    const file = path.join(ROOT, "docs/visual-targets/VENDOR_MOCKUP_ACCEPTANCE_CHECKLIST.md");
    return send(res, 200, readFileSync(file), MIME[".md"]);
  }
  send(res, 404, "not found");
});

server.listen(PORT, HOST, () => {
  console.log(`Vendor evaluation harness (LOCAL ONLY) → http://${HOST}:${PORT}/`);
  console.log("Does not expose data/vendor-eval via production Vite/Vercel.");
});
