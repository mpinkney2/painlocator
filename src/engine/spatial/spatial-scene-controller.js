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
      if (!THREE?.WebGLRenderer) {
        throw new Error("SpatialSceneController requires a valid Three.js module");
      }
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
      this._ground = null;
      this._lookAtY = 0.95;
      this._lowPower = false;
      this._lastFitSize = { w: 0, h: 0 };

      const boot = global.SpatialBootUtils || null;
      const probe = boot && typeof boot.probeWebGL === "function" ? boot.probeWebGL() : { ok: true, software: false };
      this._lowPower = !!probe.software;

      try {
        this.renderer = new THREE.WebGLRenderer({
          antialias: !this._lowPower,
          alpha: true,
          powerPreference: this._lowPower ? "low-power" : "default",
          failIfMajorPerformanceCaveat: false,
          depth: true,
          stencil: false
        });
      } catch (err) {
        const detail = err?.message || String(err);
        const e = new Error(
          /webgl/i.test(detail) ? "WebGL unavailable" : `WebGLRenderer failed: ${detail}`
        );
        e.cause = err;
        throw e;
      }
      if (!this.renderer) {
        throw new Error("WebGL unavailable");
      }
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      if (!this._lowPower && THREE.ACESFilmicToneMapping != null) {
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.06;
      }
      this.canvas = this.renderer.domElement;
      this.canvas.className = "cae-spatial-canvas";
      this.canvas.setAttribute("role", "img");
      this.canvas.setAttribute("aria-label", "Rotatable spatial body model");
      this.canvas.style.display = "block";
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      mountEl.appendChild(this.canvas);

      const w = Math.max(1, mountEl.clientWidth || 320);
      const h = Math.max(1, mountEl.clientHeight || 480);
      this.camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
      this.camera.position.set(0, 1.0, 4.0);
      this.camera.lookAt(0, this._lookAtY, 0);

      this.scene = new THREE.Scene();
      // Calm clinical lighting — hemisphere fill + soft key/rim. No hard game rims.
      this.scene.add(new THREE.HemisphereLight(0xf6f3ee, 0x8a93a2, 0.82));
      const key = new THREE.DirectionalLight(0xfff7f0, 0.58);
      key.position.set(1.8, 3.4, 2.6);
      this.scene.add(key);
      const rim = new THREE.DirectionalLight(0xd5e2f2, 0.26);
      rim.position.set(-2.4, 1.2, -2.1);
      this.scene.add(rim);

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
      this._ground = ground;
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

      this.fitToBody();
      this.requestFrame();
      return exterior;
    }

    /**
     * Frame the loaded exterior in the camera and park the ground at the feet.
     * Yaw still happens on bodyRoot — camera stays on +Z looking at the visual mid-mass.
     */
    fitToBody({ padding = 1.16 } = {}) {
      if (this.disposed || !this.camera) return null;
      const THREE = this.THREE;
      const target = this._exterior?.root || this.bodyRoot;
      if (!target || !THREE?.Box3) return null;
      target.updateMatrixWorld(true);
      const box = (typeof metahumanBodyBox === "function")
        ? metahumanBodyBox(THREE, target)
        : new THREE.Box3().setFromObject(target);
      if (box.isEmpty()) return null;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const Projection =
        (typeof SpatialProjection !== "undefined" && SpatialProjection) ||
        global.SpatialProjection;
      const dist = Projection?.cameraDistanceForBounds
        ? Projection.cameraDistanceForBounds(
            { x: size.x, y: size.y, z: size.z },
            this.camera.fov,
            this.camera.aspect,
            padding
          )
        : Math.max(3.2, size.y * 2.2);
      this._lookAtY = center.y;
      this.camera.position.set(0, center.y, dist);
      this.camera.near = Math.max(0.05, dist / 50);
      this.camera.far = Math.max(40, dist * 8);
      this.camera.lookAt(0, center.y, 0);
      this.camera.updateProjectionMatrix();
      if (this._ground) {
        this._ground.position.y = box.min.y;
        const radius = Math.max(size.x, size.z, 0.4) * 0.62;
        this._ground.scale.setScalar(Math.max(0.35, radius / 0.55));
      }
      this.requestFrame();
      return { center: center.toArray(), size: size.toArray(), distance: dist };
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
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      const sizeChanged =
        Math.abs(w - this._lastFitSize.w) > 2 || Math.abs(h - this._lastFitSize.h) > 2;
      if (this._exterior && sizeChanged) {
        this._lastFitSize = { w, h };
        this.fitToBody();
      }
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
      // Never forceContextLoss / loseContext — that poisons the next WebGLRenderer
      // in Electron, Cursor Simple Browser, and some embedded previews (Retry 3D).
      this.renderer.dispose();
      this._ground = null;
      this.canvas?.remove();
      this.canvas = null;
      this.raycastMeshes = [];
      this.meshByUuid.clear();
      this.meshById.clear();
    }
  }

  global.SpatialSceneController = SpatialSceneController;
})(typeof window !== "undefined" ? window : globalThis);
