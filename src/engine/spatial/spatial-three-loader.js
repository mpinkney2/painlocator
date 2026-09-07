/**
 * Lazy-load Three.js only when spatial mode is requested.
 * Dynamic import() keeps classic script boot free of Three.js cost.
 */
(function (global) {
  let pending = null;

  function resolveThreeUrl() {
    if (global.PAINLOCATOR_THREE_URL) return global.PAINLOCATOR_THREE_URL;
    return "/vendor/three.module.min.js";
  }

  function loadThreeModule() {
    if (global.__PAINLOCATOR_THREE__?.WebGLRenderer) {
      return Promise.resolve(global.__PAINLOCATOR_THREE__);
    }
    global.__PAINLOCATOR_THREE__ = null;
    if (pending) return pending;
    const withTimeout =
      typeof SpatialBootUtils !== "undefined" && SpatialBootUtils.withTimeout
        ? SpatialBootUtils.withTimeout
        : (p) => p;
    const threeMs =
      (typeof SpatialBootUtils !== "undefined" && SpatialBootUtils.TIMEOUTS?.threeMs) || 12000;

    pending = withTimeout(
      import(/* webpackIgnore: true */ resolveThreeUrl()),
      threeMs,
      "Three.js import"
    )
      .then((mod) => {
        // Named-export ESM namespace (three.module.min.js) — unwrap default if present.
        const THREE =
          mod && typeof mod.WebGLRenderer === "function"
            ? mod
            : mod?.default && typeof mod.default.WebGLRenderer === "function"
              ? mod.default
              : null;
        if (!THREE) {
          throw new Error("Three.js module loaded without WebGLRenderer");
        }
        global.__PAINLOCATOR_THREE__ = THREE;
        pending = null;
        return THREE;
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
    return pending;
  }

  function isWebGLAvailable() {
    if (typeof SpatialBootUtils !== "undefined" && SpatialBootUtils.isWebGLReallyAvailable) {
      return SpatialBootUtils.isWebGLReallyAvailable();
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
    resolveThreeUrl
  };
})(window);
