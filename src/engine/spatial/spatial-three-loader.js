/**
 * Spatial runtime loader bridge for the classic app.
 * Lazily loads the Vite ESM Spatial chunk (npm three + GLTFLoader + Meshopt).
 * Retires /public/vendor Three imports.
 */
(function (global) {
  let pending = null;

  function boot() {
    return global.SpatialBootUtils || (typeof globalThis !== "undefined" ? globalThis.SpatialBootUtils : null);
  }

  function clearThreeCache() {
    pending = null;
    global.__PAINLOCATOR_THREE__ = null;
    if (global.PainLocatorSpatialRuntime) {
      try {
        delete global.PainLocatorSpatialRuntime;
      } catch (_) {
        global.PainLocatorSpatialRuntime = null;
      }
    }
  }

  /**
   * Ensure Vite Spatial runtime bridge is ready.
   * @returns {Promise<object>}
   */
  function loadSpatialRuntime() {
    if (global.PainLocatorSpatialRuntime?.ready && global.PainLocatorSpatialRuntime.THREE?.WebGLRenderer) {
      return Promise.resolve(global.PainLocatorSpatialRuntime);
    }
    if (pending) return pending;
    const utils = boot();
    const withTimeout = utils && utils.withTimeout ? utils.withTimeout : (p) => p;
    const threeMs = (utils && utils.TIMEOUTS && utils.TIMEOUTS.threeMs) || 12000;

    const loader =
      typeof global.loadPainLocatorSpatialRuntime === "function"
        ? global.loadPainLocatorSpatialRuntime
        : null;
    if (!loader) {
      return Promise.reject(
        new Error("Spatial Vite bootstrap missing (loadPainLocatorSpatialRuntime)")
      );
    }

    pending = withTimeout(loader(), threeMs, "Spatial Vite runtime").then((runtime) => {
      if (!runtime?.THREE?.WebGLRenderer) {
        throw new Error("Spatial runtime loaded without WebGLRenderer");
      }
      global.PainLocatorSpatialRuntime = runtime;
      global.__PAINLOCATOR_THREE__ = runtime.THREE;
      pending = null;
      return runtime;
    }).catch((err) => {
      pending = null;
      throw err;
    });
    return pending;
  }

  function loadThreeModule() {
    return loadSpatialRuntime().then((runtime) => runtime.THREE);
  }

  function createGLTFLoader(options) {
    return loadSpatialRuntime().then((runtime) => {
      if (typeof runtime.createGLTFLoader !== "function") {
        throw new Error("Spatial runtime createGLTFLoader missing");
      }
      return runtime.createGLTFLoader(options);
    });
  }

  function isWebGLAvailable() {
    const utils = boot();
    if (utils && typeof utils.isWebGLReallyAvailable === "function") {
      return utils.isWebGLReallyAvailable();
    }
    try {
      const canvas = document.createElement("canvas");
      return !!(
        canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) ||
        canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false }) ||
        canvas.getContext("experimental-webgl", { failIfMajorPerformanceCaveat: false })
      );
    } catch (_) {
      return false;
    }
  }

  global.SpatialThreeLoader = {
    loadSpatialRuntime,
    loadThreeModule,
    createGLTFLoader,
    isWebGLAvailable,
    clearThreeCache
  };
})(typeof window !== "undefined" ? window : globalThis);
