#!/usr/bin/env node
/**
 * Canonical BodyParts3D prototype rebuild.
 * fetch → verify → ingest → optimize → integrity
 *
 * Usage: node tools/bp3d-ingest/build.mjs
 *    or: npm run bp3d:build
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

function run(label, command, args) {
  console.log(`\n==> ${label}`);
  const r = spawnSync(command, args, { stdio: "inherit", cwd: ROOT, shell: false });
  if (r.status !== 0) {
    console.error(`FAILED: ${label}`);
    process.exit(r.status || 1);
  }
}

run("fetch/verify source", process.execPath, ["tools/bp3d-ingest/fetch-source.mjs"]);
run("verify FMA + checksums", "python3", ["tools/bp3d-ingest/verify_source.py"]);
run("ingest", "python3", ["tools/bp3d-ingest/ingest.py"]);
run("optimize (meshopt)", process.execPath, ["tools/bp3d-ingest/optimize.mjs"]);
run("write orientation preview", "python3", ["tools/bp3d-ingest/write_orientation_preview.py"]);
run("integrity tests", process.execPath, ["tools/bp3d-ingest/test-integrity.mjs"]);

console.log("\nBP3D prototype build complete.");
