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
    if (global.__PAINLOCATOR_THREE__) {
      return Promise.resolve(global.__PAINLOCATOR_THREE__);
    }
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
        global.__PAINLOCATOR_THREE__ = mod;
        pending = null;
        return mod;
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
