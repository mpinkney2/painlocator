/**
 * Bake BodyParts3D FMA:7163 skin into the patient exterior GLB.
 *
 * - Decodes meshopt candidate
 * - Denormalizes quantized positions
 * - Bakes node TRS into geometry (meters, feet on y=0)
 * - Computes vertex normals
 * - Writes uncompressed GLB with meshId `surface.body`
 *
 * Runtime still applies SpatialExteriorAppearance skin materials.
 *
 * Usage: node scripts/bake-bp3d-patient-exterior.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

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

function denormalizeAttribute(attr) {
  if (!attr) return attr;
  if (!attr.normalized && attr.array instanceof Float32Array) return attr;
  const itemSize = attr.itemSize;
  const arr = new Float32Array(attr.count * itemSize);
  for (let i = 0; i < attr.count; i++) {
    for (let k = 0; k < itemSize; k++) {
      arr[i * itemSize + k] = attr.getComponent(i, k);
    }
  }
  return new THREE.BufferAttribute(arr, itemSize);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(
  __dirname,
  "../public/anatomy/spatial/prototype-bp3d-fullbody/exterior-candidate.glb"
);
const outPath = path.join(__dirname, "../public/anatomy/spatial/adult-male/exterior-lod0.glb");

const buf = readFileSync(srcPath);
const loader = new GLTFLoader();
await MeshoptDecoder.ready;
loader.setMeshoptDecoder(MeshoptDecoder);

const gltf = await new Promise((resolve, reject) => {
  loader.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    "",
    resolve,
    reject
  );
});

const root = gltf.scene || gltf.scenes[0];
root.updateMatrixWorld(true);
/** @type {import('three').Mesh|null} */
let mesh = null;
root.traverse((o) => {
  if (o.isMesh && !mesh) mesh = o;
});
if (!mesh) throw new Error("No mesh in exterior-candidate.glb");

mesh.name = "surface.body";
mesh.userData.meshId = "surface.body";
const geo = mesh.geometry;
geo.setAttribute("position", denormalizeAttribute(geo.getAttribute("position")));
if (geo.getAttribute("normal")) {
  geo.setAttribute("normal", denormalizeAttribute(geo.getAttribute("normal")));
}
mesh.updateWorldMatrix(true, false);
geo.applyMatrix4(mesh.matrixWorld);
mesh.position.set(0, 0, 0);
mesh.rotation.set(0, 0, 0);
mesh.scale.set(1, 1, 1);
mesh.updateMatrix();
geo.computeBoundingBox();
geo.translate(0, -geo.boundingBox.min.y, 0);
// Baked bounds are ~0.67m X (left–right) × ~0.29m Z (AP) with anterior toward +Z,
// matching SpatialProjection front view (camera on +Z, yaw 0).
geo.computeVertexNormals();
geo.computeBoundingBox();
geo.computeBoundingSphere();

mesh.material = new THREE.MeshStandardMaterial({
  color: 0xc9a992,
  roughness: 0.58,
  metalness: 0
});

const group = new THREE.Group();
group.name = "adultMaleExterior";
group.add(mesh);

const exporter = new GLTFExporter();
const ab = await new Promise((resolve, reject) => {
  exporter.parse(group, resolve, reject, { binary: true });
});
writeFileSync(outPath, Buffer.from(ab));
const bb = geo.boundingBox;
console.log(
  `Wrote ${outPath} (${Buffer.from(ab).byteLength} bytes) height=${(
    bb.max.y - bb.min.y
  ).toFixed(3)}m`
);
