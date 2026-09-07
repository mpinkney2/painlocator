/**
 * Tiny Vite ESM bootstrap for Spatial.
 * Exposes a lazy loader the classic app can call without bundling Three into first paint.
 */
let pending = null;

/**
 * @returns {Promise<object>} PainLocatorSpatialRuntime bridge
 */
export async function loadPainLocatorSpatialRuntime() {
  if (typeof window !== "undefined" && window.PainLocatorSpatialRuntime?.ready) {
    return window.PainLocatorSpatialRuntime;
  }
  if (pending) return pending;
  pending = import("./engine/spatial/spatial-runtime-entry.js")
    .then((mod) => {
      const runtime = mod.default || {
        THREE: mod.THREE,
        GLTFLoader: mod.GLTFLoader,
        MeshoptDecoder: mod.MeshoptDecoder,
        createGLTFLoader: mod.createGLTFLoader,
        ensureMeshoptReady: mod.ensureMeshoptReady,
        version: mod.RUNTIME_VERSION,
        threeRevision: mod.THREE?.REVISION,
        ready: true,
        source: "vite-esm"
      };
      if (typeof window !== "undefined") {
        window.PainLocatorSpatialRuntime = runtime;
        window.__PAINLOCATOR_THREE__ = runtime.THREE;
      }
      pending = null;
      return runtime;
    })
    .catch((err) => {
      pending = null;
      throw err;
    });
  return pending;
}

if (typeof window !== "undefined") {
  window.loadPainLocatorSpatialRuntime = loadPainLocatorSpatialRuntime;
}
