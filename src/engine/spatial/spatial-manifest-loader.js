/**
 * SpatialManifestLoader — lazy catalog + exterior GLB loader for CAE Spatial.
 * Parses manifests, maps GLB meshes to stable meshId/structureId, never uses Three UUID as identity.
 */
(function (global) {
  const DEFAULT_CATALOG_URL = "/anatomy/spatial/manifest.json";

  function joinUrl(base, relative) {
    if (!relative) return base;
    if (/^https?:\/\//i.test(relative) || relative.startsWith("/")) return relative;
    const cleaned = String(base).replace(/\/[^/]*$/, "/");
    return cleaned + relative.replace(/^\.\//, "");
  }

  function validateCatalog(catalog) {
    if (!catalog || typeof catalog !== "object") throw new Error("Catalog missing");
    if (!catalog.schemaVersion) throw new Error("Catalog schemaVersion required");
    if (!catalog.defaultModelId) throw new Error("Catalog defaultModelId required");
    if (!Array.isArray(catalog.models) || !catalog.models.length) {
      throw new Error("Catalog models[] required");
    }
    return catalog;
  }

  function validateModelManifest(manifest) {
    if (!manifest || typeof manifest !== "object") throw new Error("Model manifest missing");
    if (!manifest.schemaVersion) throw new Error("Model schemaVersion required");
    if (!manifest.modelId) throw new Error("Model modelId required");
    if (!manifest.layers || typeof manifest.layers !== "object") {
      throw new Error("Model layers required");
    }
    const surface = manifest.layers.surface;
    if (!surface?.file) throw new Error("layers.surface.file required");
    if (!Array.isArray(surface.meshes) || !surface.meshes.length) {
      throw new Error("layers.surface.meshes[] required");
    }
    const seen = new Set();
    for (const entry of surface.meshes) {
      if (!entry.meshId) throw new Error("mesh entry missing meshId");
      if (seen.has(entry.meshId)) {
        throw new Error(`Duplicate meshId in manifest: ${entry.meshId}`);
      }
      seen.add(entry.meshId);
      // PL:surface.* are PainLocator-local interim IDs — not FMA identifiers.
      if (entry.structureId && !String(entry.structureId).startsWith("PL:")) {
        throw new Error(
          `structureId must use PL: prefix for interim Slice 1 IDs (got ${entry.structureId})`
        );
      }
    }
    return manifest;
  }

  function indexMeshes(manifest) {
    /** @type {Map<string, object>} */
    const byMeshId = new Map();
    for (const [layerId, layer] of Object.entries(manifest.layers || {})) {
      for (const entry of layer.meshes || []) {
        if (byMeshId.has(entry.meshId)) {
          throw new Error(`Duplicate meshId across layers: ${entry.meshId}`);
        }
        byMeshId.set(entry.meshId, { ...entry, layerId, file: layer.file, lod: layer.lod ?? 0 });
      }
    }
    return byMeshId;
  }

  /**
   * Manifest is authoritative. Every surface meshId must appear exactly once in the
   * GLB naming set, and the GLB must not introduce unknown body meshes.
   * @param {Iterable<string>} manifestMeshIds
   * @param {Iterable<string>} glbMeshIds
   */
  function assertManifestGlbIntegrity(manifestMeshIds, glbMeshIds) {
    const expected = [...manifestMeshIds];
    const actual = [...glbMeshIds];
    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);

    if (expected.length !== expectedSet.size) {
      throw new Error("Manifest contains duplicate meshId values");
    }
    if (actual.length !== actualSet.size) {
      throw new Error("GLB contains duplicate mesh names/meshIds");
    }

    const missing = expected.filter((id) => !actualSet.has(id));
    const unknown = actual.filter((id) => !expectedSet.has(id));
    if (missing.length || unknown.length) {
      const parts = [];
      if (missing.length) parts.push(`manifest meshIds missing from GLB: ${missing.join(", ")}`);
      if (unknown.length) parts.push(`GLB meshes missing from manifest: ${unknown.join(", ")}`);
      throw new Error(`Manifest↔GLB identity mismatch — ${parts.join("; ")}`);
    }
    return true;
  }

  class SpatialManifestLoader {
    constructor(options = {}) {
      this.catalogUrl = options.catalogUrl || DEFAULT_CATALOG_URL;
      this._catalog = null;
      this._modelCache = new Map();
      this._gltfLoader = null;
    }

    async loadCatalog() {
      if (this._catalog) return this._catalog;
      const res = await fetch(this.catalogUrl, { cache: "force-cache" });
      if (!res.ok) throw new Error(`Catalog HTTP ${res.status}`);
      this._catalog = validateCatalog(await res.json());
      return this._catalog;
    }

    async loadModelManifest(modelId) {
      const catalog = await this.loadCatalog();
      const id = modelId || catalog.defaultModelId;
      if (this._modelCache.has(id)) return this._modelCache.get(id);

      const entry = catalog.models.find((m) => m.modelId === id);
      if (!entry?.manifest) throw new Error(`Unknown modelId: ${id}`);

      const manifestUrl = joinUrl(this.catalogUrl, entry.manifest);
      const res = await fetch(manifestUrl, { cache: "force-cache" });
      if (!res.ok) throw new Error(`Model manifest HTTP ${res.status}`);
      const manifest = validateModelManifest(await res.json());
      const meshIndex = indexMeshes(manifest);
      const surfaceUrl = joinUrl(manifestUrl, manifest.layers.surface.file);
      const packed = {
        modelId: manifest.modelId,
        manifest,
        manifestUrl,
        surfaceUrl,
        meshIndex,
        provenance: manifest.provenance || null
      };
      this._modelCache.set(id, packed);
      return packed;
    }

    async _getGltfLoader(THREE) {
      if (this._gltfLoader) return this._gltfLoader;
      // Prefer shared loader (meshopt optional + timeouts) when available.
      if (typeof SpatialLayerLoader !== "undefined" && SpatialLayerLoader.getGltfLoader) {
        this._gltfLoader = await SpatialLayerLoader.getGltfLoader();
        return this._gltfLoader;
      }
      const boot = (typeof globalThis !== "undefined" && globalThis.SpatialBootUtils)
        || (typeof window !== "undefined" && window.SpatialBootUtils)
        || null;
      const withTimeout = boot && boot.withTimeout ? boot.withTimeout : (p) => p;
      const gltfLoaderMs = (boot && boot.TIMEOUTS && boot.TIMEOUTS.gltfLoaderMs) || 10000;
      const importVendor = boot && boot.importVendorModule ? boot.importVendorModule : null;
      if (!importVendor) throw new Error("SpatialBootUtils.importVendorModule required");
      const mod = await withTimeout(
        importVendor("/vendor/GLTFLoader.js"),
        gltfLoaderMs,
        "GLTFLoader import"
      );
      const Loader = mod.GLTFLoader || mod.default?.GLTFLoader;
      if (!Loader) throw new Error("GLTFLoader export missing");
      this._gltfLoader = new Loader();
      return this._gltfLoader;
    }

    /**
     * Load exterior surface GLB and return { scene, meshById, dispose }.
     * Applies stable meshId / structureId onto each Mesh.userData.
     */
    async loadExteriorSurface(THREE, modelId) {
      const boot = (typeof globalThis !== "undefined" && globalThis.SpatialBootUtils)
        || (typeof window !== "undefined" && window.SpatialBootUtils)
        || null;
      const withTimeout = boot && boot.withTimeout ? boot.withTimeout : (p) => p;
      const exteriorMs =
        (boot && boot.TIMEOUTS && boot.TIMEOUTS.exteriorMs) || 20000;

      const packed = await this.loadModelManifest(modelId);
      const loader = await this._getGltfLoader(THREE);
      const gltf = await withTimeout(
        loader.loadAsync(packed.surfaceUrl),
        exteriorMs,
        "Exterior GLB"
      );
      const root = gltf.scene || gltf.scenes?.[0];
      if (!root) throw new Error("GLB has no scene");

      /** @type {Map<string, import('three').Mesh>} */
      const meshById = new Map();
      const known = packed.meshIndex;
      /** @type {string[]} */
      const glbMeshIds = [];

      root.updateMatrixWorld(true);
      root.traverse((obj) => {
        if (!obj.isMesh) return;
        const meshId = obj.name || obj.userData?.meshId;
        if (!meshId) {
          throw new Error("GLB body mesh is missing a stable name/meshId");
        }
        glbMeshIds.push(meshId);
        const meta = known.get(meshId);
        // Binding still applied after integrity check; unknown IDs fail below.
        obj.name = meshId;
        obj.userData.meshId = meshId;
        obj.userData.structureId = meta?.structureId || null;
        obj.userData.structureName = meta?.structureName || meshId;
        obj.userData.clinicalName = meta?.clinicalName || meta?.structureName || meshId;
        obj.userData.layer = meta?.layer || meta?.layerId || "surface";
        obj.userData.spatialBody = true;
        obj.userData.modelId = packed.modelId;
        // Clinical-neutral override — avoid game-like GLB materials.
        if (obj.material) {
          const mat = new THREE.MeshStandardMaterial({
            color: 0xb9c2cc,
            roughness: 0.82,
            metalness: 0.04,
            flatShading: false
          });
          if (obj.material.dispose) obj.material.dispose();
          obj.material = mat;
        }
        meshById.set(meshId, obj);
      });

      assertManifestGlbIntegrity(known.keys(), glbMeshIds);

      return {
        modelId: packed.modelId,
        root,
        meshById,
        meshIndex: packed.meshIndex,
        provenance: packed.provenance,
        surfaceUrl: packed.surfaceUrl,
        dispose() {
          root.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose?.();
            if (obj.material) {
              if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
              else obj.material.dispose?.();
            }
          });
        }
      };
    }
  }

  // Pure helpers exported for unit tests (no fetch).
  global.SpatialManifestLoader = SpatialManifestLoader;
  global.SpatialManifestUtils = {
    joinUrl,
    validateCatalog,
    validateModelManifest,
    indexMeshes,
    assertManifestGlbIntegrity,
    DEFAULT_CATALOG_URL
  };
})(typeof window !== "undefined" ? window : globalThis);
