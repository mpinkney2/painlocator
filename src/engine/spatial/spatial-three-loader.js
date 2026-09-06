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
    pending = import(/* webpackIgnore: true */ resolveThreeUrl())
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
    try {
      const canvas = document.createElement("canvas");
      return !!(
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")
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
