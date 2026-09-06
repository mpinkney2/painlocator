/**
 * Three.js scene graph for Spatial anatomy (Phase 2 Slice 1).
 * Exterior body loads from Spatial Manifest + GLB (not procedural placeholder).
 */
(function (global) {
  const MAX_DPR = 2;
  const MOBILE_DPR = 1.5;

  class SpatialSceneController {
    /**
     * @param {HTMLElement} mountEl
     * @param {typeof import("three")} THREE
     */
    constructor(mountEl, THREE) {
      this.THREE = THREE;
      this.mountEl = mountEl;
      this.disposed = false;
      this._raf = 0;
      this._needsFrame = true;
      this._yaw = 0;
      this._targetYaw = 0;
      this._snapping = false;
      this._exterior = null;
      this.modelId = null;
      this.provenance = null;

      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "default"
      });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.canvas = this.renderer.domElement;
      this.canvas.className = "cae-spatial-canvas";
      this.canvas.setAttribute("role", "img");
      this.canvas.setAttribute("aria-label", "Rotatable spatial body model");
      mountEl.appendChild(this.canvas);

      const w = Math.max(1, mountEl.clientWidth || 320);
      const h = Math.max(1, mountEl.clientHeight || 480);
      this.camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
      this.camera.position.set(0, 1.0, 4.0);
      this.camera.lookAt(0, 0.95, 0);

      this.scene = new THREE.Scene();
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.72));
      const key = new THREE.DirectionalLight(0xffffff, 0.85);
      key.position.set(2.5, 4, 3);
      this.scene.add(key);
      const fill = new THREE.DirectionalLight(0xa8c4ff, 0.35);
      fill.position.set(-3, 1, -2);
      this.scene.add(fill);

      this.bodyRoot = new THREE.Group();
      this.bodyRoot.name = "spatialBodyRoot";
      this.scene.add(this.bodyRoot);

      this.markerRoot = new THREE.Group();
      this.markerRoot.name = "spatialMarkerRoot";
      this.bodyRoot.add(this.markerRoot);

      this.raycastMeshes = [];
      this.meshByUuid = new Map();
      /** @type {Map<string, import('three').Mesh>} stable meshId → Mesh */
      this.meshById = new Map();
      /** Alias for remount: meshId / mesh.name → Mesh */
      this.meshByName = this.meshById;

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(0.55, 32),
        new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.12 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0;
      ground.name = "ground";
      ground.raycast = () => {};
      this.scene.add(ground);

      this.raycaster = new THREE.Raycaster();
      this._pointer = new THREE.Vector2();

      this._onResize = () => this.resize();
      this._ro =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(() => this.resize())
          : null;
      this._ro?.observe(mountEl);
      window.addEventListener("resize", this._onResize);

      this._mq = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
      this._reduceMotion = !!this._mq?.matches;
      this._onMotion = () => {
        this._reduceMotion = !!this._mq?.matches;
      };
      this._mq?.addEventListener?.("change", this._onMotion);

      this._tick = this._tick.bind(this);
      this.resize();
      this.requestFrame();
      this._raf = requestAnimationFrame(this._tick);
    }

    prefersReducedMotion() {
      return this._reduceMotion;
    }

    /**
     * Lazy-load catalog + exterior GLB via SpatialManifestLoader.
     * Must succeed before the scene is considered ready for interaction.
     */
    async loadExteriorBody(modelId) {
      if (this.disposed) throw new Error("Scene disposed");
      if (typeof SpatialManifestLoader !== "function") {
        throw new Error("SpatialManifestLoader unavailable");
      }

      const loader = new SpatialManifestLoader();
      const exterior = await loader.loadExteriorSurface(this.THREE, modelId);
      if (this.disposed) {
        exterior.dispose?.();
        throw new Error("Scene disposed during exterior load");
      }

      this._clearBodyMeshes();
      this._exterior = exterior;
      this.modelId = exterior.modelId;
      this.provenance = exterior.provenance;

      this.bodyRoot.add(exterior.root);
      for (const [meshId, mesh] of exterior.meshById) {
        this.raycastMeshes.push(mesh);
        this.meshByUuid.set(mesh.uuid, mesh);
        this.meshById.set(meshId, mesh);
      }

      this.requestFrame();
      return exterior;
    }

    _clearBodyMeshes() {
      if (this._exterior) {
        this._exterior.root?.parent?.remove(this._exterior.root);
        this._exterior.dispose?.();
        this._exterior = null;
      }
      this.raycastMeshes = [];
      this.meshByUuid.clear();
      this.meshById.clear();
    }

    getYaw() {
      return this._yaw;
    }

    setYawImmediate(yaw) {
      this._yaw = SpatialProjection.normalizeYaw(yaw);
      this._targetYaw = this._yaw;
      this._snapping = false;
      this.bodyRoot.rotation.y = this._yaw;
      this.requestFrame();
    }

    snapToView(view, { animate = true } = {}) {
      const target = SpatialProjection.yawForView(view);
      this._targetYaw = target;
      if (!animate || this._reduceMotion) {
        this.setYawImmediate(target);
        return;
      }
      this._snapping = true;
      this.requestFrame();
    }

    requestFrame() {
      this._needsFrame = true;
    }

    resize() {
      if (this.disposed || !this.mountEl) return;
      const w = Math.max(1, this.mountEl.clientWidth || 1);
      const h = Math.max(1, this.mountEl.clientHeight || 1);
      const isMobile = window.matchMedia?.("(max-width: 900px)")?.matches;
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? MOBILE_DPR : MAX_DPR);
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.requestFrame();
    }

    _tick() {
      if (this.disposed) return;

      if (this._snapping) {
        const delta = SpatialProjection.normalizeYaw(this._targetYaw - this._yaw);
        if (Math.abs(delta) < 0.004) {
          this.setYawImmediate(this._targetYaw);
        } else {
          this._yaw = SpatialProjection.normalizeYaw(this._yaw + delta * 0.22);
          this.bodyRoot.rotation.y = this._yaw;
          this._needsFrame = true;
        }
      }

      if (this._needsFrame) {
        this.renderer.render(this.scene, this.camera);
        if (!this._snapping) this._needsFrame = false;
      }

      if (this.disposed) return;
      this._raf = requestAnimationFrame(this._tick);
    }

    raycastClient(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      this._pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this._pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this._pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.raycastMeshes, false);
      return hits[0] || null;
    }

    projectWorldToAnchors(worldPoint) {
      this.camera.updateMatrixWorld(true);
      return SpatialProjection.worldToNormalizedAnchors(this.THREE, this.camera, worldPoint);
    }

    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      cancelAnimationFrame(this._raf);
      this._raf = 0;
      window.removeEventListener("resize", this._onResize);
      this._mq?.removeEventListener?.("change", this._onMotion);
      this._ro?.disconnect();
      this._ro = null;
      this._clearBodyMeshes();
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
      try {
        this.renderer.forceContextLoss?.();
      } catch (_) { /* ignore */ }
      this.renderer.dispose();
      this.canvas?.remove();
      this.canvas = null;
      this.raycastMeshes = [];
      this.meshByUuid.clear();
      this.meshById.clear();
    }
  }

  global.SpatialSceneController = SpatialSceneController;
})(window);
