/**
 * Shared async helpers for Spatial boot (timeouts + progress).
 */
(function (global) {
  /**
   * @template T
   * @param {Promise<T>} promise
   * @param {number} ms
   * @param {string} label
   * @returns {Promise<T>}
   */
  function withTimeout(promise, ms, label) {
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label || "operation"} timed out after ${ms}ms`));
      }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  /**
   * Soft WebGL probe. Do NOT call loseContext() — that can poison the next
   * real WebGLRenderer in Electron / Cursor Simple Browser.
   */
  function isWebGLReallyAvailable() {
    try {
      const canvas = document.createElement("canvas");
      const attrs = {
        alpha: true,
        antialias: false,
        depth: true,
        failIfMajorPerformanceCaveat: false,
        powerPreference: "default"
      };
      const gl =
        canvas.getContext("webgl2", attrs) ||
        canvas.getContext("webgl", attrs) ||
        canvas.getContext("experimental-webgl", attrs);
      if (!gl) return false;
      if (typeof gl.isContextLost === "function" && gl.isContextLost()) return false;
      gl.viewport(0, 0, 1, 1);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Dynamically import a file from /public/vendor.
   * Vite forbids analyzed imports of JS inside /public — use an absolute URL
   * plus @vite-ignore so dev server and classic script boot both work.
   * @param {string} path e.g. "/vendor/GLTFLoader.js"
   * @returns {Promise<object>}
   */
  function importVendorModule(path) {
    const rel = String(path || "").startsWith("/") ? String(path) : `/${path}`;
    let href = rel;
    try {
      if (typeof location !== "undefined" && location?.origin) {
        href = new URL(rel, location.origin).href;
      }
    } catch (_) {
      href = rel;
    }
    // @vite-ignore: public vendor ESM is served as a static URL, not bundled.
    return import(/* @vite-ignore */ /* webpackIgnore: true */ href);
  }

  global.SpatialBootUtils = {
    withTimeout,
    isWebGLReallyAvailable,
    importVendorModule,
    TIMEOUTS: {
      threeMs: 12000,
      gltfLoaderMs: 10000,
      exteriorMs: 20000,
      canonicalMs: 15000,
      mountMs: 45000,
      meshoptMs: 5000
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
