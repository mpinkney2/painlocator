#!/usr/bin/env node
/**
 * Production BP3D build gate.
 *
 * Official BodyParts3D 4.0 currently publishes only 99% reduction meshes.
 * Until a checksum-pinned 4.0 ≤95%/HD archive exists, refuse production builds.
 *
 * See docs/BODYPARTS3D_PRODUCTION_SOURCE_DECISION.md
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const decision = path.join(root, "docs/BODYPARTS3D_PRODUCTION_SOURCE_DECISION.md");
const hdPin = path.join(root, "data/bodyparts3d/PRODUCTION_HD.sha256");

if (!existsSync(hdPin)) {
  console.error("bp3d:build:production refused.");
  console.error("");
  console.error("No PRODUCTION_HD.sha256 pin found.");
  console.error(
    "BodyParts3D 4.0 LATEST only publishes isa_BP3D_4.0_obj_99.zip (prototype tier)."
  );
  console.error("Do not promote 99% or historical 3.0 95% as the production master.");
  console.error("");
  console.error("Required next step: obtain official BP3D 4.0 ≤95%/HD elemental OBJs");
  console.error("with FJ/FMA tables + 4.0 coordinates + CC BY 4.0, then pin checksums.");
  if (existsSync(decision)) {
    console.error(`Decision record: ${decision}`);
  }
  process.exit(2);
}

const pins = readFileSync(hdPin, "utf8");
if (!/^[0-9a-f]{64}\s+\S+/m.test(pins)) {
  console.error("PRODUCTION_HD.sha256 is present but has no valid SHA-256 lines.");
  process.exit(2);
}

console.error(
  "PRODUCTION_HD pin present — wire fetch/ingest for HD packs before enabling this path."
);
process.exit(3);
