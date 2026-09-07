/**
 * Lazy-load Three.js only when spatial mode is requested.
 * All vendor ESM goes through SpatialBootUtils.importVendorModule — never source-level import().
 */
(function (global) {
  let pending = null;

  function boot() {
    return global.SpatialBootUtils || (typeof globalThis !== "undefined" ? globalThis.SpatialBootUtils : null);
  }

  function resolveThreeUrl() {
    if (global.PAINLOCATOR_THREE_URL) return global.PAINLOCATOR_THREE_URL;
    return "/vendor/three.module.min.js";
  }

  function importVendor(path) {
    const utils = boot();
    if (utils && typeof utils.importVendorModule === "function") {
      return utils.importVendorModule(path);
    }
    throw new Error("SpatialBootUtils.importVendorModule required before Three load");
  }

  function clearThreeCache() {
    pending = null;
    global.__PAINLOCATOR_THREE__ = null;
  }

  function loadThreeModule() {
    if (global.__PAINLOCATOR_THREE__ && global.__PAINLOCATOR_THREE__.WebGLRenderer) {
      return Promise.resolve(global.__PAINLOCATOR_THREE__);
    }
    global.__PAINLOCATOR_THREE__ = null;
    if (pending) return pending;
    const utils = boot();
    const withTimeout = utils && utils.withTimeout ? utils.withTimeout : (p) => p;
    const threeMs = (utils && utils.TIMEOUTS && utils.TIMEOUTS.threeMs) || 12000;

    pending = withTimeout(
      (async () => {
        let mod = null;
        let primaryErr = null;
        try {
          mod = await importVendor(resolveThreeUrl());
        } catch (urlErr) {
          primaryErr = urlErr;
          // Fallback to import-map bare specifier when absolute URL import is blocked.
          try {
            mod = await importVendor("three");
          } catch (_) {
            throw primaryErr;
          }
        }
        const THREE =
          mod && typeof mod.WebGLRenderer === "function"
            ? mod
            : mod && mod.default && typeof mod.default.WebGLRenderer === "function"
              ? mod.default
              : null;
        if (!THREE) {
          throw new Error("Three.js module loaded without WebGLRenderer");
        }
        global.__PAINLOCATOR_THREE__ = THREE;
        pending = null;
        return THREE;
      })(),
      threeMs,
      "Three.js import"
    ).catch((err) => {
      pending = null;
      throw err;
    });
    return pending;
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
    loadThreeModule,
    isWebGLAvailable,
    resolveThreeUrl,
    importVendor,
    clearThreeCache
  };
})(typeof window !== "undefined" ? window : globalThis);
