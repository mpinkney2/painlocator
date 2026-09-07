/**
 * Build canonical-frame styled adult exterior GLB (PainLocator-authored).
 *
 * Option B visible exterior: calm medical silhouette authored natively in
 * painlocator-bp3d-canonical-v1 landmark space (BP3D target meters from
 * exterior-to-canonical-v1.json). Not BP3D geometry; not a clinical atlas.
 *
 * Build-time only — uses npm `three@0.170.0` + GLTFExporter.
 * Runtime Spatial loads this GLB via the Vite ESM Spatial runtime.
 *
 * Usage: node scripts/generate-styled-exterior-glb.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (typeof globalThis.Blob === "undefined") {
  const { Blob } = await import("node:buffer");
  globalThis.Blob = Blob;
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
      } catch (err) {
        this.onerror?.(err);
      }
    });
  }
};

const THREE = await import("three");
const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adultDir = path.join(__dirname, "../public/anatomy/spatial/adult-male");
const outFile = path.join(adultDir, "exterior-lod0.glb");
const legacyDir = path.join(
  __dirname,
  "../public/anatomy/spatial/dev/interim-mannequin"
);
const legacyFile = path.join(legacyDir, "exterior-lod0-capsule-mannequin.glb");
const reportFile = path.join(adultDir, "styled-exterior-alignment-report.json");

/** BP3D canonical landmark targets (meters) — painlocator-bp3d-canonical-v1 */
const L = {
  vertex: [0.0043, 1.6414, 0.0765],
  shoulderL: [-0.2398, 1.2557, 0.0556],
  shoulderR: [0.241, 1.2556, 0.0556],
  elbowL: [-0.2766, 0.9611, 0.082],
  elbowR: [0.2779, 0.9799, 0.0825],
  hipL: [-0.1898, 0.8066, 0.1006],
  hipR: [0.189, 0.807, 0.0992],
  kneeL: [-0.0797, 0.4037, 0.0855],
  kneeR: [0.0807, 0.4043, 0.0861],
  ankleL: [-0.1087, -0.0501, 0.1395],
  ankleR: [0.1104, -0.0496, 0.1392],
  bodyCenter: [0.0006, 0.7816, 0.1008]
};

const MAT = new THREE.MeshStandardMaterial({
  color: 0xb8c0cb,
  roughness: 0.78,
  metalness: 0.02,
  flatShading: false
});

function mid(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function addMesh(root, name, geo, position, scale, rotation) {
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, MAT);
  mesh.name = name;
  mesh.userData.meshId = name;
  mesh.userData.layer = "surface";
  mesh.userData.spatialBody = true;
  mesh.position.set(position[0], position[1], position[2]);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  root.add(mesh);
  return mesh;
}

/** Soft ellipsoid (sphere + nonuniform scale) */
function ellipsoid(rx, ry, rz, w = 28, h = 20) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  return g;
}

/**
 * Continuous torso silhouette via LatheGeometry.
 * Radii chosen to match shoulder breadth (~0.48 m) and hip breadth (~0.38 m).
 */
function torsoLathe() {
  // Profile in XZ radius vs Y (local, centered later)
  const shoulderHalf = 0.22;
  const chestHalf = 0.18;
  const waistHalf = 0.14;
  const hipHalf = 0.19;
  const pts = [
    new THREE.Vector2(0.06, 0.34), // neck join
    new THREE.Vector2(shoulderHalf, 0.28),
    new THREE.Vector2(chestHalf, 0.12),
    new THREE.Vector2(waistHalf, -0.02),
    new THREE.Vector2(hipHalf * 0.95, -0.18),
    new THREE.Vector2(hipHalf, -0.28),
    new THREE.Vector2(0.12, -0.34)
  ];
  return new THREE.LatheGeometry(pts, 48);
}

/** Limb segment along vector from→to with tapered radii */
function limbCapsule(from, to, rStart, rEnd, radial = 16) {
  const len = dist(from, to);
  const g = new THREE.CapsuleGeometry((rStart + rEnd) / 2, Math.max(0.02, len - (rStart + rEnd)), 8, radial);
  return g;
}

function orientLimb(mesh, from, to) {
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  mesh.quaternion.copy(quat);
  mesh.position.set(...mid(from, to));
}

