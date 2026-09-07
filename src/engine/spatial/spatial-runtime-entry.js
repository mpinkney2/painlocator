/**
 * Vite-managed Spatial runtime entry (ESM).
 * Single source of truth for Three.js + GLTFLoader + MeshoptDecoder.
 * Do not import /public/vendor here.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const RUNTIME_VERSION = "2026-09-07-fullbody-1";

let meshoptReadyPromise = null;

async function ensureMeshoptReady() {
  if (!meshoptReadyPromise) {
    meshoptReadyPromise = Promise.resolve(MeshoptDecoder.ready || Promise.resolve())
      .then(() => MeshoptDecoder)
      .catch((err) => {
        meshoptReadyPromise = null;
        throw err;
      });
  }
  return meshoptReadyPromise;
}

/**
 * Create a GLTFLoader bound to this runtime's THREE + Meshopt.
 * @param {{ enableMeshopt?: boolean }} [options]
 */
async function createGLTFLoader(options = {}) {
  const loader = new GLTFLoader();
  if (options.enableMeshopt !== false) {
    try {
      const decoder = await ensureMeshoptReady();
      if (decoder && typeof loader.setMeshoptDecoder === "function") {
        loader.setMeshoptDecoder(decoder);
      }
    } catch (err) {
      console.warn("[PainLocatorSpatialRuntime] MeshoptDecoder unavailable", err);
    }
  }
  return loader;
}

const runtime = {
  THREE,
  GLTFLoader,
  MeshoptDecoder,
  createGLTFLoader,
  ensureMeshoptReady,
  version: RUNTIME_VERSION,
  threeRevision: THREE.REVISION,
  ready: true,
  source: "vite-esm"
};

export {
  THREE,
  GLTFLoader,
  MeshoptDecoder,
  createGLTFLoader,
  ensureMeshoptReady,
  RUNTIME_VERSION
};
export default runtime;
