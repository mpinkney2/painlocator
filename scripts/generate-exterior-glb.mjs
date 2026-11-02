/**
 * Build interim adult-male exterior GLB (PainLocator-authored procedural geometry).
 *
 * Build-time only — requires the npm **devDependency** `three@0.170.0`.
 * Runtime Spatial mode uses vendored `public/vendor/three.module.min.js` (r170),
 * not this package import.
 *
 * Visual goal: human silhouette with warm clinical skin (not cool gray mannequin).
 * Landmark node centers stay aligned with `exterior-to-canonical-v1.json`.
 *
 * Usage: node scripts/generate-exterior-glb.mjs
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
const outFile = path.join(__dirname, "../public/anatomy/spatial/adult-male/exterior-lod0.glb");

/** Warm clinical skin — matches SpatialExteriorAppearance.SKIN.baseColor.
 *  Use MeshStandardMaterial in the GLB so export does not require KHR_materials_sheen;
 *  runtime overrides with MeshPhysicalMaterial + sheen.
 */
const MAT = new THREE.MeshStandardMaterial({
  color: 0xc9a992,
  roughness: 0.58,
  metalness: 0.0
});

function lathe(points, segments = 32) {
  const geo = new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    segments
  );
  geo.computeVertexNormals();
  return geo;
}

function mergeGeometries(geos) {
  // Lightweight merge without BufferGeometryUtils (keep script lean).
  const out = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];
  let indexOffset = 0;
  const indices = [];
  for (const g of geos) {
    g.computeVertexNormals();
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
    }
    const idx = g.index;
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + indexOffset);
    } else {
      for (let i = 0; i < pos.count; i++) indices.push(i + indexOffset);
    }
    indexOffset += pos.count;
  }
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  out.setIndex(indices);
  out.computeVertexNormals();
  return out;
}

function headGeometry() {
  // Cranial oval + soft jaw suggestion (still schematic, less ball-like).
  const skull = new THREE.SphereGeometry(0.102, 48, 36);
  skull.scale(0.9, 1.1, 0.96);
  const jaw = new THREE.SphereGeometry(0.055, 24, 18);
  jaw.translate(0, -0.06, 0.02);
  jaw.scale(0.95, 0.7, 0.85);
  const geo = mergeGeometries([skull, jaw]);
  return geo;
}

function neckGeometry() {
  return lathe(
    [
      [0.0, 0.055],
      [0.038, 0.05],
      [0.042, 0.01],
      [0.05, -0.035],
      [0.055, -0.05],
      [0.0, -0.055]
    ],
    28
  );
}

function torsoGeometry() {
  // Contoured upper body: shoulders → chest → waist (meters, local Y).
  return lathe(
    [
      [0.0, 0.3],
      [0.12, 0.295],
      [0.175, 0.26],
      [0.195, 0.18],
      [0.188, 0.08],
      [0.17, 0.0],
      [0.155, -0.1],
      [0.15, -0.2],
      [0.165, -0.28],
      [0.0, -0.3]
    ],
    48
  );
}

function pelvisGeometry() {
  const geo = new THREE.SphereGeometry(0.15, 40, 28);
  geo.scale(1.35, 0.62, 1.05);
  geo.computeVertexNormals();
  return geo;
}

function shoulderGeometry() {
  const geo = new THREE.SphereGeometry(0.062, 28, 22);
  geo.scale(1.25, 0.9, 1.1);
  geo.computeVertexNormals();
  return geo;
}

function taperedLimb(rTop, rBot, length, radial = 20) {
  // Capsule-like limb with slight taper via lathe.
  const half = length / 2;
  const tip = Math.min(rTop, rBot) * 0.85;
  return lathe(
    [
      [0.0, half + tip * 0.9],
      [tip * 0.55, half + tip * 0.55],
      [rTop, half * 0.75],
      [(rTop + rBot) * 0.52, 0],
      [rBot, -half * 0.75],
      [tip * 0.55, -half - tip * 0.55],
      [0.0, -half - tip * 0.9]
    ],
    radial
  );
}

function handGeometry() {
  const palm = new THREE.SphereGeometry(0.038, 22, 16);
  palm.scale(0.75, 1.25, 0.55);
  const geo = palm;
  geo.computeVertexNormals();
  return geo;
}

function footGeometry() {
  const geo = new THREE.SphereGeometry(0.045, 24, 16);
  geo.scale(0.85, 0.45, 1.55);
  geo.translate(0, 0, 0.02);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Parts: [meshId, makeGeo, position, scale?]
 * Positions preserved for exterior→canonical landmark fit.
 */
const PARTS = [
  ["surface.head", headGeometry, [0, 1.68, 0.01], null],
  ["surface.neck", neckGeometry, [0, 1.545, 0], null],
  ["surface.torso", torsoGeometry, [0, 1.22, 0.02], [1.05, 1.0, 1.12]],
  ["surface.pelvis", pelvisGeometry, [0, 0.9, 0.01], null],
  ["surface.shoulderL", shoulderGeometry, [-0.24, 1.38, 0], null],
  ["surface.shoulderR", shoulderGeometry, [0.24, 1.38, 0], null],
  ["surface.upperArmL", () => taperedLimb(0.05, 0.042, 0.24), [-0.32, 1.18, 0.01], null],
  ["surface.upperArmR", () => taperedLimb(0.05, 0.042, 0.24), [0.32, 1.18, 0.01], null],
  ["surface.forearmL", () => taperedLimb(0.04, 0.032, 0.22), [-0.34, 0.92, 0.025], null],
  ["surface.forearmR", () => taperedLimb(0.04, 0.032, 0.22), [0.34, 0.92, 0.025], null],
  ["surface.handL", handGeometry, [-0.34, 0.76, 0.04], null],
  ["surface.handR", handGeometry, [0.34, 0.76, 0.04], null],
  ["surface.thighL", () => taperedLimb(0.078, 0.058, 0.34), [-0.1, 0.58, 0.01], null],
  ["surface.thighR", () => taperedLimb(0.078, 0.058, 0.34), [0.1, 0.58, 0.01], null],
  ["surface.shinL", () => taperedLimb(0.052, 0.04, 0.32), [-0.1, 0.24, 0.01], null],
  ["surface.shinR", () => taperedLimb(0.052, 0.04, 0.32), [0.1, 0.24, 0.01], null],
  ["surface.footL", footGeometry, [-0.1, 0.035, 0.05], null],
  ["surface.footR", footGeometry, [0.1, 0.035, 0.05], null]
];

const root = new THREE.Group();
root.name = "adultMaleExterior";
for (const [name, makeGeo, pos, scale] of PARTS) {
  const geo = makeGeo();
  const mesh = new THREE.Mesh(geo, MAT);
  mesh.name = name;
  mesh.userData.meshId = name;
  mesh.userData.layer = "surface";
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  root.add(mesh);
}

const exporter = new GLTFExporter();
const ab = await new Promise((resolve, reject) => {
  exporter.parse(root, resolve, reject, { binary: true });
});
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, Buffer.from(ab));
console.log(`Wrote ${outFile} (${fs.statSync(outFile).size} bytes)`);
