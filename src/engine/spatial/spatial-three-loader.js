/**
 * Lazy-load Three.js only when spatial mode is requested.
 * Dynamic import keeps classic script boot free of Three.js cost.
 *
 * Must not contain a source-level `import()` — Vite rewrites those and injects
 * ESM into classic <script> tags, which then fail and never define this global.
 */
(function (global) {
  let pending = null;

  function resolveThreeUrl() {
    if (global.PAINLOCATOR_THREE_URL) return global.PAINLOCATOR_THREE_URL;
    return "/vendor/three.module.min.js";
  }

  function importEsm(url) {
    if (typeof SpatialBootUtils !== "undefined" && SpatialBootUtils.importEsm) {
      return SpatialBootUtils.importEsm(url);
    }
    return new Function("u", "return import(u)")(url);
  }

  function importVendor(path) {
    if (typeof SpatialBootUtils !== "undefined" && SpatialBootUtils.importVendorModule) {
      return SpatialBootUtils.importVendorModule(path);
    }
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

  function loadThreeModule() {
    if (global.__PAINLOCATOR_THREE__ && global.__PAINLOCATOR_THREE__.WebGLRenderer) {
      return Promise.resolve(global.__PAINLOCATOR_THREE__);
    }
    global.__PAINLOCATOR_THREE__ = null;
    if (pending) return pending;
    const withTimeout =
      typeof SpatialBootUtils !== "undefined" && SpatialBootUtils.withTimeout
        ? SpatialBootUtils.withTimeout
        : (p) => p;
    const threeMs =
      (typeof SpatialBootUtils !== "undefined" && SpatialBootUtils.TIMEOUTS && SpatialBootUtils.TIMEOUTS.threeMs) ||
      12000;

    pending = withTimeout(
      (async () => {
        let mod = null;
        try {
          mod = await importVendor(resolveThreeUrl());
        } catch (urlErr) {
          // Fallback to import-map specifier when absolute URL import is blocked.
          try {
            mod = await importEsm("three");
          } catch (_) {
            throw urlErr;
          }
        }
        // Named-export ESM namespace (three.module.min.js) — unwrap default if present.
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
    resolveThreeUrl,
    importVendor
  };
})(typeof window !== "undefined" ? window : globalThis);