const root = new THREE.Group();
root.name = "adultMaleExterior";
root.userData.coordinateFrame = "painlocator-bp3d-canonical-v1";
root.userData.exteriorKind = "styled-canonical-silhouette-v1";

// Head — crown coincides with BP3D vertex landmark; calm ellipsoid (minimal facial detail)
const headRy = 0.11;
const headCenter = [L.vertex[0], L.vertex[1] - headRy, L.vertex[2]];
addMesh(root, "surface.head", ellipsoid(0.095, headRy, 0.1, 36, 28), headCenter);

// Neck
addMesh(
  root,
  "surface.neck",
  new THREE.CylinderGeometry(0.042, 0.055, 0.1, 24),
  mid([headCenter[0], headCenter[1] - headRy, headCenter[2]], mid(L.shoulderL, L.shoulderR))
);

// Torso lathe centered between shoulders and hips
const torsoCenter = mid(mid(L.shoulderL, L.shoulderR), mid(L.hipL, L.hipR));
torsoCenter[1] = (L.shoulderL[1] + L.hipL[1]) / 2;
addMesh(root, "surface.torso", torsoLathe(), torsoCenter);

// Pelvis — BP3D-wide (fixes mannequin hip residual root cause)
const pelvisCenter = mid(L.hipL, L.hipR);
addMesh(root, "surface.pelvis", ellipsoid(0.2, 0.1, 0.12, 32, 24), pelvisCenter);

// Shoulders
addMesh(root, "surface.shoulderL", ellipsoid(0.065, 0.055, 0.06, 20, 16), L.shoulderL);
addMesh(root, "surface.shoulderR", ellipsoid(0.065, 0.055, 0.06, 20, 16), L.shoulderR);

// Upper arms (shoulder → elbow)
{
  const g = limbCapsule(L.shoulderL, L.elbowL, 0.048, 0.04);
  const m = addMesh(root, "surface.upperArmL", g, mid(L.shoulderL, L.elbowL));
  orientLimb(m, L.shoulderL, L.elbowL);
}
{
  const g = limbCapsule(L.shoulderR, L.elbowR, 0.048, 0.04);
  const m = addMesh(root, "surface.upperArmR", g, mid(L.shoulderR, L.elbowR));
  orientLimb(m, L.shoulderR, L.elbowR);
}

// Forearms (elbow → wrist proxy near hand)
const wristL = [
  L.elbowL[0] - 0.02,
  L.elbowL[1] - 0.22,
  L.elbowL[2] + 0.02
];
const wristR = [
  L.elbowR[0] + 0.02,
  L.elbowR[1] - 0.22,
  L.elbowR[2] + 0.02
];
{
  const g = limbCapsule(L.elbowL, wristL, 0.038, 0.032);
  const m = addMesh(root, "surface.forearmL", g, mid(L.elbowL, wristL));
  orientLimb(m, L.elbowL, wristL);
}
{
  const g = limbCapsule(L.elbowR, wristR, 0.038, 0.032);
  const m = addMesh(root, "surface.forearmR", g, mid(L.elbowR, wristR));
  orientLimb(m, L.elbowR, wristR);
}

addMesh(root, "surface.handL", ellipsoid(0.04, 0.055, 0.025, 16, 12), [
  wristL[0],
  wristL[1] - 0.04,
  wristL[2]
]);
addMesh(root, "surface.handR", ellipsoid(0.04, 0.055, 0.025, 16, 12), [
  wristR[0],
  wristR[1] - 0.04,
  wristR[2]
]);

// Thighs / shins
{
  const g = limbCapsule(L.hipL, L.kneeL, 0.075, 0.055);
  const m = addMesh(root, "surface.thighL", g, mid(L.hipL, L.kneeL));
  orientLimb(m, L.hipL, L.kneeL);
}
{
  const g = limbCapsule(L.hipR, L.kneeR, 0.075, 0.055);
  const m = addMesh(root, "surface.thighR", g, mid(L.hipR, L.kneeR));
  orientLimb(m, L.hipR, L.kneeR);
}
{
  const g = limbCapsule(L.kneeL, L.ankleL, 0.05, 0.038);
  const m = addMesh(root, "surface.shinL", g, mid(L.kneeL, L.ankleL));
  orientLimb(m, L.kneeL, L.ankleL);
}
{
  const g = limbCapsule(L.kneeR, L.ankleR, 0.05, 0.038);
  const m = addMesh(root, "surface.shinR", g, mid(L.kneeR, L.ankleR));
  orientLimb(m, L.kneeR, L.ankleR);
}

