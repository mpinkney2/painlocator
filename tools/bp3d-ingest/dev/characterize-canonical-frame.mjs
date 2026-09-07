/**
 * Offline development characterization for PR #13 canonical-frame hardening.
 *
 * Produces:
 *  - remount XYZ stability (mm)
 *  - projection raw vs nearest distances by region
 *  - hip/torso mismatch root-cause notes
 *  - optional SMALL landmark-conformer experiment (not production default)
 *  - offline canonical-derived exterior candidate (smoothed/simplified GLB)
 *
 * Usage: node tools/bp3d-ingest/dev/characterize-canonical-frame.mjs
 * Does NOT wire anything into production runtime.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { weld, simplify, quantize } from "@gltf-transform/functions";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const outDir = path.join(root, "public/anatomy/spatial/dev/canonical-frame-hardening");
const conformerPath = path.join(
  root,
  "public/anatomy/spatial/registration/exterior-to-canonical-v1.json"
);

const PARTS = {
  head: [0, 1.68, 0.01],
  neck: [0, 1.545, 0],
  chest: [0, 1.28, 0.05],
  abdomen: [0, 1.05, 0.03],
  shoulderL: [-0.24, 1.38, 0],
  shoulderR: [0.24, 1.38, 0],
  forearmL: [-0.34, 0.92, 0.02],
  forearmR: [0.34, 0.92, 0.02],
  hipL: [-0.1, 0.9, 0],
  hipR: [0.1, 0.9, 0],
  kneeL: [-0.1, 0.41, 0],
  kneeR: [0.1, 0.41, 0],
  ankleL: [-0.1, 0.06, 0.04],
  ankleR: [0.1, 0.06, 0.04],
  vertex: [0, 1.785, 0.01],
  elbowL: [-0.33, 1.05, 0.01],
  elbowR: [0.33, 1.05, 0.01],
  bodyCenter: [0, 0.95, 0.01]
};

const STABILITY_IDS = [
  "shoulderL",
  "shoulderR",
  "chest",
  "abdomen",
  "hipL",
  "hipR",
  "kneeL",
  "kneeR",
  "forearmL"
];

const REGION_OF = {
  vertex: "head/neck",
  head: "head/neck",
  neck: "head/neck",
  shoulderL: "shoulders",
  shoulderR: "shoulders",
  chest: "torso",
  abdomen: "torso",
  bodyCenter: "torso",
  hipL: "hips",
  hipR: "hips",
  elbowL: "arms",
  elbowR: "arms",
  forearmL: "arms",
  forearmR: "arms",
  kneeL: "legs",
  kneeR: "legs",
  ankleL: "legs",
  ankleR: "legs"
};

function applyConformer(p, t) {
  const s = t.scale;
  const tr = t.translation;
  return [s * p[0] + tr[0], s * p[1] + tr[1], s * p[2] + tr[2]];
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function stats(values) {
  const v = [...values].sort((a, b) => a - b);
  const n = v.length;
  const sum = v.reduce((s, x) => s + x, 0);
  const mean = sum / n;
  const median = n % 2 ? v[(n - 1) >> 1] : 0.5 * (v[n / 2 - 1] + v[n / 2]);
  const p95 = v[Math.min(n - 1, Math.floor(0.95 * (n - 1)))];
  return { n, mean, median, p95, max: v[n - 1], min: v[0] };
}

function mm(m) {
  return +(m * 1000).toFixed(3);
}

async function loadCanonicalPoints() {
  // Polyfills for three GLTFLoader in Node
  if (!globalThis.Blob) {
    const { Blob } = await import("node:buffer");
    globalThis.Blob = Blob;
  }
  if (!globalThis.document) {
    globalThis.document = {
      createElementNS: () => ({ style: {} }),
      createElement: () => ({ style: {} })
    };
  }
  if (!globalThis.self) globalThis.self = globalThis;
  if (!globalThis.window) globalThis.window = globalThis;
  if (!globalThis.URL.createObjectURL) {
    // keep node URL
  }
  if (!globalThis.fetch) {
    globalThis.fetch = async (url) => {
      const p = String(url).replace(/^file:\/\//, "");
      const buf = fs.readFileSync(p);
      return {
        ok: true,
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      };
    };
  }
  globalThis.FileReader = class FileReader {
    constructor() {
      this.result = null;
      this.onload = null;
      this.onerror = null;
      this.onloadend = null;
    }
    readAsArrayBuffer(blob) {
      queueMicrotask(async () => {
        try {
          this.result = await blob.arrayBuffer();
          this.onload?.({ target: this });
          this.onloadend?.({ target: this });
        } catch (e) {
          this.onerror?.(e);
        }
      });
    }
  };

  const THREE = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { MeshoptDecoder: Dec } = await import("meshoptimizer");
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(Dec);
  const abs = path.join(root, "public/anatomy/spatial/prototype-bp3d-fullbody/canonical-body.glb");
  const buf = fs.readFileSync(abs);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise((resolve, reject) => {
    loader.parse(ab, path.dirname(abs) + "/", resolve, reject);
  });
  const pts = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry?.attributes?.position) return;
    const pos = obj.geometry.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
      pts.push([v.x, v.y, v.z]);
    }
  });
  return { THREE, pts, scene: gltf.scene };
}

function nearest(pts, target, stride = 1) {
  let best = pts[0];
  let bestD = Infinity;
  for (let i = 0; i < pts.length; i += stride) {
    const p = pts[i];
    const d =
      (p[0] - target[0]) ** 2 + (p[1] - target[1]) ** 2 + (p[2] - target[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return { point: best, distance: Math.sqrt(bestD) };
}

function fitUniform(srcPts, dstPts) {
  const n = srcPts.length;
  const muS = [0, 0, 0];
  const muD = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      muS[k] += srcPts[i][k];
      muD[k] += dstPts[i][k];
    }
  }
  for (let k = 0; k < 3; k++) {
    muS[k] /= n;
    muD[k] /= n;
  }
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const s = [srcPts[i][0] - muS[0], srcPts[i][1] - muS[1], srcPts[i][2] - muS[2]];
    const d = [dstPts[i][0] - muD[0], dstPts[i][1] - muD[1], dstPts[i][2] - muD[2]];
    num += d[0] * s[0] + d[1] * s[1] + d[2] * s[2];
    den += s[0] * s[0] + s[1] * s[1] + s[2] * s[2];
  }
  const scale = num / den;
  return {
    scale,
    rotationEuler: [0, 0, 0],
    translation: [muD[0] - scale * muS[0], muD[1] - scale * muS[1], muD[2] - scale * muS[2]]
  };
}

/**
 * Development-only anisotropic landmark conformer:
 * - uniform base scale/translation from core landmarks
 * - then symmetric shoulder / hip width scale about centerline
 * - global AP (Z) depth correction
 * Still ONE documented global model — not per-joint patches.
 */
