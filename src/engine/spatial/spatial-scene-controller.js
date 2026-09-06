/**
 * Three.js scene graph for Phase 1 spatial anatomy.
 * Placeholder body is procedural (public/anatomy/spatial/LICENSE.md).
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
      this.camera.position.set(0, 1.0, 4.2);
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
      this.meshByName = new Map();
      this._buildPlaceholderBody();

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

    _buildPlaceholderBody() {
      const THREE = this.THREE;
      const skin = new THREE.MeshStandardMaterial({
        color: 0xb8c0cc,
        roughness: 0.65,
        metalness: 0.05
      });
      const accent = new THREE.MeshStandardMaterial({
        color: 0x8e9aab,
        roughness: 0.7,
        metalness: 0.04
      });

      const add = (mesh, name) => {
        mesh.name = name;
        mesh.userData.spatialBody = true;
        this.bodyRoot.add(mesh);
        this.raycastMeshes.push(mesh);
        this.meshByUuid.set(mesh.uuid, mesh);
        if (name) this.meshByName.set(name, mesh);
        return mesh;
      };

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), skin);
      head.position.set(0, 1.72, 0);
      add(head, "head");

      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 16), accent);
      neck.position.set(0, 1.52, 0);
      add(neck, "neck");

      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 8, 16), skin);
      torso.position.set(0, 1.12, 0);
      add(torso, "torso");

      const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), accent);
      pelvis.scale.set(1.15, 0.7, 0.9);
      pelvis.position.set(0, 0.72, 0);
      add(pelvis, "pelvis");

      const makeLimb = (name, x, y, len, radius) => {
        const limb = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len, 6, 12), skin);
        limb.position.set(x, y, 0);
        add(limb, name);
      };

      makeLimb("armL", -0.42, 1.18, 0.45, 0.065);
      makeLimb("armR", 0.42, 1.18, 0.45, 0.065);
      const handL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), accent);
      handL.position.set(-0.42, 0.86, 0);
      add(handL, "handL");
      const handR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), accent);
      handR.position.set(0.42, 0.86, 0);
      add(handR, "handR");

      makeLimb("legL", -0.14, 0.32, 0.55, 0.09);
      makeLimb("legR", 0.14, 0.32, 0.55, 0.09);
      const footL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.22), accent);
      footL.position.set(-0.14, 0.02, 0.04);
      add(footL, "footL");
      const footR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.22), accent);
      footR.position.set(0.14, 0.02, 0.04);
      add(footR, "footR");

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(0.7, 32),
        new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.15 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0;
      ground.name = "ground";
      this.scene.add(ground);
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

      // Schedule next frame only if still alive (avoids orphaned rAF after dispose).
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
      this.meshByName.clear();
    }
  }

  global.SpatialSceneController = SpatialSceneController;
})(window);
