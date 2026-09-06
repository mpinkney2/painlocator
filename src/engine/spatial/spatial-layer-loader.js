/**
 * SpatialLayerLoader — lazy optional anatomy pack loader (CAE Spatial).
 * Clinician-only. Caches packs in-session. Never invoked for Patient shell.
 * Registration lives in JSON; this module applies it — UI must not hardcode transforms.
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

  let registrationPromise = null;
  let meshoptReady = null;
  let gltfLoaderPromise = null;

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
    if (meshoptReady) return meshoptReady;
    meshoptReady = import(/* webpackIgnore: true */ "/vendor/meshopt_decoder.module.js")
      .then((mod) => {
        const decoder = mod.MeshoptDecoder || mod.default?.MeshoptDecoder || mod.default;
        if (!decoder) throw new Error("MeshoptDecoder unavailable");
        return Promise.resolve(decoder.ready || Promise.resolve()).then(() => decoder);
      })
      .catch((err) => {
        meshoptReady = null;
        throw err;
      });
    return meshoptReady;
  }

  async function getGltfLoader() {
    if (gltfLoaderPromise) return gltfLoaderPromise;
    gltfLoaderPromise = (async () => {
      const mod = await import(/* webpackIgnore: true */ "/vendor/GLTFLoader.js");
      const Loader = mod.GLTFLoader || mod.default?.GLTFLoader;
      if (!Loader) throw new Error("GLTFLoader export missing");
      const loader = new Loader();
      const decoder = await loadMeshoptDecoder();
      if (typeof loader.setMeshoptDecoder === "function") {
        loader.setMeshoptDecoder(decoder);
      }
      return loader;
    })().catch((err) => {
      gltfLoaderPromise = null;
      throw err;
    });
    return gltfLoaderPromise;
  }

  async function loadRegistration(url = DEFAULT_REGISTRATION_URL) {
    if (registrationPromise) return registrationPromise;
    registrationPromise = fetch(url, { cache: "force-cache" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Registration HTTP ${res.status}`);
        return validateRegistrationConfig(await res.json());
      })
      .catch((err) => {
        registrationPromise = null;
        throw err;
      });
    return registrationPromise;
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

  function bindMeshMetadata(root, layerId, manifestLayer) {
    /** @type {Map<string, import('three').Mesh>} */
    const meshById = new Map();
    /** @type {Map<string, object>} */
    const metaById = new Map();

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
    }

    root.traverse((obj) => {
      if (!obj.isMesh) return;
      const meshId = obj.name || obj.userData?.meshId;
      if (!meshId) throw new Error(`Layer ${layerId} mesh missing stable name`);
      const meta = metaById.get(meshId);
      if (!meta) throw new Error(`Layer ${layerId} GLB mesh not in manifest: ${meshId}`);
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
    if (packCache.has(layerId)) return packCache.get(layerId);
    if (packPromises.has(layerId)) return packPromises.get(layerId);

    const packBase = options.packBase || DEFAULT_PACK_BASE;
    const url = joinUrl(packBase, LAYER_FILES[layerId]);
    const manifestUrl = joinUrl(packBase, "manifest.json");

    const pending = (async () => {
      const registration = await loadRegistration(options.registrationUrl);
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
        byteLength,
        root,
        meshById: bound.meshById,
        metaById: bound.metaById,
        manifest,
        registration,
        dispose() {
          root.parent?.remove(root);
          root.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose?.();
            if (obj.material) {
              if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
              else obj.material.dispose?.();
            }
          });
          packCache.delete(layerId);
          packPromises.delete(layerId);
        }
      };
      packCache.set(layerId, packed);
      return packed;
    })().catch((err) => {
      packPromises.delete(layerId);
      throw err;
    });

    packPromises.set(layerId, pending);
    return pending;
  }

  function getCachedPack(layerId) {
    return packCache.get(layerId) || null;
  }

  function hasCachedPack(layerId) {
    return packCache.has(layerId);
  }

  function clearPackCache() {
    for (const pack of [...packCache.values()]) {
      try {
        pack.dispose?.();
      } catch (_) { /* ignore */ }
    }
    packCache.clear();
    packPromises.clear();
  }

  global.SpatialLayerLoader = {
    loadLayerPack,
    loadRegistration,
    getCachedPack,
    hasCachedPack,
    clearPackCache,
    applyRegistrationTransform,
    validateRegistrationConfig,
    isPatientBlocked,
    joinUrl,
    DEFAULT_PACK_BASE,
    DEFAULT_REGISTRATION_URL,
    LAYER_FILES
  };
})(typeof window !== "undefined" ? window : globalThis);