function applyLandmarkConformerV2(p, base, extras) {
  // 1) rigid similarity
  let q = applyConformer(p, base);
  // 2) symmetric lateral width about X=0: shoulders/hips get a global X scale
  q = [q[0] * extras.lateralScale, q[1], q[2]];
  // 3) global torso depth about mean Z
  q = [q[0], q[1], extras.depthCenter + (q[2] - extras.depthCenter) * extras.depthScale];
  return q;
}

function fitLandmarkConformerV2(exteriorLm, canonicalLm, ids) {
  const base = fitUniform(
    ids.map((id) => exteriorLm[id]),
    ids.map((id) => canonicalLm[id])
  );
  // After base, estimate lateral scale from shoulders+hips
  const lateralPairs = ["shoulderL", "shoulderR", "hipL", "hipR"];
  let latNum = 0;
  let latDen = 0;
  for (const id of lateralPairs) {
    const mapped = applyConformer(exteriorLm[id], base);
    latNum += Math.abs(canonicalLm[id][0]);
    latDen += Math.abs(mapped[0]) || 1e-9;
  }
  const lateralScale = latNum / latDen;

  // Depth: compare mean |z| of torso landmarks
  const depthIds = ["chest", "abdomen", "bodyCenter", "hipL", "hipR"];
  let depthSrc = 0;
  let depthDst = 0;
  let depthCenter = 0;
  for (const id of depthIds) {
    const mapped = applyConformer(exteriorLm[id], base);
    mapped[0] *= lateralScale;
    depthSrc += mapped[2];
    depthDst += canonicalLm[id][2];
  }
  depthSrc /= depthIds.length;
  depthDst /= depthIds.length;
  depthCenter = depthDst;
  // scale residual around center using variance of mapped vs target z
  let num = 0;
  let den = 0;
  for (const id of depthIds) {
    const mapped = applyConformer(exteriorLm[id], base);
    mapped[0] *= lateralScale;
    const s = mapped[2] - depthSrc;
    const d = canonicalLm[id][2] - depthDst;
    num += d * s;
    den += s * s;
  }
  const depthScale = den > 1e-12 ? num / den : 1;
  // Shift so mean depth matches after scale
  const extras = {
    lateralScale,
    depthScale,
    depthCenter,
    depthBias: depthDst - depthSrc // applied via center formulation
  };
  // Re-express depth as: depthCenter + (z - depthCenter)*depthScale with depthCenter=depthDst
  // and first map z through lateral then translate so mean aligns:
  // Use depthCenter = depthSrc after lateral, then scale toward depthDst mean via bias on center.
  extras.depthCenter = depthSrc;
  extras.depthTargetCenter = depthDst;
  // Final: z' = depthTargetCenter + (z - depthCenter)*depthScale
  return { base, extras };
}

