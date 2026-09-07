#!/usr/bin/env node
/**
 * Global similarity registration: vendor landmarks → painlocator-bp3d-canonical-v1.
 *
 * One uniform scale + rotation + translation (Umeyama). No regional patches.
 *
 * Usage:
 *   node tools/anatomy-vendor/register-to-canonical.mjs \
 *     --vendor data/vendor-eval/sciepro/landmarks.json \
 *     --canonical data/anatomy-vendor/canonical-landmarks-v1.json \
 *     --out data/vendor-eval/sciepro/derived/registration-report.json
 *
 * Vendor landmarks.json shape:
 * {
 *   "units": "meters",
 *   "landmarks": [{ "id": "vertex", "meters": [x,y,z] }, ...]
 * }
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeRegistrationResiduals,
  MEAN_FAIL_M,
  MAX_FAIL_M
} from "./lib/umeyama.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const REQUIRED = [
  "vertex",
  "shoulderL",
  "shoulderR",
  "humeralHeadL",
  "humeralHeadR",
  "elbowL",
  "elbowR",
  "hipL",
  "hipR",
  "kneeL",
  "kneeR",
  "ankleL",
  "ankleR",
  "bodyCenter"
];

function parseArgs(argv) {
  const out = {
    vendor: path.join(ROOT, "data/vendor-eval/sciepro/landmarks.json"),
    canonical: path.join(ROOT, "data/anatomy-vendor/canonical-landmarks-v1.json"),
    out: path.join(ROOT, "data/vendor-eval/sciepro/derived/registration-report.json")
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--vendor") out.vendor = path.resolve(argv[++i]);
    else if (argv[i] === "--canonical") out.canonical = path.resolve(argv[++i]);
    else if (argv[i] === "--out") out.out = path.resolve(argv[++i]);
  }
  return out;
}

function loadLandmarks(file) {
  const doc = JSON.parse(readFileSync(file, "utf8"));
  const list = doc.landmarks || [];
  const map = new Map();
  for (const lm of list) {
    if (!lm?.id || !Array.isArray(lm.meters) || lm.meters.length !== 3) {
      throw new Error(`Invalid landmark in ${file}: ${JSON.stringify(lm)}`);
    }
    map.set(lm.id, lm.meters.map(Number));
  }
  return { doc, map };
}

function rotationMatrixToEulerXYZ(R) {
  const sy = Math.sqrt(R[0][0] * R[0][0] + R[1][0] * R[1][0]);
  let x;
  let y;
  let z;
  if (sy > 1e-6) {
    x = Math.atan2(R[2][1], R[2][2]);
    y = Math.atan2(-R[2][0], sy);
    z = Math.atan2(R[1][0], R[0][0]);
  } else {
    x = Math.atan2(-R[1][2], R[1][1]);
    y = Math.atan2(-R[2][0], sy);
    z = 0;
  }
  return [x, y, z];
}

function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(args.vendor)) {
    console.error(`Vendor landmarks missing: ${args.vendor}`);
    console.error("Create data/vendor-eval/sciepro/landmarks.json from the sample, then re-run.");
    process.exit(2);
  }
  const vendor = loadLandmarks(args.vendor);
  const canonical = loadLandmarks(args.canonical);

  const missing = REQUIRED.filter((id) => !vendor.map.has(id) || !canonical.map.has(id));
  if (missing.length) {
    console.error("Missing required landmarks:", missing.join(", "));
    process.exit(2);
  }

  const ids = REQUIRED.filter((id) => vendor.map.has(id) && canonical.map.has(id));
  const X = ids.map((id) => vendor.map.get(id));
  const Y = ids.map((id) => canonical.map.get(id));
  const fit = computeRegistrationResiduals(X, Y, ids);
  const euler = rotationMatrixToEulerXYZ(fit.rotation);

  const failed = fit.meanMeters > MEAN_FAIL_M || fit.maxMeters > MAX_FAIL_M;
  const maxLm =
    fit.perLandmark.find((p) => p.residualMeters === fit.maxMeters)?.id || null;

  const report = {
    generatedAt: new Date().toISOString(),
    method: "umeyama-similarity-global",
    regionalPatches: false,
    coordinateFrameVersion: "painlocator-bp3d-canonical-v1",
    landmarkCount: ids.length,
    transform: {
      scale: fit.scale,
      rotationEuler: euler,
      rotationOrder: "XYZ",
      translation: fit.translation,
      rotationMatrix: fit.rotation
    },
    residuals: {
      meanMeters: fit.meanMeters,
      maxMeters: fit.maxMeters,
      meanMm: fit.meanMeters * 1000,
      maxMm: fit.maxMeters * 1000,
      maxLandmark: maxLm,
      perLandmark: fit.perLandmark
    },
    thresholds: {
      meanFailMeters: MEAN_FAIL_M,
      maxFailMeters: MAX_FAIL_M
    },
    validation: {
      status: failed ? "GLOBAL CONFORMER FAILED" : "pass-candidate",
      globalConformerFailed: failed,
      stopConditionTriggered: failed,
      message: failed
        ? "One global transform is not acceptable for current landmarks — vendor incompatible with canonical architecture without remesh/different sample (no regional patches)."
        : "Global conformer within development residual gates — human QA still required."
    }
  };

  mkdirSync(path.dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report.validation, null, 2));
  console.log(`Wrote ${args.out}`);
  process.exit(failed ? 3 : 0);
}

main();
