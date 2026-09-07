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
   * Runtime ESM import that Vite/Rollup must not statically rewrite.
   * Classic <script> tags cannot survive Vite injecting `import … from "/@vite/client"`.
   * @param {string} url Absolute or relative module URL
   * @returns {Promise<object>}
   */
  function importEsm(url) {
    // Built via Function so the `import` keyword is not visible to Vite transform.
    return new Function("u", "return import(u)")(url);
  }

  /**
   * Dynamically import a file from /public/vendor.
   * Use an absolute URL so /public JS is loaded as a static asset, not bundled.
   * @param {string} path e.g. "/vendor/GLTFLoader.js"
   * @returns {Promise<object>}
   */
  function importVendorModule(path) {
    const rel = String(path || "").startsWith("/") ? String(path) : `/${path}`;
    let href = rel;
    try {
      if (typeof location !== "undefined" && location && location.origin) {
        href = new URL(rel, location.origin).href;
      }
    } catch (_) {
      href = rel;
    }
    return importEsm(href);
  }

  global.SpatialBootUtils = {
    withTimeout,
    isWebGLReallyAvailable,
    importEsm,
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
