/**
 * CanonicalBodyFrame — runtime canonical anatomical frame (Phase 2 Slice 5).
 *
 * Loads the hidden BP3D registration body only when canonical mode is enabled.
 * Exposes transform helpers and runtime-only canonicalBodyXYZ projection.
 * Visually hidden by default. Dispose cleans scene graph + GPU resources owned here.
 */
(function (global) {
  class CanonicalBodyFrame {
    /**
     * @param {typeof import('three')} THREE
     * @param {object} scene SpatialSceneController-like ({ bodyRoot, scene, requestFrame })
     * @param {object} [options]
     */
    constructor(THREE, scene, options = {}) {
      this.THREE = THREE;
      this.scene = scene;
      const constants =
        (global.CanonicalBodyFlag && global.CanonicalBodyFlag.getCanonicalFrameConstants()) ||
        {};
      this.coordinateFrameVersion =
        options.coordinateFrameVersion || constants.coordinateFrameVersion;
      this.canonicalModelId = options.canonicalModelId || constants.canonicalModelId;
      this.canonicalModelVersion =
        options.canonicalModelVersion || constants.canonicalModelVersion;
      this.manifestUrl = options.manifestUrl || constants.canonicalManifestUrl;
      this.bodyUrl = options.bodyUrl || constants.canonicalBodyUrl;
      this.conformerUrl = options.conformerUrl || constants.exteriorConformerUrl;

      this.ready = false;
      this.disposed = false;
      this.visible = false;
      this.loadError = null;
      this.manifest = null;
      this.conformer = null;
      this.alignmentReport = null;
      this.root = null;
      /** @type {import('three').Mesh[]} */
      this.meshes = [];
      this.bounds = null;
      this._byteLength = null;
      this._loadMs = null;
      this._ownedGeometries = new Set();
      this._ownedMaterials = new Set();
    }

    getMeta() {
      return {
        coordinateFrameVersion: this.coordinateFrameVersion,
        canonicalModelId: this.canonicalModelId,
        canonicalModelVersion: this.canonicalModelVersion,
        registrationVersion:
          this.conformer?.registrationVersion ||
          this.conformer?.registrationId ||
          null,
        ready: this.ready,
        visible: this.visible,
        byteLength: this._byteLength,
        loadMs: this._loadMs,
        loadError: this.loadError ? String(this.loadError.message || this.loadError) : null
      };
    }

    /**
     * Load conformer config + hidden canonical GLB. Safe to call once per mount.
     */
    async load() {
      if (this.disposed) throw new Error("CanonicalBodyFrame disposed");
      if (this.ready) return this;
      const t0 =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();

      try {
        const [manifest, conformer, gltf] = await Promise.all([
          this._loadManifest(),
          ExteriorCanonicalConformer.loadConformerConfig(this.conformerUrl),
          this._loadCanonicalGlb()
        ]);
        if (this.disposed) {
          this._disposeGltfScene(gltf?.scene);
          throw new Error("CanonicalBodyFrame disposed during load");
        }

        this.manifest = manifest;
        this.conformer = conformer;
        if (manifest?.coordinateFrame?.frameId) {
          this.coordinateFrameVersion = manifest.coordinateFrame.frameId;
        }
        if (manifest?.prototypeId) {
          this.canonicalModelVersion = manifest.prototypeId;
        }

        this.root = new this.THREE.Group();
        this.root.name = "canonicalBodyFrame";
        this.root.userData.canonicalBody = true;
        this.root.userData.coordinateFrameVersion = this.coordinateFrameVersion;
        this.root.visible = false;

        const sceneRoot = gltf.scene || gltf.scenes?.[0];
        if (!sceneRoot) throw new Error("Canonical body GLB has no scene");
        this.root.add(sceneRoot);

        this.meshes = [];
        this.root.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.userData.canonicalBody = true;
          obj.userData.spatialBody = false;
          obj.raycast = () => {}; // never patient-pickable
          // Keep GPU resources; mark ownership for dispose
          if (obj.geometry) this._ownedGeometries.add(obj.geometry);
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) if (m) this._ownedMaterials.add(m);
          // Hidden reference material (validation may restyle)
          if (obj.material) {
            const apply = (mat) => {
              mat.transparent = true;
              mat.opacity = 0.0;
              mat.depthWrite = false;
              mat.color?.setHex?.(0x6a8cae);
              mat.wireframe = false;
              mat.needsUpdate = true;
            };
            if (Array.isArray(obj.material)) obj.material.forEach(apply);
            else apply(obj.material);
          }
          this.meshes.push(obj);
        });

        this.scene.bodyRoot.add(this.root);
        this.root.updateMatrixWorld(true);
        this.bounds = this.resolveCanonicalBounds();
        this.alignmentReport = ExteriorCanonicalConformer.buildAlignmentReport(conformer, {
          loadedAt: new Date().toISOString(),
          bounds: this.bounds
        });
        this.ready = true;
        this._loadMs =
          (typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now()) - t0;
        this.scene.requestFrame?.();
        return this;
      } catch (err) {
        this.loadError = err;
        this.ready = false;
        throw err;
      }
    }

    async _loadManifest() {
      const res = await fetch(this.manifestUrl, { cache: "force-cache" });
      if (!res.ok) throw new Error(`Canonical manifest HTTP ${res.status}`);
      return res.json();
    }

    async _loadCanonicalGlb() {
      // Reuse layer loader's meshopt GLTF path when available
      let loader;
      if (typeof SpatialLayerLoader !== "undefined" && SpatialLayerLoader.getGltfLoader) {
        loader = await SpatialLayerLoader.getGltfLoader();
      } else {
        loader = await this._createGltfLoader();
      }
      const gltf = await loader.loadAsync(this.bodyUrl);
      try {
        const head = await fetch(this.bodyUrl, { method: "HEAD", cache: "force-cache" });
        const len = head.headers.get("content-length");
        if (len) this._byteLength = Number(len);
      } catch (_) {
        this._byteLength = 360564;
      }
      return gltf;
    }

    async _createGltfLoader() {
      const mod = await import(/* webpackIgnore: true */ "/vendor/GLTFLoader.js");
      const Loader = mod.GLTFLoader || mod.default?.GLTFLoader;
      if (!Loader) throw new Error("GLTFLoader export missing");
      const loader = new Loader();
      try {
        const meshMod = await import(/* webpackIgnore: true */ "/vendor/meshopt_decoder.module.js");
        const decoder =
          meshMod.MeshoptDecoder || meshMod.default?.MeshoptDecoder || meshMod.default;
        if (decoder && typeof loader.setMeshoptDecoder === "function") {
          await Promise.resolve(decoder.ready || Promise.resolve());
          loader.setMeshoptDecoder(decoder);
        }
      } catch (_) {
        /* optional */
      }
      return loader;
    }

    /**
     * Apply the global exterior→canonical conformer to the visible stylized exterior root.
     */
    applyExteriorConformer(exteriorRoot) {
      if (!this.conformer) throw new Error("Conformer not loaded");
      return ExteriorCanonicalConformer.applyExteriorConformer(exteriorRoot, this.conformer);
    }

    resolveCanonicalBounds() {
      if (!this.root) return null;
      const box = new this.THREE.Box3().setFromObject(this.root);
      if (box.isEmpty()) return null;
      const size = new this.THREE.Vector3();
      const center = new this.THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      return {
        min: box.min.toArray(),
        max: box.max.toArray(),
        center: center.toArray(),
        extents: size.toArray()
      };
    }

    /**
     * Convert a world-space hit point into bodyRoot-local canonical meters.
     * @param {import('three').Vector3|{x:number,y:number,z:number}} worldPoint
     */
    worldToCanonicalBody(worldPoint) {
      const bodyRoot = this.scene.bodyRoot;
      bodyRoot.updateMatrixWorld(true);
      const v = worldPoint.clone
        ? worldPoint.clone()
        : new this.THREE.Vector3(worldPoint.x, worldPoint.y, worldPoint.z);
      bodyRoot.worldToLocal(v);
      return { x: v.x, y: v.y, z: v.z };
    }

    /**
     * Project a surface hit into runtime-only canonical coordinates.
     * Strategy D: raw body-local point (exterior already conformed) + optional nearest
     * canonical-surface sample.
     *
     * @param {object} hit Three raycast hit (world point on visible exterior)
     */
    projectHitToCanonical(hit) {
      if (!hit?.point) return null;
      const raw = this.worldToCanonicalBody(hit.point);
      let nearest = null;
      let projectionErrorMeters = null;
      if (this.ready && this.meshes.length) {
        // Nearest in world space, then convert to body-local
        const nearestWorld = ExteriorCanonicalConformer.nearestCanonicalSurfacePoint(
          this.THREE,
          this.meshes,
          hit.point,
          { sampleStride: 12 }
        );
        if (nearestWorld) {
          nearest = this.worldToCanonicalBody(nearestWorld.point);
          projectionErrorMeters = nearestWorld.distanceMeters;
        }
      }
      return {
        canonicalBodyXYZ: nearest || raw,
        rawTransformedPoint: raw,
        nearestCanonicalSurfacePoint: nearest,
        projectionErrorMeters,
        projectionStrategy: nearest ? "D-raw+nearestCanonicalSurface" : "A-bodyLocalAfterGlobalConformer",
        coordinateFrameVersion: this.coordinateFrameVersion,
        canonicalModelId: this.canonicalModelId,
        canonicalModelVersion: this.canonicalModelVersion,
        registrationVersion:
          this.conformer?.registrationVersion || this.conformer?.registrationId || null
      };
    }

    setReferenceVisible(visible, { wireframe = true, opacity = 0.22 } = {}) {
      this.visible = !!visible;
      if (!this.root) return;
      this.root.visible = this.visible;
      for (const mesh of this.meshes) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (!mat) continue;
          mat.wireframe = !!wireframe;
          mat.transparent = true;
          mat.opacity = this.visible ? opacity : 0;
          mat.depthWrite = false;
          mat.needsUpdate = true;
        }
      }
      this.scene.requestFrame?.();
    }

    getAlignmentReport() {
      return this.alignmentReport;
    }

    _disposeGltfScene(scene) {
      if (!scene) return;
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
    }

    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.ready = false;
      if (this.root) {
        this.root.parent?.remove(this.root);
        for (const g of this._ownedGeometries) {
          try {
            g.dispose?.();
          } catch (_) {
            /* ignore */
          }
        }
        for (const m of this._ownedMaterials) {
          try {
            m.dispose?.();
          } catch (_) {
            /* ignore */
          }
        }
        this.root = null;
      }
      this.meshes = [];
      this._ownedGeometries.clear();
      this._ownedMaterials.clear();
      this.scene?.requestFrame?.();
    }
  }

  global.CanonicalBodyFrame = CanonicalBodyFrame;
})(typeof window !== "undefined" ? window : globalThis);
