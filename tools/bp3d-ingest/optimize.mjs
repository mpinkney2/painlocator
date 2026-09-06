#!/usr/bin/env node
/**
 * Meshopt-compress prototype GLBs using the locally installed @gltf-transform/cli.
 * Does NOT join/simplify meshes (preserves per-structure meshId identity).
 * raw-pre-meshopt/ is a local regenerable cache — not committed.
 */
import { spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  statSync,
  copyFileSync,
  mkdirSync,
  existsSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "public/anatomy/spatial/prototype-bp3d");
const RAW_DIR = path.join(OUT, "raw-pre-meshopt");

function resolveCli() {
  const bin = path.join(ROOT, "node_modules/.bin/gltf-transform");
  const pkgPath = path.join(ROOT, "node_modules/@gltf-transform/cli/package.json");
  if (!existsSync(bin) || !existsSync(pkgPath)) {
    console.error(
      "Missing @gltf-transform/cli. Run: npm install (devDependency required)."
    );
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  return { bin, version: pkg.version };
}

function glbMeshNames(filePath) {
  const buf = readFileSync(filePath);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
  return (json.meshes || []).map((m) => m.name).filter(Boolean);
}

const { bin, version } = resolveCli();
mkdirSync(RAW_DIR, { recursive: true });

const layers = ["skeletal.glb", "muscle.glb"];
const sizes = {};

for (const file of layers) {
  const src = path.join(OUT, file);
  if (!existsSync(src)) {
    console.error(`Missing ${src} — run ingest first`);
    process.exit(1);
  }

  const rawCopy = path.join(RAW_DIR, file);
  const probe = glbMeshNames(src);
  if (probe.length <= 1 && existsSync(rawCopy)) {
    console.log(`Restoring ${file} from raw-pre-meshopt (previous join detected)`);
    copyFileSync(rawCopy, src);
  } else {
    copyFileSync(src, rawCopy);
  }

  const beforeNames = glbMeshNames(src);
  const before = statSync(src).size;

  const r = spawnSync(process.execPath, [bin, "meshopt", src, src], {
    stdio: "inherit",
    cwd: ROOT,
  });
  if (r.status !== 0) process.exit(r.status || 1);

  const after = statSync(src).size;
  const afterNames = glbMeshNames(src);
  if (afterNames.length !== beforeNames.length) {
    console.error(`Mesh count changed for ${file}`);
    process.exit(1);
  }
  const missing = beforeNames.filter((n) => !afterNames.includes(n));
  if (missing.length) {
    console.error(`Lost mesh names in ${file}: ${missing.join(", ")}`);
    process.exit(1);
  }

  sizes[file] = {
    beforeBytes: before,
    afterBytes: after,
    ratio: Number((after / before).toFixed(4)),
    meshCount: afterNames.length,
    meshIds: afterNames,
  };
  console.log(`${file}: ${before} → ${after} bytes (${afterNames.length} meshes preserved)`);
}

const reportPath = path.join(OUT, "build-report.json");
const report = JSON.parse(readFileSync(reportPath, "utf8"));
report.tooling = report.tooling || {};
report.tooling.gltfTransformVersion = version;
report.optimization = {
  method: "meshopt",
  tool: `@gltf-transform/cli@${version}`,
  resolvedBin: bin,
  layers: sizes,
  rawCopies: "./raw-pre-meshopt/ (local regenerable; not committed)",
  notes: [
    "No geometric join/simplify — meshopt compression only.",
    "No additional decimation beyond BodyParts3D 99% pack.",
    "Meshopt preferred over Draco for this prototype.",
  ],
};
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(`Updated build-report.json (gltf-transform ${version})`);