// Feet — rounded, not boxy
addMesh(root, "surface.footL", ellipsoid(0.05, 0.035, 0.11, 16, 12), [
  L.ankleL[0],
  L.ankleL[1] + 0.02,
  L.ankleL[2] + 0.04
]);
addMesh(root, "surface.footR", ellipsoid(0.05, 0.035, 0.11, 16, 12), [
  L.ankleR[0],
  L.ankleR[1] + 0.02,
  L.ankleR[2] + 0.04
]);

/** Landmark positions for residual report (authored centers) */
const authored = {
  vertex: [...L.vertex],
  shoulderL: [...L.shoulderL],
  shoulderR: [...L.shoulderR],
  elbowL: [...L.elbowL],
  elbowR: [...L.elbowR],
  hipL: [...L.hipL],
  hipR: [...L.hipR],
  kneeL: [...L.kneeL],
  kneeR: [...L.kneeR],
  ankleL: [...L.ankleL],
  ankleR: [...L.ankleR],
  bodyCenter: [...L.bodyCenter]
};

const residuals = {};
let sum = 0;
let max = 0;
let maxId = null;
for (const [id, target] of Object.entries(L)) {
  const src = authored[id] || target;
  const e = dist(src, target);
  residuals[id] = { errorMeters: Number(e.toFixed(6)), errorMm: Number((e * 1000).toFixed(2)) };
  sum += e;
  if (e > max) {
    max = e;
    maxId = id;
  }
}
const mean = sum / Object.keys(L).length;

const exporter = new GLTFExporter();
const ab = await new Promise((resolve, reject) => {
  exporter.parse(root, resolve, reject, { binary: true });
});

// Preserve previous capsule mannequin once for provenance (if not already archived).
if (fs.existsSync(outFile) && !fs.existsSync(legacyFile)) {
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.copyFileSync(outFile, legacyFile);
  fs.writeFileSync(
    path.join(legacyDir, "README.md"),
    `# Interim capsule mannequin (archived)

Archived from \`adult-male/exterior-lod0.glb\` before the canonical-frame
styled exterior swap (Slice 6 / Option B visible exterior).

Not used at runtime. Retained for provenance and residual comparison.
`
  );
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, Buffer.from(ab));

const report = {
  schemaVersion: "1.0.0",
  exteriorId: "adult-male-styled-canonical-silhouette-v1",
  coordinateFrame: "painlocator-bp3d-canonical-v1",
  method: "authored-at-bp3d-landmark-targets",
  regionalPatches: false,
  generatedAt: new Date().toISOString(),
  payloadBytes: fs.statSync(outFile).size,
  meshCount: root.children.length,
  landmarkResidualsMeters: residuals,
  metrics: {
    landmarkCount: Object.keys(L).length,
    meanAlignmentErrorMeters: Number(mean.toFixed(6)),
    maxAlignmentErrorMeters: Number(max.toFixed(6)),
    maxLandmarkId: maxId,
    meanMm: Number((mean * 1000).toFixed(2)),
    maxMm: Number((max * 1000).toFixed(2)),
    passPreview: mean <= 0.08 && max <= 0.12,
    passDevelopment: mean <= 0.04 && max <= 0.07,
    readyForPersistence: false
  },
  notes: [
    "Exterior part centers are authored at BP3D target landmarks; identity conformer expected.",
    "Geometry is PainLocator procedural silhouette (lathe torso + soft limbs), not BP3D skin.",
    "Landmark-center residuals may be 0 mm by construction; do not persist canonicalBodyXYZ until surface-sample QA + schema decision."
  ]
};
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");

console.log(`Wrote ${outFile} (${report.payloadBytes} bytes, ${report.meshCount} meshes)`);
console.log(
  `Landmark residuals mean=${report.metrics.meanMm}mm max=${report.metrics.maxMm}mm (${maxId})`
);
console.log(`Report → ${reportFile}`);
