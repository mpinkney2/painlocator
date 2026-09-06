#!/usr/bin/env node
/**
 * Meshopt-compress prototype GLBs in place.
 *
 * IMPORTANT: do NOT run gltf-transform `optimize` (it joins/simplifies meshes and
 * destroys per-structure meshId identity). Only EXT_meshopt_compression.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, statSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "public/anatomy/spatial/prototype-bp3d");
const RAW_DIR = path.join(OUT, "raw-pre-meshopt");

function glbMeshNames(filePath) {
  const buf = readFileSync(filePath);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
  const meshNames = (json.meshes || []).map((m) => m.name).filter(Boolean);
  const nodeNames = (json.nodes || []).map((n) => n.name).filter(Boolean);
  return { meshNames, nodeNames };
}

mkdirSync(RAW_DIR, { recursive: true });

const layers = ["skeletal.glb", "muscle.glb"];
const sizes = {};

for (const file of layers) {
  const src = path.join(OUT, file);
  if (!existsSync(src)) {
    console.error(`Missing ${src} — run ingest.py first`);
    process.exit(1);
  }

  // Prefer restoring from a known-good raw copy if present (re-entrant).
  const rawCopy = path.join(RAW_DIR, file);
  const probe = glbMeshNames(src);
  if (probe.meshNames.length <= 1 && existsSync(rawCopy)) {
    console.log(`Restoring ${file} from raw-pre-meshopt (previous join detected)`);
    copyFileSync(rawCopy, src);
  } else if (!existsSync(rawCopy)) {
    copyFileSync(src, rawCopy);
  }

  const beforeNames = glbMeshNames(src);
  const before = statSync(src).size;

  const r = spawnSync(
    "npx",
    ["--yes", "@gltf-transform/cli@4.1.1", "meshopt", src, src],
    { stdio: "inherit", cwd: ROOT }
  );
  if (r.status !== 0) process.exit(r.status || 1);

  const after = statSync(src).size;
  const afterNames = glbMeshNames(src);
  if (afterNames.meshNames.length !== beforeNames.meshNames.length) {
    console.error(
      `Mesh count changed for ${file}: ${beforeNames.meshNames.length} → ${afterNames.meshNames.length}`
    );
    process.exit(1);
  }
  const missing = beforeNames.meshNames.filter((n) => !afterNames.meshNames.includes(n));
  if (missing.length) {
    console.error(`Lost mesh names in ${file}: ${missing.join(", ")}`);
    process.exit(1);
  }

  sizes[file] = {
    beforeBytes: before,
    afterBytes: after,
    ratio: Number((after / before).toFixed(4)),
    meshCount: afterNames.meshNames.length,
    meshIds: afterNames.meshNames,
  };
  console.log(`${file}: ${before} → ${after} bytes (${afterNames.meshNames.length} meshes preserved)`);
}

const reportPath = path.join(OUT, "build-report.json");
const report = JSON.parse(readFileSync(reportPath, "utf8"));
report.optimization = {
  method: "meshopt",
  tool: "@gltf-transform/cli@4.1.1",
  layers: sizes,
  rawCopies: "./raw-pre-meshopt/",
  notes: [
    "No geometric join/simplify — meshopt compression only.",
    "No additional decimation beyond BodyParts3D 99% pack.",
    "Meshopt preferred over Draco for this prototype.",
  ],
};
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log("Updated build-report.json with optimization stats");
