/**
 * CanonicalBodyLoader — session cache for the hidden BP3D canonical registration body.
 *
 * Ownership model (mirrors SpatialLayerLoader packs)
 * -------------------------------------------------
 * - Cache owns template scene graphs + geometries (and template materials).
 * - CanonicalBodyFrame borrows a *clone* parented into the active Spatial scene.
 * - Frame.dispose() MUST detach only — never free shared template geometries.
 * - clearCache() frees templates (tests / intentional session wipe).
 * - Failed load promises are cleared so retry is allowed.
 * - At most one active SpatialAnatomyRenderer (app invariant).
 *
 * Flag OFF never calls this module.
 */
(function (global) {
  const DEFAULT_BODY_URL =
    (global.CanonicalBodyFlag && global.CanonicalBodyFlag.CANONICAL_BODY_URL) ||
    "/anatomy/spatial/prototype-bp3d-fullbody/canonical-body.glb";
  const DEFAULT_MANIFEST_URL =
    (global.CanonicalBodyFlag && global.CanonicalBodyFlag.CANONICAL_MANIFEST_URL) ||
    "/anatomy/spatial/prototype-bp3d-fullbody/manifest.json";

  /** @type {Map<string, Promise<object>>} */
  const templatePromises = new Map();
  /** @type {Map<string, object>} */
  const templateCache = new Map();
  /** @type {Map<string, Promise<object>>} */
  const manifestPromises = new Map();

  let loadCount = 0;
  let fetchSpy = null;

  function cacheKey(bodyUrl) {
    return bodyUrl || DEFAULT_BODY_URL;
  }

  /**
   * Optional test hook: records absolute URLs requested for canonical assets.
   * @param {null|((url:string)=>void)} fn
   */
  function setFetchRecorder(fn) {
    fetchSpy = typeof fn === "function" ? fn : null;
  }

  function recordFetch(url) {
    try {
      fetchSpy?.(url);
    } catch (_) {
      /* ignore */
    }
  }

  async function loadManifest(url = DEFAULT_MANIFEST_URL) {
    const key = url || DEFAULT_MANIFEST_URL;
    if (manifestPromises.has(key)) return manifestPromises.get(key);
    recordFetch(key);
    const pending = fetch(key, { cache: "force-cache" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Canonical manifest HTTP ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        manifestPromises.delete(key);
        throw err;
      });
    manifestPromises.set(key, pending);
    return pending;
  }

  async function getGltfLoader() {
    const layerLoader =
      (typeof globalThis !== "undefined" && globalThis.SpatialLayerLoader) ||
      (typeof window !== "undefined" && window.SpatialLayerLoader) ||
      null;
    if (layerLoader && layerLoader.getGltfLoader) {
      return layerLoader.getGltfLoader();
    }
    const threeLoader =
      (typeof globalThis !== "undefined" && globalThis.SpatialThreeLoader) ||
      (typeof window !== "undefined" && window.SpatialThreeLoader) ||
      null;
    if (!threeLoader || typeof threeLoader.createGLTFLoader !== "function") {
      throw new Error("SpatialThreeLoader.createGLTFLoader required");
    }
    return threeLoader.createGLTFLoader();
  }

  /**
   * Load (or return cached) canonical body template.
   * @param {typeof import('three')} THREE
   * @param {{ bodyUrl?: string }} [options]
   */
  async function loadTemplate(THREE, options = {}) {
    const bodyUrl = options.bodyUrl || DEFAULT_BODY_URL;
    const key = cacheKey(bodyUrl);
    if (templateCache.has(key)) return templateCache.get(key);
    if (templatePromises.has(key)) return templatePromises.get(key);

    const pending = (async () => {
      recordFetch(bodyUrl);
      const loader = await getGltfLoader();
      const gltf = await loader.loadAsync(bodyUrl);
      const sceneRoot = gltf.scene || gltf.scenes?.[0];
      if (!sceneRoot) throw new Error("Canonical body GLB has no scene");

      let byteLength = 360564;
      try {
        const head = await fetch(bodyUrl, { method: "HEAD", cache: "force-cache" });
        recordFetch(bodyUrl);
        const len = head.headers.get("content-length");
        if (len) byteLength = Number(len);
      } catch (_) {
        /* keep fallback */
      }

      const template = {
        bodyUrl,
        byteLength,
        /** Template root — never parent into a live scene; clone for instances. */
        root: sceneRoot,
        geometries: new Set(),
        materials: new Set()
      };
      sceneRoot.traverse((obj) => {
        if (!obj.isMesh) return;
        if (obj.geometry) template.geometries.add(obj.geometry);
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) if (m) template.materials.add(m);
      });

      loadCount += 1;
      templateCache.set(key, template);
      return template;
    })().catch((err) => {
      templatePromises.delete(key);
      throw err;
    });

    templatePromises.set(key, pending);
    return pending;
  }

  /**
   * Borrow an instance root for a CanonicalBodyFrame.
   * Geometry is shared with the template; materials are cloned so preview styling
   * cannot mutate the template.
   */
  function borrowInstance(THREE, template) {
    if (!template?.root) throw new Error("Canonical template missing");
    const clone = template.root.clone(true);
    clone.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.userData.canonicalBody = true;
      obj.userData.spatialBody = false;
      obj.raycast = () => {};
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material = obj.material.map((m) => {
            const c = m.clone();
            c.transparent = true;
            c.opacity = 0;
            c.depthWrite = false;
            c.wireframe = false;
            c.color?.setHex?.(0x6a8cae);
            c.needsUpdate = true;
            return c;
          });
        } else {
          obj.material = obj.material.clone();
          obj.material.transparent = true;
          obj.material.opacity = 0;
          obj.material.depthWrite = false;
          obj.material.wireframe = false;
          obj.material.color?.setHex?.(0x6a8cae);
          obj.material.needsUpdate = true;
        }
      }
    });
    return {
      root: clone,
      byteLength: template.byteLength,
      bodyUrl: template.bodyUrl,
      sharedGeometries: true
    };
  }

  /** Detach instance from scene; dispose only *cloned* materials, never shared geos. */
  function detachInstance(instance) {
    if (!instance?.root) return;
    instance.root.parent?.remove(instance.root);
    instance.root.visible = false;
    instance.root.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        try {
          m.dispose?.();
        } catch (_) {
          /* ignore */
        }
      }
    });
  }

  function hasTemplate(bodyUrl) {
    return templateCache.has(cacheKey(bodyUrl));
  }

  function getLoadCount() {
    return loadCount;
  }

  function clearCache() {
    for (const template of templateCache.values()) {
      try {
        for (const g of template.geometries) g.dispose?.();
        for (const m of template.materials) m.dispose?.();
      } catch (_) {
        /* ignore */
      }
    }
    templateCache.clear();
    templatePromises.clear();
    manifestPromises.clear();
    loadCount = 0;
  }

  global.CanonicalBodyLoader = {
    loadTemplate,
    loadManifest,
    borrowInstance,
    detachInstance,
    hasTemplate,
    getLoadCount,
    clearCache,
    setFetchRecorder,
    DEFAULT_BODY_URL,
    DEFAULT_MANIFEST_URL,
    cacheKey
  };
})(typeof window !== "undefined" ? window : globalThis);
