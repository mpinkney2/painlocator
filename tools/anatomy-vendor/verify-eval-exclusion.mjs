#!/usr/bin/env node
/**
 * Fail if proprietary vendor-eval assets leak into public/ or dist/.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const FORBIDDEN = [
  /(?:^|\/)vendor-eval(?:\/|$)/i,
  /(?:^|\/)sciepro[^/]*\.(?:obj|fbx|gltf|glb|bin|zip)$/i,
  /(?:^|\/)zygote[^/]*\.(?:obj|fbx|gltf|glb|bin|zip)$/i
];

const BINARY_EXT = new Set([
  ".obj",
  ".fbx",
  ".gltf",
  ".glb",
  ".bin",
  ".zip",
  ".7z",
  ".rar",
  ".exr",
  ".tif",
  ".tiff"
]);

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function isForbiddenRel(rel) {
  const p = rel.replace(/\\/g, "/");
  if (FORBIDDEN.some((re) => re.test(p))) return true;
  // Any mesh-like file under public/anatomy that looks like a vendor sample drop
  if (p.startsWith("public/") || p.startsWith("dist/")) {
    if (/vendor[-_]?eval/i.test(p)) return true;
    if (/\/(?:sciepro|zygote)\//i.test(p) && BINARY_EXT.has(path.extname(p).toLowerCase())) {
      return true;
    }
  }
  return false;
}

function main() {
  const roots = [path.join(ROOT, "public"), path.join(ROOT, "dist")];
  const leaks = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      const rel = path.relative(ROOT, file);
      if (isForbiddenRel(rel)) leaks.push(rel);
    }
  }

  // data/vendor-eval may contain proprietary files locally — they must stay out of git/public/dist.
  // This check only enforces public/dist leak prevention.
  if (leaks.length) {
    console.error("VENDOR EVAL ASSET LEAK DETECTED:");
    for (const l of leaks) console.error(" -", l);
    process.exit(1);
  }
  console.log("vendor-eval exclusion OK (no proprietary vendor paths in public/ or dist/)");
}

main();