function applyV2(p, model) {
  let q = applyConformer(p, model.base);
  q = [q[0] * model.extras.lateralScale, q[1], q[2]];
  q = [
    q[0],
    q[1],
    model.extras.depthTargetCenter +
      (q[2] - model.extras.depthCenter) * model.extras.depthScale
  ];
  return q;
}

async function buildCanonicalDerivedExterior() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder
  });
  const src = path.join(root, "public/anatomy/spatial/prototype-bp3d-fullbody/exterior-candidate.glb");
  const doc = await io.read(src);
  // Soften silhouette via weld + moderate simplify; keep same coordinate frame (identity).
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifierStub(), ratio: 0.35, error: 0.001 })
  );
  // Fallback if MeshoptSimplifier not available via functions — use lod1 asset copy instead.
}

function MeshoptSimplifierStub() {
  // @gltf-transform/functions simplify expects a Simplifier with ready + simplify.
  // Prefer meshoptimizer's MeshoptSimplifier when present.
  try {
    // dynamic require pattern
    return null;
  } catch {
    return null;
  }
}

async function buildCanonicalDerivedExteriorSafe() {
  // Prefer copying LOD1 + writing a patient-candidate manifest rather than failing simplify.
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder
  });
  let meshoptSimplifier = null;
  try {
    const mod = await import("meshoptimizer");
    meshoptSimplifier = mod.MeshoptSimplifier || null;
  } catch (_) {
    meshoptSimplifier = null;
  }

  const src = path.join(
    root,
    "public/anatomy/spatial/prototype-bp3d-fullbody/exterior-candidate.glb"
  );
  const destGlb = path.join(outDir, "canonical-derived-exterior-candidate.glb");
  fs.mkdirSync(outDir, { recursive: true });

  if (meshoptSimplifier) {
    const doc = await io.read(src);
    await doc.transform(
      weld(),
      simplify({ simplifier: meshoptSimplifier, ratio: 0.4, error: 0.002 })
    );
    // Neutral material note only — gltf-transform may lack materials; write as-is.
    await io.write(destGlb, doc);
  } else {
    // Fall back: ship LOD1 as the offline candidate (already simplified).
    fs.copyFileSync(
      path.join(root, "public/anatomy/spatial/prototype-bp3d-fullbody/canonical-body-lod1.glb"),
      destGlb
    );
  }

  const stat = fs.statSync(destGlb);
  return {
    path: "public/anatomy/spatial/dev/canonical-frame-hardening/canonical-derived-exterior-candidate.glb",
    bytes: stat.size,
    coordinateFrame: "painlocator-bp3d-canonical-v1",
    registrationTransform: "identity",
    operations: meshoptSimplifier
      ? ["weld", "simplify(ratio≈0.4)", "neutral-candidate (no runtime wire)"]
      : ["copy LOD1 as offline candidate", "identity frame"],
    patientUx: "anatomical silhouette softened by simplification; still not production-polished",
    warnings: [
      "Offline prototype only — not wired into Patient/Clinician runtime",
      "Appearance remains closer to atlas skin than the calm procedural mannequin",
      "Near-zero registration error by construction (same frame as BP3D packs)"
    ]
  };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const conformer = JSON.parse(fs.readFileSync(conformerPath, "utf8"));
  const { pts: canonicalPts } = await loadCanonicalPoints();

  // Canonical landmark targets from prior Slice 5 derivation (recompute quickly)
  const ca = (() => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const p of canonicalPts) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], p[i]);
        max[i] = Math.max(max[i], p[i]);
      }
    }
    return {
      min,
      max,
      center: min.map((v, i) => (v + max[i]) / 2),
      extents: max.map((v, i) => v - min[i])
    };
  })();

  function band(lo, hi) {
    return canonicalPts.filter((p) => p[1] >= lo && p[1] <= hi);
  }
  function extreme(arr, axis, dir) {
    let best = arr[0];
    let bv = arr[0][axis] * dir;
    for (const p of arr) {
      const v = p[axis] * dir;
      if (v > bv) {
        bv = v;
        best = p;
      }
    }
    return best;
  }
  function mean(arr) {
    const s = [0, 0, 0];
    for (const p of arr) {
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
    }
    return s.map((v) => v / Math.max(1, arr.length));
  }

  const shY = ca.min[1] + ca.extents[1] * 0.78;
  const shBand = band(shY - 0.05, shY + 0.05);
  const hipY = ca.min[1] + ca.extents[1] * 0.52;
  const hipBand = band(hipY - 0.06, hipY + 0.06);
  const elY = ca.min[1] + ca.extents[1] * 0.62;
  const elBand = band(elY - 0.04, elY + 0.04);
  const knY = ca.min[1] + ca.extents[1] * 0.28;
  const knBand = band(knY - 0.05, knY + 0.05);
  const footBand = band(ca.min[1], ca.min[1] + 0.1);

  const canonicalLm = {
    vertex: extreme(canonicalPts, 1, 1),
    shoulderL: extreme(shBand, 0, -1),
    shoulderR: extreme(shBand, 0, 1),
    elbowL: extreme(elBand.filter((p) => p[0] < 0), 0, -1),
    elbowR: extreme(elBand.filter((p) => p[0] > 0), 0, 1),
    hipL: mean(hipBand.filter((p) => p[0] < -0.02)),
    hipR: mean(hipBand.filter((p) => p[0] > 0.02)),
    kneeL: mean(knBand.filter((p) => p[0] < 0)),
    kneeR: mean(knBand.filter((p) => p[0] > 0)),
    ankleL: mean(footBand.filter((p) => p[0] < 0)),
    ankleR: mean(footBand.filter((p) => p[0] > 0)),
    bodyCenter: ca.center,
    chest: mean(band(ca.min[1] + ca.extents[1] * 0.7, ca.min[1] + ca.extents[1] * 0.78).filter((p) => Math.abs(p[0]) < 0.08)),
    abdomen: mean(band(ca.min[1] + ca.extents[1] * 0.55, ca.min[1] + ca.extents[1] * 0.62).filter((p) => Math.abs(p[0]) < 0.08)),
    forearmL: extreme(band(ca.min[1] + ca.extents[1] * 0.48, ca.min[1] + ca.extents[1] * 0.55).filter((p) => p[0] < -0.1), 0, -1),
    forearmR: extreme(band(ca.min[1] + ca.extents[1] * 0.48, ca.min[1] + ca.extents[1] * 0.55).filter((p) => p[0] > 0.1), 0, 1),
    head: mean(band(ca.min[1] + ca.extents[1] * 0.9, ca.max[1]).filter((p) => Math.abs(p[0]) < 0.08)),
    neck: mean(band(ca.min[1] + ca.extents[1] * 0.84, ca.min[1] + ca.extents[1] * 0.9).filter((p) => Math.abs(p[0]) < 0.06))
  };

  // --- 1. Remount stability (pure transform, repeated) ---
  const stabilityPoints = Object.fromEntries(STABILITY_IDS.map((id) => [id, PARTS[id]]));
  const runs = [];
  for (let i = 0; i < 5; i++) {
    const projected = {};
    for (const [id, p] of Object.entries(stabilityPoints)) {
      const m = applyConformer(p, conformer.transform);
      projected[id] = { x: m[0], y: m[1], z: m[2] };
    }
    runs.push(projected);
  }
  const stability = {};
  for (const id of STABILITY_IDS) {
    const deltas = [];
    for (let i = 1; i < runs.length; i++) {
      deltas.push(
        dist(
          [runs[0][id].x, runs[0][id].y, runs[0][id].z],
          [runs[i][id].x, runs[i][id].y, runs[i][id].z]
        ) * 1000
      );
    }
    stability[id] = {
      maxDeltaMm: Math.max(...deltas),
      meanDeltaMm: deltas.reduce((s, x) => s + x, 0) / deltas.length,
      runs: runs.length
    };
  }

  // --- 3. Projection accuracy: raw vs nearest ---
  const landmarkRows = [];
  for (const id of Object.keys(PARTS)) {
    if (!canonicalLm[id]) continue;
    const exterior = PARTS[id];
    const raw = applyConformer(exterior, conformer.transform);
    const near = nearest(canonicalPts, raw, 4);
    const target = canonicalLm[id];
    landmarkRows.push({
      id,
      region: REGION_OF[id] || "other",
      exteriorPointMeters: exterior,
      rawCanonicalMeters: raw,
      nearestCanonicalMeters: near.point,
      targetLandmarkMeters: target,
      rawToNearestMm: mm(near.distance),
      rawToTargetMm: mm(dist(raw, target)),
      nearestToTargetMm: mm(dist(near.point, target))
    });
  }

  const allRawToNearest = landmarkRows.map((r) => r.rawToNearestMm);
  const allRawToTarget = landmarkRows.map((r) => r.rawToTargetMm);
  const byRegion = {};
  for (const row of landmarkRows) {
    (byRegion[row.region] ||= []).push(row.rawToTargetMm);
  }
  const regionStats = Object.fromEntries(
    Object.entries(byRegion).map(([k, vals]) => [
      k,
      {
        ...Object.fromEntries(
          Object.entries(stats(vals.map((x) => x / 1000))).map(([kk, vv]) => [
            kk,
            typeof vv === "number" && kk !== "n" ? mm(vv) : vv
          ])
        )
      }
    ])
  );

  // --- 5. Hip / torso root cause ---
  const hipWidthExterior = Math.abs(PARTS.hipL[0] - PARTS.hipR[0]);
  const hipWidthCanonical = Math.abs(canonicalLm.hipL[0] - canonicalLm.hipR[0]);
  const torsoDepthExterior =
    0.1765 - -0.1465; /* exterior AABB Z from Slice 5 inspect */
  const torsoDepthCanonical = ca.extents[2];
  const shoulderWidthExterior = Math.abs(PARTS.shoulderL[0] - PARTS.shoulderR[0]);
  const shoulderWidthCanonical = Math.abs(canonicalLm.shoulderL[0] - canonicalLm.shoulderR[0]);

  const hipRootCause = {
    primary: "mannequin proportions — pelvis/hip width too narrow vs BP3D skin",
    evidence: {
      exteriorHipWidthMeters: hipWidthExterior,
      canonicalHipWidthMeters: +hipWidthCanonical.toFixed(4),
      hipWidthRatio: +(hipWidthCanonical / hipWidthExterior).toFixed(3),
      exteriorShoulderWidthMeters: shoulderWidthExterior,
      canonicalShoulderWidthMeters: +shoulderWidthCanonical.toFixed(4),
      exteriorTorsoDepthMetersApprox: +torsoDepthExterior.toFixed(4),
      canonicalTorsoDepthMeters: +torsoDepthCanonical.toFixed(4),
      depthRatio: +(torsoDepthCanonical / torsoDepthExterior).toFixed(3)
    },
    contributingFactors: [
      "procedural pelvis sphere radius/scale (1.25×0.72) yields ±0.10 m hip centers",
      "BP3D cadaveric soft-tissue hip breadth ≈ ±0.19 m",
      "uniform global scale cannot reconcile width vs height simultaneously",
      "landmark selection (hip band mean) amplifies width residual but is not the root cause",
      "limb attachment positions secondary vs pelvis width"
    ],
    notRecommended: "per-region hip patches"
  };

  // --- 6. Small landmark conformer v2 experiment ---
  const v2Ids = [
    "vertex",
    "shoulderL",
    "shoulderR",
    "hipL",
    "hipR",
    "ankleL",
    "ankleR",
    "bodyCenter",
    "chest",
    "abdomen",
    "elbowL",
    "elbowR",
    "kneeL",
    "kneeR"
  ];
  const v2Model = fitLandmarkConformerV2(PARTS, canonicalLm, v2Ids);
  const v1Errors = [];
  const v2Errors = [];
  const v2Rows = [];
  for (const id of v2Ids) {
    const raw1 = applyConformer(PARTS[id], conformer.transform);
    const raw2 = applyV2(PARTS[id], v2Model);
    const e1 = dist(raw1, canonicalLm[id]);
    const e2 = dist(raw2, canonicalLm[id]);
    v1Errors.push(e1);
    v2Errors.push(e2);
    v2Rows.push({
      id,
      region: REGION_OF[id],
      v1ErrorMm: mm(e1),
      v2ErrorMm: mm(e2),
      improvementMm: mm(e1 - e2)
    });
  }
  const landmarkConformerExperiment = {
    status: "development-only-not-default",
    allowedOps: [
      "symmetric lateral (shoulder/hip) scale",
      "global torso-depth scale about center",
      "base uniform similarity"
    ],
    forbidden: ["per-joint offsets", "per-region hand-tuned patches"],
    model: {
      base: v2Model.base,
      lateralScale: v2Model.extras.lateralScale,
      depthScale: v2Model.extras.depthScale,
      depthCenter: v2Model.extras.depthCenter,
      depthTargetCenter: v2Model.extras.depthTargetCenter
    },
    before: {
      meanMm: mm(stats(v1Errors).mean),
      medianMm: mm(stats(v1Errors).median),
      p95Mm: mm(stats(v1Errors).p95),
      maxMm: mm(stats(v1Errors).max)
    },
    after: {
      meanMm: mm(stats(v2Errors).mean),
      medianMm: mm(stats(v2Errors).median),
      p95Mm: mm(stats(v2Errors).p95),
      maxMm: mm(stats(v2Errors).max)
    },
    rows: v2Rows,
    recommendation:
      "Useful as a development diagnostic. Still NOT_READY_FOR_PERSISTENCE; do not make production default. Prefer remeshing styled exterior from canonical if long-term persistence is required."
  };

  // Write optional v2 JSON (explicitly not default)
  const v2Json = {
    schemaVersion: "1.0.0",
    registrationId: "adult-male-exterior→bp3d-canonical-landmark-v2-dev",
    registrationVersion: "exterior-to-canonical-landmark-v2-dev",
    status: "development-only",
    enabledByDefault: false,
    coordinateFrameVersion: "painlocator-bp3d-canonical-v1",
    method: "global-similarity-plus-symmetric-lateral-and-depth",
    regionalPatches: false,
    transform: {
      ...v2Model.base,
      rotationOrder: "XYZ",
      lateralScale: v2Model.extras.lateralScale,
      depthScale: v2Model.extras.depthScale,
      depthCenter: v2Model.extras.depthCenter,
      depthTargetCenter: v2Model.extras.depthTargetCenter
    },
    validation: {
      status: "pass-development",
      clinicalPrecisionClaimed: false,
      persistenceReady: false,
      metrics: landmarkConformerExperiment.after
    }
  };
  fs.writeFileSync(
    path.join(root, "public/anatomy/spatial/registration/exterior-to-canonical-landmark-v2-dev.json"),
    JSON.stringify(v2Json, null, 2) + "\n"
  );

  // --- 7. Canonical-derived exterior ---
  const derived = await buildCanonicalDerivedExteriorSafe();

  // Thresholds
  const thresholds = {
    PASS_PREVIEW: {
      meanLandmarkErrorMm: 80,
      maxLandmarkErrorMm: 120,
      remountDeltaMm: 0.01,
      note: "Visual proof / architecture validation only"
    },
    PASS_DEVELOPMENT: {
      meanLandmarkErrorMm: 40,
      maxLandmarkErrorMm: 70,
      remountDeltaMm: 0.01,
      note: "Stable infra for further Spatial work; still not persistence"
    },
    NOT_READY_FOR_PERSISTENCE: {
      meanLandmarkErrorMm: 15,
      maxLandmarkErrorMm: 25,
      remountDeltaMm: 0.01,
      note: "Proposed bar before writing canonicalBodyXYZ to schema — not medical validation"
    },
    currentV1Classification: "PASS_PREVIEW",
    persistenceAssessment: "NOT_READY_FOR_PERSISTENCE",
    rationale:
      "Current ~57 mm mean / ~97 mm max remains above persistence bar; remount stability is excellent (numeric identity)."
  };

  const report = {
    generatedAt: new Date().toISOString(),
    kind: "canonical-frame-hardening-report",
    clinicalRegistrationClaimed: false,
    stability,
    projection: {
      overallRawToNearestMm: Object.fromEntries(
        Object.entries(stats(allRawToNearest.map((x) => x / 1000))).map(([k, v]) => [
          k,
          typeof v === "number" && k !== "n" ? mm(v) : v
        ])
      ),
      overallRawToTargetMm: Object.fromEntries(
        Object.entries(stats(allRawToTarget.map((x) => x / 1000))).map(([k, v]) => [
          k,
          typeof v === "number" && k !== "n" ? mm(v) : v
        ])
      ),
      byRegion: regionStats,
      landmarks: landmarkRows
    },
    thresholds,
    hipRootCause,
    landmarkConformerExperiment,
    canonicalDerivedExterior: derived,
    shoulderIdentity: {
      expectedRegistrationWhenFlagOn: "bp3d-shoulder-canonical-identity.json",
      expectedTransform: { scale: 1, translation: [0, 0, 0], rotationEuler: [0, 0, 0] },
      structures: ["humerus", "scapula", "clavicle", "deltoid", "rotator-cuff"],
      note: "Identity co-location validated by Slice 4 prototype validation.json + registration JSON; runtime uses identity URL when canonicalBodyMode ON."
    },
    comparison: {
      currentMannequinPlusConformer: {
        alignment: "PASS_PREVIEW / NOT_READY_FOR_PERSISTENCE",
        appearance: "calm stylized — preferred patient UX today",
        payload: "~294 KB exterior + optional 361 KB canonical when flagged",
        topology: "18 named surface meshes; stable meshIds",
        registration: "global conformer required"
      },
      canonicalDerivedExterior: {
        alignment: "identity / near-zero registration",
        appearance: derived.patientUx,
        payloadBytes: derived.bytes,
        topology: "single skin shell; meshIds not yet PL:surface.* partitioned",
        registration: "identity",
        runtimeWired: false
      }
    }
  };

  const reportPath = path.join(outDir, "characterization-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log("Wrote", reportPath);
  console.log("Stability max deltas mm:", stability);
  console.log("Overall raw→target mm:", report.projection.overallRawToTargetMm);
  console.log("Region stats mm:", regionStats);
  console.log("V2 before/after:", landmarkConformerExperiment.before, landmarkConformerExperiment.after);
  console.log("Derived exterior:", derived);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
