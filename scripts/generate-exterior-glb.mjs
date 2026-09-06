/**
 * Build interim adult-male exterior GLB (PainLocator-authored procedural geometry).
 *
 * Build-time only — requires the npm **devDependency** `three@0.170.0`.
 * Runtime Spatial mode uses vendored `public/vendor/three.module.min.js` (r170),
 * not this package import.
 *
 * Usage: node scripts/generate-exterior-glb.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Polyfills must exist before three/GLTFExporter load.
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

const MAT = new THREE.MeshStandardMaterial({
  color: 0xc5ccd6,
  roughness: 0.72,
  metalness: 0.02
});

const PARTS = [
  ["surface.head", () => new THREE.SphereGeometry(0.105, 32, 24), [0, 1.68, 0.01], null],
  ["surface.neck", () => new THREE.CylinderGeometry(0.045, 0.055, 0.09, 20), [0, 1.545, 0], null],
  ["surface.torso", () => new THREE.CapsuleGeometry(0.17, 0.42, 10, 20), [0, 1.22, 0.015], [1.15, 1, 0.95]],
  ["surface.pelvis", () => new THREE.SphereGeometry(0.145, 28, 20), [0, 0.9, 0], [1.25, 0.72, 0.95]],
  ["surface.shoulderL", () => new THREE.SphereGeometry(0.06, 16, 12), [-0.24, 1.38, 0], null],
  ["surface.shoulderR", () => new THREE.SphereGeometry(0.06, 16, 12), [0.24, 1.38, 0], null],
  ["surface.upperArmL", () => new THREE.CapsuleGeometry(0.045, 0.22, 6, 14), [-0.32, 1.18, 0], null],
  ["surface.upperArmR", () => new THREE.CapsuleGeometry(0.045, 0.22, 6, 14), [0.32, 1.18, 0], null],
  ["surface.forearmL", () => new THREE.CapsuleGeometry(0.038, 0.2, 6, 14), [-0.34, 0.92, 0.02], null],
  ["surface.forearmR", () => new THREE.CapsuleGeometry(0.038, 0.2, 6, 14), [0.34, 0.92, 0.02], null],
  ["surface.handL", () => new THREE.SphereGeometry(0.045, 14, 12), [-0.34, 0.76, 0.04], null],
  ["surface.handR", () => new THREE.SphereGeometry(0.045, 14, 12), [0.34, 0.76, 0.04], null],
  ["surface.thighL", () => new THREE.CapsuleGeometry(0.07, 0.32, 6, 14), [-0.1, 0.58, 0], null],
  ["surface.thighR", () => new THREE.CapsuleGeometry(0.07, 0.32, 6, 14), [0.1, 0.58, 0], null],
  ["surface.shinL", () => new THREE.CapsuleGeometry(0.055, 0.3, 6, 14), [-0.1, 0.24, 0], null],
  ["surface.shinR", () => new THREE.CapsuleGeometry(0.055, 0.3, 6, 14), [0.1, 0.24, 0], null],
  ["surface.footL", () => new THREE.BoxGeometry(0.09, 0.05, 0.2), [-0.1, 0.035, 0.04], null],
  ["surface.footR", () => new THREE.BoxGeometry(0.09, 0.05, 0.2), [0.1, 0.035, 0.04], null]
];

const root = new THREE.Group();
root.name = "adultMaleExterior";
for (const [name, makeGeo, pos, scale] of PARTS) {
  const geo = makeGeo();
  geo.computeVertexNormals();
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
