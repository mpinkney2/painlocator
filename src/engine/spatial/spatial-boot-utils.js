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
      // Touch a cheap GL call to ensure the context is usable.
      gl.viewport(0, 0, 1, 1);
      return true;
    } catch (_) {
      return false;
    }
  }

  global.SpatialBootUtils = {
    withTimeout,
    isWebGLReallyAvailable,
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
