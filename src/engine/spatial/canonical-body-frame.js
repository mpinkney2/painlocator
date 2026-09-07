/**
 * CanonicalBodyFrame — runtime canonical anatomical frame (Phase 2 Slice 5+).
 *
 * Loads the hidden BP3D registration body only when canonical mode is enabled.
 * Exposes transform helpers and runtime-only canonicalBodyXYZ projection.
 * Visually hidden by default.
 *
 * Ownership: borrows a cloned instance from CanonicalBodyLoader. dispose()
 * detaches and frees instance materials only — never poisons the template cache.
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
      this._fromCache = false;
      this._instance = null;
      this._mountToken = options.mountToken ?? null;
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
        fromCache: this._fromCache,
        loadError: this.loadError ? String(this.loadError.message || this.loadError) : null
      };
    }

    /**
     * Load conformer config + hidden canonical GLB (via session template cache).
     */
    async load() {
      if (this.disposed) throw new Error("CanonicalBodyFrame disposed");
      if (this.ready) return this;
      this.loadError = null;
      const t0 =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();

      try {
        if (typeof CanonicalBodyLoader === "undefined") {
          throw new Error("CanonicalBodyLoader unavailable");
        }
        const hadCache = CanonicalBodyLoader.hasTemplate(this.bodyUrl);
        const [manifest, conformer, template] = await Promise.all([
          CanonicalBodyLoader.loadManifest(this.manifestUrl),
          ExteriorCanonicalConformer.loadConformerConfig(this.conformerUrl),
          CanonicalBodyLoader.loadTemplate(this.THREE, { bodyUrl: this.bodyUrl })
        ]);
        if (this.disposed) {
          throw new Error("CanonicalBodyFrame disposed during load");
        }

        this.manifest = manifest;
        this.conformer = conformer;
        this._fromCache = hadCache;
        if (manifest?.coordinateFrame?.frameId) {
          this.coordinateFrameVersion = manifest.coordinateFrame.frameId;
        }
        if (manifest?.prototypeId) {
          this.canonicalModelVersion = manifest.prototypeId;
        }

        this._instance = CanonicalBodyLoader.borrowInstance(this.THREE, template);
        this.root = new this.THREE.Group();
        this.root.name = "canonicalBodyFrame";
        this.root.userData.canonicalBody = true;
        this.root.userData.coordinateFrameVersion = this.coordinateFrameVersion;
        this.root.visible = false;
        this.root.add(this._instance.root);
        this._byteLength = this._instance.byteLength;

        this.meshes = [];
        this.root.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.userData.canonicalBody = true;
          obj.userData.spatialBody = false;
          obj.raycast = () => {};
          this.meshes.push(obj);
        });

        this.scene.bodyRoot.add(this.root);
        this.root.updateMatrixWorld(true);
        this.bounds = this.resolveCanonicalBounds();
        this.alignmentReport = ExteriorCanonicalConformer.buildAlignmentReport(conformer, {
          loadedAt: new Date().toISOString(),
          bounds: this.bounds,
          fromCache: this._fromCache
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
        // Ensure partial graph is detached so retry on a new instance is clean.
        try {
          if (this._instance) CanonicalBodyLoader.detachInstance(this._instance);
        } catch (_) {
          /* ignore */
        }
        this._instance = null;
        if (this.root) {
          this.root.parent?.remove(this.root);
          this.root = null;
        }
        this.meshes = [];
        throw err;
      }
    }

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
     * Deterministic projection of a body-local exterior point (pre- or post-conformer space)
     * through the loaded conformer matrix. Used for remount stability tests.
     */
    projectExteriorBodyPoint(point, { assumeAlreadyConformed = true } = {}) {
      if (!this.conformer) return null;
      const src = point.clone
        ? { x: point.x, y: point.y, z: point.z }
        : { x: point.x, y: point.y, z: point.z };
      const raw = assumeAlreadyConformed
        ? src
        : ExteriorCanonicalConformer.transformPointByConformer(this.THREE, this.conformer, src);
      return {
        canonicalBodyXYZ: raw,
        rawTransformedPoint: raw,
        nearestCanonicalSurfacePoint: null,
        projectionErrorMeters: null,
        projectionStrategy: assumeAlreadyConformed
          ? "A-bodyLocalAfterGlobalConformer"
          : "A-inverseGlobalTransform",
        coordinateFrameVersion: this.coordinateFrameVersion,
        canonicalModelId: this.canonicalModelId,
        canonicalModelVersion: this.canonicalModelVersion,
        registrationVersion:
          this.conformer?.registrationVersion || this.conformer?.registrationId || null
      };
    }

    projectHitToCanonical(hit) {
      if (!hit?.point) return null;
      const raw = this.worldToCanonicalBody(hit.point);
      let nearest = null;
      let projectionErrorMeters = null;
      if (this.ready && this.meshes.length) {
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

    /**
     * Detach from scene. Does NOT free template geometries (CanonicalBodyLoader cache).
     */
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.ready = false;
      if (this._instance) {
        try {
          CanonicalBodyLoader.detachInstance(this._instance);
        } catch (_) {
          /* ignore */
        }
        this._instance = null;
      }
      if (this.root) {
        this.root.parent?.remove(this.root);
        this.root = null;
      }
      this.meshes = [];
      this.scene?.requestFrame?.();
    }
  }

  /**
   * Pure remount-stability helper: apply conformer TRS to exterior-local points
   * without WebGL. Returns millimeters deltas across repeated applications.
   */
  function projectPointsThroughConformer(conformer, points) {
    const t = conformer.transform;
    const s = t.scale;
    const tr = t.translation;
    const out = {};
    for (const [id, p] of Object.entries(points)) {
      out[id] = {
        x: s * p[0] + tr[0],
        y: s * p[1] + tr[1],
        z: s * p[2] + tr[2]
      };
    }
    return out;
  }

  function xyzDeltaMm(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * 1000;
  }

  global.CanonicalBodyFrame = CanonicalBodyFrame;
  global.CanonicalBodyProjection = {
    projectPointsThroughConformer,
    xyzDeltaMm
  };
})(typeof window !== "undefined" ? window : globalThis);
