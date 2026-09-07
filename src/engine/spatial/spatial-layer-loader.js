/**
 * SpatialLayerLoader — lazy optional anatomy pack loader (CAE Spatial).
 * Clinician-only. Caches packs in-session. Never invoked for Patient shell.
 * Registration lives in JSON; this module applies it — UI must not hardcode transforms.
 *
 * Ownership / cache invariant
 * ---------------------------
 * PainLocator mounts at most one active SpatialAnatomyRenderer at a time
 * (plate ↔ spatial remounts tear down the prior spatial mount first).
 *
 * The loader cache owns pack *templates*: GLTF scene graphs, geometries, and
 * registration/manifest metadata. Controllers borrow packs by parenting `root`
 * into their layer group and may replace mesh materials for preview styling.
 *
 * Controllers MUST call `detachPack(pack)` on teardown — never free geometries
 * while the pack remains cached. Failed loads clear their promise so retry is
 * allowed. Call `clearPackCache()` only for intentional session wipe / tests.
 */
(function (global) {
  const DEFAULT_PACK_BASE = "/anatomy/spatial/prototype-bp3d";
  const DEFAULT_REGISTRATION_URL =
    "/anatomy/spatial/registration/bp3d-shoulder-adult-male.json";
  const LAYER_FILES = Object.freeze({
    muscle: "muscle.glb",
    skeletal: "skeletal.glb"
  });

  /** @type {Map<string, Promise<object>>} */
  const packPromises = new Map();
  /** @type {Map<string, object>} */
  const packCache = new Map();
  /** @type {Map<string, Promise<object>>} */
  const registrationPromises = new Map();

  let meshoptReady = null;
  let gltfLoaderPromise = null;

  function packCacheKey(layerId, registrationUrl) {
    return `${layerId}::${registrationUrl || DEFAULT_REGISTRATION_URL}`;
  }

  function joinUrl(base, relative) {
    if (!relative) return base;
    if (/^https?:\/\//i.test(relative) || relative.startsWith("/")) return relative;
    return String(base).replace(/\/?$/, "/") + String(relative).replace(/^\.\//, "");
  }

  function isPatientBlocked(presentationMode) {
    return presentationMode === "patient";
  }

  function assertClinicianAllowed(presentationMode) {
    if (isPatientBlocked(presentationMode)) {
      throw new Error("Spatial layer packs are clinician-only");
    }
  }

  function validateRegistrationConfig(reg) {
    if (!reg || typeof reg !== "object") throw new Error("Registration missing");
    if (!reg.sourceModelId || !reg.targetModelId) {
      throw new Error("Registration model ids required");
    }
    if (!reg.transform || typeof reg.transform.scale !== "number") {
      throw new Error("Registration transform.scale required");
    }
    if (!Array.isArray(reg.transform.translation) || reg.transform.translation.length !== 3) {
      throw new Error("Registration transform.translation[3] required");
    }
    if (
      reg.validation?.stopConditionTriggered ||
      reg.validation?.status === "fail" ||
      reg.validation?.status === "REGISTRATION FAILED"
    ) {
      const err = new Error("REGISTRATION FAILED");
      err.code = "REGISTRATION_FAILED";
      err.registration = reg;
      throw err;
    }
    return reg;
  }

  async function loadMeshoptDecoder() {
    // Meshopt is configured by the Vite Spatial runtime GLTF factory.
    return null;
  }

  async function getGltfLoader() {
    if (gltfLoaderPromise) return gltfLoaderPromise;
    gltfLoaderPromise = (async () => {
      const threeLoader =
        (typeof globalThis !== "undefined" && globalThis.SpatialThreeLoader) ||
        (typeof window !== "undefined" && window.SpatialThreeLoader) ||
        null;
      if (!threeLoader || typeof threeLoader.createGLTFLoader !== "function") {
        throw new Error("SpatialThreeLoader.createGLTFLoader required");
      }
      const boot =
        (typeof globalThis !== "undefined" && globalThis.SpatialBootUtils) ||
        (typeof window !== "undefined" && window.SpatialBootUtils) ||
        null;
      const withTimeout = boot && boot.withTimeout ? boot.withTimeout : (p) => p;
      const gltfLoaderMs = (boot && boot.TIMEOUTS && boot.TIMEOUTS.gltfLoaderMs) || 10000;
      return withTimeout(threeLoader.createGLTFLoader(), gltfLoaderMs, "GLTFLoader");
    })().catch((err) => {
      gltfLoaderPromise = null;
      throw err;
    });
    return gltfLoaderPromise;
  }

  async function loadRegistration(url = DEFAULT_REGISTRATION_URL) {
    const key = url || DEFAULT_REGISTRATION_URL;
    if (registrationPromises.has(key)) return registrationPromises.get(key);
    const pending = fetch(key, { cache: "force-cache" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Registration HTTP ${res.status}`);
        return validateRegistrationConfig(await res.json());
      })
      .catch((err) => {
        registrationPromises.delete(key);
        throw err;
      });
    registrationPromises.set(key, pending);
    return pending;
  }

  function applyRegistrationTransform(root, registration) {
    const t = registration.transform;
    const rot = t.rotationEuler || [0, 0, 0];
    const tr = t.translation || [0, 0, 0];
    root.scale.setScalar(t.scale);
    root.rotation.order = t.rotationOrder || "XYZ";
    root.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    root.position.set(tr[0] || 0, tr[1] || 0, tr[2] || 0);
    root.updateMatrixWorld(true);
    return root;
  }

  /**
   * Prototype BP3D GLBs may store undotted mesh names (muscledeltoidclavicularleft)
   * while the manifest uses dotted meshIds (muscle.deltoid.clavicular.left).
   * Match by stripping dots; prefer the manifest's dotted id as the stable key.
   * @param {string} rawId
   * @param {Map<string, object>} metaById
   * @param {Map<string, string>} undottedToId
   */
  function resolveLayerMeshId(rawId, metaById, undottedToId) {
    const raw = String(rawId || "");
    if (!raw) return null;
    if (metaById.has(raw)) return raw;
    const undotted = raw.replace(/\./g, "");
    return undottedToId.get(undotted) || null;
  }

  function bindMeshMetadata(root, layerId, manifestLayer) {
    /** @type {Map<string, import('three').Mesh>} */
    const meshById = new Map();
    /** @type {Map<string, object>} */
    const metaById = new Map();
    /** @type {Map<string, string>} */
    const undottedToId = new Map();

    for (const entry of manifestLayer?.meshes || []) {
      metaById.set(entry.meshId, {
        meshId: entry.meshId,
        structureId: entry.structureId,
        structureName: entry.structureName,
        clinicalName: entry.clinicalName,
        layer: entry.layer || layerId,
        laterality: entry.laterality || null,
        sourceRepresentationId: entry.sourceRepresentationId || null,
        sourceElementFileId: entry.sourceElementFileId || null,
        parentStructureId: entry.parentStructureId || null
      });
      undottedToId.set(String(entry.meshId).replace(/\./g, ""), entry.meshId);
    }

    root.traverse((obj) => {
      if (!obj.isMesh) return;
      const rawId = obj.name || obj.userData?.meshId;
      if (!rawId) throw new Error(`Layer ${layerId} mesh missing stable name`);
      const meshId = resolveLayerMeshId(rawId, metaById, undottedToId);
      if (!meshId) throw new Error(`Layer ${layerId} GLB mesh not in manifest: ${rawId}`);
      const meta = metaById.get(meshId);
      obj.name = meshId;
      obj.userData.meshId = meshId;
      obj.userData.structureId = meta.structureId;
      obj.userData.structureName = meta.structureName;
      obj.userData.clinicalName = meta.clinicalName;
      obj.userData.layer = meta.layer;
      obj.userData.laterality = meta.laterality;
      obj.userData.sourceRepresentationId = meta.sourceRepresentationId;
      obj.userData.sourceElementFileId = meta.sourceElementFileId;
      obj.userData.spatialLayer = layerId;
      obj.userData.spatialBody = false;
      meshById.set(meshId, obj);
    });

    for (const id of metaById.keys()) {
      if (!meshById.has(id)) {
        throw new Error(`Layer ${layerId} manifest mesh missing from GLB: ${id}`);
      }
    }

    return { meshById, metaById };
  }

  function detachPack(pack) {
    if (!pack?.root) return;
    pack.root.visible = false;
    pack.root.parent?.remove(pack.root);
  }

  function disposePackResources(pack) {
    if (!pack?.root) return;
    detachPack(pack);
    pack.root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose?.();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
        else obj.material.dispose?.();
      }
    });
  }

  /**
   * @param {typeof import('three')} THREE
   * @param {'muscle'|'skeletal'} layerId
   * @param {{ presentationMode?: string, packBase?: string, registrationUrl?: string }} [options]
   */
  async function loadLayerPack(THREE, layerId, options = {}) {
    assertClinicianAllowed(options.presentationMode || "clinician");
    if (layerId !== "muscle" && layerId !== "skeletal") {
      throw new Error(`Unsupported layer pack: ${layerId}`);
    }

    const flag =
      (typeof globalThis !== "undefined" && globalThis.CanonicalBodyFlag) ||
      (typeof window !== "undefined" && window.CanonicalBodyFlag) ||
      null;
    const fullBody = !!(flag && flag.resolveFullBodyAnatomy && flag.resolveFullBodyAnatomy());
    if (fullBody) {
      return loadFullBodyLayerPack(THREE, layerId, options);
    }

    const registrationUrl = options.registrationUrl || DEFAULT_REGISTRATION_URL;
    const cacheKey = packCacheKey(layerId, registrationUrl);
    if (packCache.has(cacheKey)) return packCache.get(cacheKey);
    if (packPromises.has(cacheKey)) return packPromises.get(cacheKey);
    // Back-compat: also answer legacy single-key lookups for the default registration.
    if (
      registrationUrl === DEFAULT_REGISTRATION_URL &&
      packCache.has(layerId) &&
      !options.registrationUrl
    ) {
      return packCache.get(layerId);
    }

    const packBase = options.packBase || DEFAULT_PACK_BASE;
    const url = joinUrl(packBase, LAYER_FILES[layerId]);
    const manifestUrl = joinUrl(packBase, "manifest.json");

    const pending = (async () => {
      const registration = await loadRegistration(registrationUrl);
      const [manifestRes, loader] = await Promise.all([
        fetch(manifestUrl, { cache: "force-cache" }),
        getGltfLoader()
      ]);
      if (!manifestRes.ok) throw new Error(`Layer manifest HTTP ${manifestRes.status}`);
      const manifest = await manifestRes.json();
      if (manifest.modelId !== "bp3d-prototype-shoulder") {
        throw new Error(`Unexpected layer pack modelId: ${manifest.modelId}`);
      }
      if (registration.sourceModelId !== manifest.modelId) {
        throw new Error(
          `Registration sourceModelId ${registration.sourceModelId} ≠ pack ${manifest.modelId}`
        );
      }

      const layerDef = manifest.layers?.[layerId];
      if (!layerDef?.file) throw new Error(`Manifest missing layers.${layerId}`);

      const gltf = await loader.loadAsync(url);
      const sceneRoot = gltf.scene || gltf.scenes?.[0];
      if (!sceneRoot) throw new Error(`Layer ${layerId} GLB has no scene`);

      const root = new THREE.Group();
      root.name = `spatial-layer-${layerId}`;
      root.userData.spatialLayerPack = layerId;
      root.add(sceneRoot);
      applyRegistrationTransform(root, registration);

      const bound = bindMeshMetadata(root, layerId, layerDef);
      let byteLength = layerId === "muscle" ? 89904 : 115888;
      try {
        const head = await fetch(url, { method: "HEAD", cache: "force-cache" });
        const len = head.headers.get("content-length");
        if (len) byteLength = Number(len);
      } catch (_) { /* keep fallback */ }

      const packed = {
        layerId,
        url,
        registrationUrl,
        byteLength,
        root,
        meshById: bound.meshById,
        metaById: bound.metaById,
        manifest,
        registration,
        fullBody: false,
        /** @deprecated Prefer SpatialLayerLoader.detachPack — do not free shared cache. */
        dispose() {
          detachPack(packed);
        }
      };
      packCache.set(cacheKey, packed);
      // Legacy alias for default registration (existing tests / callers).
      if (registrationUrl === DEFAULT_REGISTRATION_URL) {
        packCache.set(layerId, packed);
      }
      return packed;
    })().catch((err) => {
      packPromises.delete(cacheKey);
      throw err;
    });

    packPromises.set(cacheKey, pending);
    return pending;
  }

  /**
   * Progressive multi-pack full-body MSK load (?fullBodyAnatomy=1).
   */
  async function loadFullBodyLayerPack(THREE, layerId, options = {}) {
    const flag =
      (typeof globalThis !== "undefined" && globalThis.CanonicalBodyFlag) ||
      (typeof window !== "undefined" && window.CanonicalBodyFlag) ||
      null;
    const indexUrl = (flag && flag.FULLBODY_INDEX_URL) ||
      "/anatomy/spatial/prototype-bp3d-fullbody-msk/index.json";
    const registrationUrl =
      options.registrationUrl ||
      (flag && flag.FULLBODY_IDENTITY_REGISTRATION_URL) ||
      "/anatomy/spatial/registration/bp3d-fullbody-canonical-identity.json";
    const cacheKey = `fullbody::${layerId}::${registrationUrl}`;
    if (packCache.has(cacheKey)) return packCache.get(cacheKey);
    if (packPromises.has(cacheKey)) return packPromises.get(cacheKey);

    const pending = (async () => {
      const registration = await loadRegistration(registrationUrl);
      const [indexRes, loader] = await Promise.all([
        fetch(indexUrl, { cache: "force-cache" }),
        getGltfLoader()
      ]);
      if (!indexRes.ok) throw new Error(`Full-body index HTTP ${indexRes.status}`);
      const index = await indexRes.json();
      if (index.modelId !== "bp3d-fullbody-msk-v1") {
        throw new Error(`Unexpected full-body modelId: ${index.modelId}`);
      }

      const packMetas = Object.values(index.packs || {}).filter((p) => p.layer === layerId);
      if (!packMetas.length) throw new Error(`No full-body packs for layer ${layerId}`);

      // Skip low-value "other" packs on first paint; keep available via index for future.
      const primary = packMetas.filter((p) => !String(p.packId).endsWith("-other"));
      const loadList = primary.length ? primary : packMetas;

      const root = new THREE.Group();
      root.name = `spatial-layer-fullbody-${layerId}`;
      root.userData.spatialLayerPack = layerId;
      root.userData.fullBodyAnatomy = true;

      const meshById = new Map();
      const metaById = new Map();
      let byteLength = 0;
      const loadedPackIds = [];

      await Promise.all(
        loadList.map(async (meta) => {
          const base = meta.baseUrl;
          const manifestUrl = joinUrl(base, "manifest.json");
          const glbUrl = joinUrl(base, LAYER_FILES[layerId]);
          const manifestRes = await fetch(manifestUrl, { cache: "force-cache" });
          if (!manifestRes.ok) throw new Error(`Pack manifest HTTP ${manifestRes.status} (${meta.packId})`);
          const manifest = await manifestRes.json();
          const layerDef = manifest.layers?.[layerId];
          if (!layerDef?.file) throw new Error(`Pack ${meta.packId} missing layers.${layerId}`);

          const gltf = await loader.loadAsync(glbUrl);
          const sceneRoot = gltf.scene || gltf.scenes?.[0];
          if (!sceneRoot) throw new Error(`Pack ${meta.packId} GLB has no scene`);

          const packRoot = new THREE.Group();
          packRoot.name = `fullbody-pack-${meta.packId}`;
          packRoot.add(sceneRoot);
          const bound = bindMeshMetadata(packRoot, layerId, layerDef);
          for (const [id, mesh] of bound.meshById) {
            if (meshById.has(id)) {
              throw new Error(`Duplicate meshId across full-body packs: ${id}`);
            }
            meshById.set(id, mesh);
          }
          for (const [id, metaRow] of bound.metaById) {
            metaById.set(id, metaRow);
          }
          root.add(packRoot);
          loadedPackIds.push(meta.packId);
          try {
            const head = await fetch(glbUrl, { method: "HEAD", cache: "force-cache" });
            const len = head.headers.get("content-length");
            if (len) byteLength += Number(len);
          } catch (_) {
            /* ignore */
          }
        })
      );

      applyRegistrationTransform(root, registration);

      const packed = {
        layerId,
        url: indexUrl,
        registrationUrl,
        byteLength,
        root,
        meshById,
        metaById,
        manifest: index,
        registration,
        fullBody: true,
        loadedPackIds,
        dispose() {
          detachPack(packed);
        }
      };
      packCache.set(cacheKey, packed);
      packCache.set(`fullbody::${layerId}`, packed);
      return packed;
    })().catch((err) => {
      packPromises.delete(cacheKey);
      throw err;
    });

    packPromises.set(cacheKey, pending);
    return pending;
  }

  function getCachedPack(layerId, registrationUrl) {
    if (registrationUrl) {
      return (
        packCache.get(packCacheKey(layerId, registrationUrl)) ||
        packCache.get(`fullbody::${layerId}::${registrationUrl}`) ||
        null
      );
    }
    return (
      packCache.get(layerId) ||
      packCache.get(`fullbody::${layerId}`) ||
      packCache.get(packCacheKey(layerId, DEFAULT_REGISTRATION_URL)) ||
      null
    );
  }

  function hasCachedPack(layerId, registrationUrl) {
    return !!getCachedPack(layerId, registrationUrl);
  }

  function clearPackCache() {
    const seen = new Set();
    for (const pack of [...packCache.values()]) {
      if (seen.has(pack)) continue;
      seen.add(pack);
      try {
        disposePackResources(pack);
      } catch (_) { /* ignore */ }
    }
    packCache.clear();
    packPromises.clear();
  }

  function clearRegistrationCache() {
    registrationPromises.clear();
  }

  global.SpatialLayerLoader = {
    loadLayerPack,
    loadRegistration,
    getCachedPack,
    hasCachedPack,
    clearPackCache,
    clearRegistrationCache,
    detachPack,
    disposePackResources,
    applyRegistrationTransform,
    validateRegistrationConfig,
    isPatientBlocked,
    joinUrl,
    getGltfLoader,
    DEFAULT_PACK_BASE,
    DEFAULT_REGISTRATION_URL,
    IDENTITY_REGISTRATION_URL:
      "/anatomy/spatial/registration/bp3d-shoulder-canonical-identity.json",
    LAYER_FILES,
    packCacheKey,
    /** App invariant: at most one active SpatialAnatomyRenderer. */
    SINGLE_ACTIVE_SPATIAL_RENDERER: true
  };
})(typeof window !== "undefined" ? window : globalThis);
