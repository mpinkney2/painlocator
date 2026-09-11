/**
 * SpatialBootUtils — single production boot helper for CAE Spatial / BP3D.
 *
 * Owns:
 * - SPATIAL_RUNTIME_VERSION (cache-bust token)
 * - Vite-safe vendor ESM import (no source-level import())
 * - globalThis accessors
 * - soft WebGL probe (never loseContext)
 * - boot state helpers + health classification
 */
(function (global) {
  /** Bump together with all Spatial classic-script ?v= query tokens in index.html */
  const SPATIAL_RUNTIME_VERSION = "2026-09-11-blender-surface";

  const BOOT_STATES = Object.freeze({
    IDLE: "idle",
    LOADING_THREE: "loading-three",
    STARTING_WEBGL: "starting-webgl",
    LOADING_EXTERIOR: "loading-exterior",
    READY_SPATIAL: "ready-spatial",
    LOADING_CANONICAL: "loading-canonical",
    READY_CANONICAL: "ready-canonical",
    FAILED_SPATIAL: "failed-spatial",
    CANONICAL_DEGRADED: "canonical-degraded"
  });

  const REQUIRED_VENDOR = Object.freeze([
    "/vendor/three.module.min.js",
    "/vendor/GLTFLoader.js",
    "/vendor/meshopt_decoder.module.js"
  ]);

  /**
   * @param {string} name
   * @returns {any}
   */
  function getGlobal(name) {
    try {
      if (global && global[name] != null) return global[name];
    } catch (_) {
      /* ignore */
    }
    try {
      if (typeof globalThis !== "undefined" && globalThis[name] != null) return globalThis[name];
    } catch (_) {
      /* ignore */
    }
    try {
      if (typeof window !== "undefined" && window[name] != null) return window[name];
    } catch (_) {
      /* ignore */
    }
    return undefined;
  }

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
   * @returns {{ ok: boolean, software: boolean, renderer: string|null }}
   */
  function probeWebGL() {
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
      if (!gl) return { ok: false, software: true, renderer: null };
      if (typeof gl.isContextLost === "function" && gl.isContextLost()) {
        return { ok: false, software: true, renderer: null };
      }
      gl.viewport(0, 0, 1, 1);
      let renderer = null;
      try {
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        if (info) {
          renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || "") || null;
        }
      } catch (_) {
        renderer = null;
      }
      const blob = `${renderer || ""} ${gl.getParameter(gl.RENDERER) || ""}`;
      const software = /swiftshader|llvmpipe|softwar|microsoft basic render|mesa offscreen/i.test(
        blob
      );
      return { ok: true, software, renderer };
    } catch (_) {
      return { ok: false, software: true, renderer: null };
    }
  }

  /**
   * Soft WebGL probe. Do NOT call loseContext() — that can poison the next
   * real WebGLRenderer in Electron / Cursor Simple Browser.
   */
  function isWebGLReallyAvailable() {
    return probeWebGL().ok;
  }

  /**
   * Absolute URL for a same-origin path or bare specifier passthrough.
   * @param {string} path
   * @returns {string}
   */
  function resolveModuleHref(path) {
    const raw = String(path || "");
    if (!raw) throw new Error("importVendorModule: empty path");
    // Bare specifiers (e.g. "three") must stay bare so the document import map applies.
    if (!raw.startsWith("/") && !raw.startsWith("http://") && !raw.startsWith("https://") && !raw.startsWith(".")) {
      return raw;
    }
    const rel = raw.startsWith("/") || raw.startsWith("http") ? raw : `/${raw}`;
    try {
      if (typeof location !== "undefined" && location && location.origin && rel.startsWith("/")) {
        return new URL(rel, location.origin).href;
      }
    } catch (_) {
      /* fall through */
    }
    return rel;
  }

  /**
   * Runtime ESM import that Vite must not statically rewrite.
   * Classic <script> tags cannot survive Vite injecting `import … from "/@vite/client"`.
   * Uses Function-built import so the keyword is invisible to Vite transform.
   * Document import maps still apply to this dynamic import().
   * @param {string} url Absolute URL, root path, or bare specifier
   * @returns {Promise<object>}
   */
  function importEsm(url) {
    const href = resolveModuleHref(url);
    try {
      return new Function("u", "return import(u)")(href).catch((err) => {
        const msg = err && err.message ? err.message : String(err || "unknown");
        return Promise.reject(new Error(`ESM import failed for ${href}: ${msg}`));
      });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err || "unknown");
      return Promise.reject(new Error(`ESM import blocked for ${href}: ${msg}`));
    }
  }

  /**
   * Dynamically import a file from /public/vendor (or bare specifier).
   * @param {string} path e.g. "/vendor/GLTFLoader.js" or "three"
   * @returns {Promise<object>}
   */
  function importVendorModule(path) {
    return importEsm(path);
  }

  /**
   * @param {object|null|undefined} partial
   * @returns {object}
   */
  function createBootState(partial) {
    const base = {
      state: BOOT_STATES.IDLE,
      stage: "idle",
      error: null,
      timestamp: Date.now(),
      canonicalStatus: "idle",
      runtimeVersion: SPATIAL_RUNTIME_VERSION,
      threeRevision: null,
      exteriorModelId: null,
      meshCount: null,
      webglAvailable: null
    };
    return Object.assign(base, partial || {});
  }

  /**
   * Mutate engine.spatialBootState in place (not persisted).
   * @param {object} engine
   * @param {string} state
   * @param {object} [extra]
   */
  function setBootState(engine, state, extra) {
    if (!engine) return null;
    const prev = engine.spatialBootState || createBootState();
    const next = createBootState(
      Object.assign({}, prev, extra || {}, {
        state,
        stage: (extra && extra.stage) || state,
        timestamp: Date.now()
      })
    );
    engine.spatialBootState = next;
    try {
      engine.trigger?.("spatialbootstate", next);
    } catch (_) {
      /* ignore */
    }
    return next;
  }

  /**
   * Classify production Spatial health.
   * Canonical / clinician-layer degradation is NOT core failure.
   * @param {object} snapshot
   * @returns {"HEALTHY"|"DEGRADED"|"FAILED"}
   */
  function classifySpatialHealth(snapshot) {
    const s = snapshot || {};
    const spatialReady = !!(s.spatialReady || s.state === BOOT_STATES.READY_SPATIAL || s.state === BOOT_STATES.READY_CANONICAL || s.state === BOOT_STATES.CANONICAL_DEGRADED || s.state === BOOT_STATES.LOADING_CANONICAL);
    const exteriorLoaded = s.exteriorLoaded !== false && (s.exteriorLoaded === true || !!s.exteriorModelId || spatialReady);
    if (!spatialReady || !exteriorLoaded || s.state === BOOT_STATES.FAILED_SPATIAL) {
      if (s.state === BOOT_STATES.FAILED_SPATIAL || s.spatialReady === false) return "FAILED";
      if (!spatialReady) return "FAILED";
    }
    const canonicalOk = s.canonicalReady === true || s.state === BOOT_STATES.READY_CANONICAL;
    const canonicalDegraded =
      s.canonicalDegraded === true ||
      s.state === BOOT_STATES.CANONICAL_DEGRADED ||
      s.canonicalStatus === "degraded" ||
      s.canonicalStatus === "failed";
    const layersDegraded = s.layersDegraded === true;
    if (spatialReady && exteriorLoaded && (canonicalDegraded || layersDegraded || (!canonicalOk && s.canonicalExpected))) {
      return "DEGRADED";
    }
    if (spatialReady && exteriorLoaded) return "HEALTHY";
    return "FAILED";
  }

  /**
   * Build a PHI-free diagnostics snapshot for console / panel.
   * @param {object} [engine]
   * @returns {object}
   */
  function collectDiagnostics(engine) {
    const boot = (engine && engine.spatialBootState) || createBootState();
    const three = getGlobal("__PAINLOCATOR_THREE__");
    const flag = getGlobal("CanonicalBodyFlag");
    const loader = getGlobal("CanonicalBodyLoader");
    const presentation =
      (engine && engine.presentationMode) ||
      (getGlobal("state") && getGlobal("state").presentationMode) ||
      null;
    const spatialRenderer = engine && engine.spatialRenderer;
    const liveReady = !!(spatialRenderer && spatialRenderer.ready);
    const layerController = spatialRenderer && spatialRenderer.layerController;
    const depth = layerController && typeof layerController.getDepth === "function"
      ? layerController.getDepth()
      : "surface";
    const meshCount =
      boot.meshCount != null
        ? boot.meshCount
        : spatialRenderer && spatialRenderer.scene && spatialRenderer.scene.meshById
          ? spatialRenderer.scene.meshById.size
          : null;
    const canonicalReady = !!(spatialRenderer && spatialRenderer.isCanonicalBodyMode && spatialRenderer.isCanonicalBodyMode());
    const canonicalExpected = !!(flag && flag.isEnabled && flag.isEnabled());
    const spatialReady =
      liveReady ||
      boot.state === BOOT_STATES.READY_SPATIAL ||
      boot.state === BOOT_STATES.READY_CANONICAL ||
      boot.state === BOOT_STATES.CANONICAL_DEGRADED ||
      boot.state === BOOT_STATES.LOADING_CANONICAL ||
      !!(engine && engine.displayMode === "spatial");

    const snap = {
      runtimeVersion: SPATIAL_RUNTIME_VERSION,
      spatialReady,
      canonicalReady,
      canonicalDegraded:
        boot.state === BOOT_STATES.CANONICAL_DEGRADED ||
        boot.canonicalStatus === "degraded" ||
        boot.canonicalStatus === "failed",
      canonicalExpected,
      threeRevision: boot.threeRevision || (three && three.REVISION) || null,
      gpuRenderer: boot.gpuRenderer || null,
      softwareWebGL: boot.softwareWebGL === true,
      exteriorModelId:
        boot.exteriorModelId ||
        (spatialRenderer && spatialRenderer.scene && spatialRenderer.scene.modelId) ||
        null,
      exteriorLoaded: liveReady || spatialReady,
      meshCount,
      presentationMode: presentation,
      layerDepth: depth,
      patientLayerIsolation: presentation === "patient",
      displayMode: engine && engine.displayMode,
      bootState: boot.state,
      stage: boot.stage,
      lastFailure: (engine && engine.lastSpatialFailure) || boot.error || null,
      webglAvailable:
        boot.webglAvailable != null ? boot.webglAvailable : isWebGLReallyAvailable(),
      canonicalFromCache: !!(loader && loader.hasTemplate && loader.hasTemplate()),
      muscleLoaded: !!(layerController && layerController._packs && layerController._packs.has("muscle")),
      skeletalLoaded: !!(layerController && layerController._packs && layerController._packs.has("skeletal")),
      timestamp: Date.now()
    };
    snap.health = classifySpatialHealth(snap);
    return snap;
  }

  let _diagnosticsLogged = false;

  /**
   * Emit a single structured console diagnostics event (once per page unless force).
   * @param {object} [engine]
   * @param {{ force?: boolean }} [opts]
   */
  function logDiagnosticsOnce(engine, opts) {
    if (_diagnosticsLogged && !(opts && opts.force)) return;
    _diagnosticsLogged = true;
    const snap = collectDiagnostics(engine);
    try {
      console.info("[PainLocator Spatial Diagnostics]", snap);
    } catch (_) {
      /* ignore */
    }
    return snap;
  }

  function resetDiagnosticsLogFlag() {
    _diagnosticsLogged = false;
  }

  /**
   * Whether developer Spatial diagnostics UI should show.
   * Honors ?spatialDiagnostics=1 or ?dev=1. Respects production gate for ?dev=1
   * unless spatialDiagnostics is explicitly set.
   */
  function wantsSpatialDiagnostics() {
    try {
      const params = new URLSearchParams(global.location && global.location.search);
      const explicit = params.get("spatialDiagnostics");
      if (explicit === "1" || explicit === "true") return true;
      if (explicit === "0" || explicit === "false") return false;
      if (global.PAINLOCATOR_IS_PRODUCTION === true) return false;
      const dev = params.get("dev");
      return dev === "1" || dev === "true" || global.DEV_MODE === true;
    } catch (_) {
      return false;
    }
  }

  global.SpatialBootUtils = {
    SPATIAL_RUNTIME_VERSION,
    BOOT_STATES,
    REQUIRED_VENDOR,
    getGlobal,
    withTimeout,
    probeWebGL,
    isWebGLReallyAvailable,
    resolveModuleHref,
    importEsm,
    importVendorModule,
    createBootState,
    setBootState,
    classifySpatialHealth,
    collectDiagnostics,
    logDiagnosticsOnce,
    resetDiagnosticsLogFlag,
    wantsSpatialDiagnostics,
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
