/**
 * SpatialAnatomyRenderer — CAE spatial display adapter (Phase 2 Slice 1).
 *
 * Contract (duck-typed): mount, render, dispose, setView, resize, setAnnotations
 * Three.js + exterior GLB load only on demand via SpatialManifestLoader.
 * Failures invoke onFallback → plate renderer.
 *
 * Persisted PainRegion fields remain view + anchors + anatomyLayer.
 * Surface attachment is runtime-only (engine.spatialAttachments Map), never written
 * to storage/schema. Switching plate ↔ spatial within a session keeps the Map so
 * remount can re-parent markers by stable meshId; a full page reload intentionally
 * loses 3D metadata.
 */
(function (global) {
  const DRAG_THRESHOLD_PX = 6;

  class SpatialAnatomyRenderer {
    /**
     * @param {object} engine ClinicalAnatomyEngine
     * @param {{ onFallback?: Function }} [options]
     */
    constructor(engine, options = {}) {
      this.engine = engine;
      this.store = engine.markerStore || null;
      this.onFallback = typeof options.onFallback === "function" ? options.onFallback : () => {};
      this.container = null;
      this.mountEl = null;
      this.scene = null;
      this.annotations = null;
      this.layerController = null;
      this.canonicalFrame = null;
      this.canonicalBodyMode = false;
      this.canonicalAlignmentValidation = false;
      this._canonicalPerf = null;
      this.THREE = null;
      this.ready = false;
      this.disposed = false;
      this._regions = [];
      this._selectedIds = new Set();
      /** @type {Map<string, object>} regionId → runtime surface attachment (session) */
      if (!engine.spatialAttachments) engine.spatialAttachments = new Map();
      this._attachments = engine.spatialAttachments;
      /** @type {Map<string, object>} regionId → runtime-only canonical projection (session) */
      if (!engine.spatialCanonicalDebug) engine.spatialCanonicalDebug = new Map();
      this._canonicalDebug = engine.spatialCanonicalDebug;
      this._drag = null;
      this._bound = false;
      this._onStoreChange = null;
      this._mountGeneration = 0;
    }

    async mount(container, options = {}) {
      if (this.disposed) return false;
      this.container = container;
      const generation = ++this._mountGeneration;
      const onProgress =
        typeof options.onProgress === "function" ? options.onProgress : () => {};
      const bootUtils = global.SpatialBootUtils || null;
      const withTimeout =
        bootUtils && bootUtils.withTimeout ? bootUtils.withTimeout : (p) => p;
      const timeouts = (bootUtils && bootUtils.TIMEOUTS) || {};
      const STATES = (bootUtils && bootUtils.BOOT_STATES) || {};
      const setBoot = (state, extra) => {
        if (bootUtils && bootUtils.setBootState) {
          bootUtils.setBootState(this.engine, state, extra);
        }
      };

      try {
        const threeLoader =
          (bootUtils && bootUtils.getGlobal && bootUtils.getGlobal("SpatialThreeLoader")) ||
          global.SpatialThreeLoader ||
          null;
        if (!threeLoader || typeof threeLoader.loadThreeModule !== "function") {
          setBoot(STATES.FAILED_SPATIAL || "failed-spatial", {
            error: "SpatialThreeLoader failed to load (script boot)",
            canonicalStatus: "idle"
          });
          throw new Error("SpatialThreeLoader failed to load (script boot)");
        }

        onProgress("Checking WebGL…");
        const probeOk = threeLoader.isWebGLAvailable();
        setBoot(STATES.LOADING_THREE || "loading-three", {
          webglAvailable: !!probeOk,
          error: null,
          canonicalStatus: "idle"
        });
        // Soft probe only — never block here. Some previews lie; WebGLRenderer is authoritative.
        // Also: never call loseContext during probe (poisons Electron/Cursor WebGL).
        if (!probeOk) {
          onProgress("WebGL probe inconclusive — starting 3D anyway…");
        }

        // Tear down prior mount BEFORE loading Three — teardown clears this.THREE.
        this._teardownMount({ keepAttachments: true });

        onProgress("Loading 3D library…");
        this.THREE = await withTimeout(
          threeLoader.loadThreeModule(),
          timeouts.threeMs || 12000,
          "Three.js"
        );
        if (this.disposed || generation !== this._mountGeneration) return false;
        if (!this.THREE?.WebGLRenderer) {
          throw new Error("Three.js loaded without WebGLRenderer");
        }

        container.classList.add("cae-spatial-active");

        this.mountEl = document.createElement("div");
        this.mountEl.className = "cae-spatial-viewport";
        this.mountEl.dataset.renderer = "spatial";
        // Keep under any loading overlay; revealed when ready.
        this.mountEl.style.visibility = "hidden";
        container.appendChild(this.mountEl);

        const hint = document.createElement("div");
        hint.className = "cae-spatial-hint";
        hint.innerHTML =
          "<span>Drag to rotate · Marks stay on the body surface</span>" +
          "<span class=\"cae-spatial-legend\">" +
          "<i class=\"cae-dot spatial\"></i> Spatial " +
          "<i class=\"cae-dot legacy\"></i> Legacy 2D (snap view only)</span>";
        this.mountEl.appendChild(hint);

        onProgress("Starting 3D scene…");
        setBoot(STATES.STARTING_WEBGL || "starting-webgl", {
          threeRevision: this.THREE.REVISION || null
        });
        const SceneController =
          (bootUtils && bootUtils.getGlobal && bootUtils.getGlobal("SpatialSceneController")) ||
          global.SpatialSceneController;
        if (!SceneController) throw new Error("SpatialSceneController missing");
        try {
          this.scene = new SceneController(this.mountEl, this.THREE);
        } catch (sceneErr) {
          const msg = String(sceneErr?.message || sceneErr || "");
          if (/webgl context|error creating webgl/i.test(msg)) {
            throw new Error("WebGL unavailable");
          }
          throw sceneErr;
        }

        onProgress("Loading body model…");
        setBoot(STATES.LOADING_EXTERIOR || "loading-exterior", {});
        await withTimeout(
          this.scene.loadExteriorBody(),
          timeouts.exteriorMs || 20000,
          "Exterior body"
        );
        if (this.disposed || generation !== this._mountGeneration) {
          this._teardownMount({ keepAttachments: true });
          return false;
        }

        // Interactive ASAP — do not block on canonical BP3D frame (can hang Meshopt).
        const AnnotationLayer =
          (bootUtils && bootUtils.getGlobal && bootUtils.getGlobal("SpatialAnnotationLayer")) ||
          global.SpatialAnnotationLayer;
        if (!AnnotationLayer) throw new Error("SpatialAnnotationLayer missing");
        this.annotations = new AnnotationLayer(this.scene, this.THREE);
        this._bindPointer();
        if (this.store?.onChange) {
          this._onStoreChange = () => {
            if (this.ready && !this.disposed) this._syncFromStore();
          };
          this.store.onChange(this._onStoreChange);
        }
        this.ready = true;
        this.mountEl.style.visibility = "";
        this.scene.fitToBody?.();

        const meshCount = this.scene?.meshById?.size ?? null;
        const exteriorModelId =
          this.scene?.exteriorModelId ||
          this.scene?.modelId ||
          "adult-male";
        const probe = bootUtils && bootUtils.probeWebGL ? bootUtils.probeWebGL() : null;
        setBoot(STATES.READY_SPATIAL || "ready-spatial", {
          exteriorModelId,
          meshCount,
          threeRevision: this.THREE.REVISION || null,
          error: null,
          softwareWebGL: !!(this.scene && this.scene._lowPower) || !!(probe && probe.software),
          gpuRenderer: (probe && probe.renderer) || null
        });

        const view = this.engine.viewType || "front";
        this.scene.snapToView(view, { animate: false });
        this._syncFromStore();

        // Reveal the body now — canonical / clinician packs must not keep the overlay up.
        if (typeof options.onInteractive === "function") {
          try {
            options.onInteractive({ exteriorModelId, meshCount });
          } catch (interactiveErr) {
            console.warn("[CAE Spatial] onInteractive failed", interactiveErr);
          }
        }

        // Canonical frame is enhancement — timeout and continue without it.
        onProgress("Aligning body frame…");
        setBoot(STATES.LOADING_CANONICAL || "loading-canonical", {
          canonicalStatus: "loading"
        });
        try {
          await withTimeout(
            this._initCanonicalFrameIfEnabled(),
            timeouts.canonicalMs || 15000,
            "Canonical body frame"
          );
          if (this.isCanonicalBodyMode()) {
            this.scene.fitToBody?.();
            setBoot(STATES.READY_CANONICAL || "ready-canonical", {
              canonicalStatus: "ready"
            });
          } else {
            setBoot(STATES.CANONICAL_DEGRADED || "canonical-degraded", {
              canonicalStatus: "skipped"
            });
          }
        } catch (canonErr) {
          console.warn(
            "[CAE Spatial] canonical frame skipped after timeout/error — Spatial remains usable",
            canonErr
          );
          setBoot(STATES.CANONICAL_DEGRADED || "canonical-degraded", {
            canonicalStatus: "degraded",
            error: null
          });
        }
        if (this.disposed || generation !== this._mountGeneration) {
          this._teardownMount({ keepAttachments: true });
          return false;
        }

        // Clinician packs after canonical so registration URL matches the live frame.
        this._initLayerController();

        onProgress("Ready");
        if (bootUtils && bootUtils.logDiagnosticsOnce) {
          bootUtils.logDiagnosticsOnce(this.engine);
        }
        return true;
      } catch (err) {
        console.warn("[CAE Spatial] mount failed — falling back to plate renderer", err);
        setBoot(STATES.FAILED_SPATIAL || "failed-spatial", {
          error: err?.message || "mount-failed",
          canonicalStatus: "idle"
        });
        this._teardownMount({ keepAttachments: true });
        this.onFallback(err?.message || "mount-failed", err);
        if (bootUtils && bootUtils.logDiagnosticsOnce) {
          bootUtils.logDiagnosticsOnce(this.engine, { force: true });
        }
        return false;
      }
    }

    async render(container) {
      if (this.ready && this.mountEl && (!container || container === this.container)) {
        this.resize();
        this._syncFromStore();
        return true;
      }
      return this.mount(container || this.container);
    }

    setView(viewType, { animate = true } = {}) {
      if (!this.ready || !this.scene) return;
      const Projection =
        (global.SpatialBootUtils && global.SpatialBootUtils.getGlobal
          ? global.SpatialBootUtils.getGlobal("SpatialProjection")
          : null) || global.SpatialProjection;
      const views = Projection?.SPATIAL_VIEWS || ["front", "back", "left", "right"];
      const view = views.includes(viewType) ? viewType : "front";
      this.scene.snapToView(view, {
        animate: animate && !this.scene.prefersReducedMotion()
      });
      // Keep persisted view + anchors aligned with button snaps (same as drag-snap).
      this._reprojectSpatial(view);
      this._refreshLegacy(view);
    }

    resize() {
      this.scene?.resize?.();
    }

    setAnnotations(regions, selectedIds = []) {
      this._regions = Array.isArray(regions) ? regions : [];
      this._selectedIds = new Set(selectedIds || []);
      if (this.ready) this._reconcile();
    }

    dispose() {
      this.disposed = true;
      this._mountGeneration += 1;
      this._teardownMount({ keepAttachments: true });
    }

    getRuntimeAttachment(regionId) {
      return this._attachments.get(regionId) || null;
    }

    /** Runtime-only canonical projection debug (never persisted). */
    getCanonicalDebug(regionId) {
      return this._canonicalDebug.get(regionId) || null;
    }

    isCanonicalBodyMode() {
      return !!this.canonicalBodyMode && !!this.canonicalFrame?.ready;
    }

    getCanonicalAlignmentReport() {
      return this.canonicalFrame?.getAlignmentReport?.() || null;
    }

    _teardownMount({ keepAttachments = false } = {}) {
      this._unbindPointer();
      if (this._onStoreChange && this.store?.offChange) {
        this.store.offChange(this._onStoreChange);
      }
      this._onStoreChange = null;
      this.layerController?.dispose?.();
      this.layerController = null;
      this.canonicalFrame?.dispose?.();
      this.canonicalFrame = null;
      this.canonicalBodyMode = false;
      this._canonicalPerf = null;
      this._disposeCanonicalValidationHelpers();
      const accordion = document.getElementById("accAnatomyDepth");
      if (accordion) accordion.hidden = true;
      const controls = document.getElementById("clinicianLayerControls");
      if (controls) controls.hidden = true;
      this._updateAnatomyContextPanel(null);
      this.annotations?.dispose?.();
      this.scene?.dispose?.();
      this.annotations = null;
      this.scene = null;
      this.THREE = null;
      this.ready = false;
      this._drag = null;
      this.container?.classList.remove("cae-spatial-active");
      if (this.mountEl) {
        this.mountEl.remove();
        this.mountEl = null;
      }
      // Sweep leftover spatial canvases if container was wiped externally.
      this.container?.querySelectorAll?.(".cae-spatial-viewport, .cae-spatial-canvas")?.forEach((el) => {
        el.remove();
      });
      if (!keepAttachments) {
        this._attachments.clear();
      }
      // Canonical debug is mount-session only — always clear on teardown so remounts
      // cannot leave stale XYZ attached to prior region ids.
      this._canonicalDebug.clear();
    }

    /**
     * Feature-flagged canonical frame: hidden BP3D body + global exterior conformer.
     * Failures fall back to normal Spatial (flag effectively off for this mount).
     */
    async _initCanonicalFrameIfEnabled() {
      this.canonicalBodyMode = false;
      this.canonicalAlignmentValidation = false;
      this.canonicalFrame = null;
      this._canonicalPerf = null;

      if (typeof CanonicalBodyFlag === "undefined") return;
      const enabled = CanonicalBodyFlag.resolveCanonicalBodyMode();
      if (!enabled) return;

      this.canonicalAlignmentValidation =
        CanonicalBodyFlag.resolveCanonicalAlignmentValidation() &&
        this._presentationMode() !== "patient";

      if (
        typeof CanonicalBodyFrame !== "function" ||
        typeof ExteriorCanonicalConformer === "undefined" ||
        typeof CanonicalBodyLoader === "undefined"
      ) {
        console.warn("[CAE Spatial] canonical mode requested but modules missing — continuing without it");
        return;
      }

      const mountToken = this._mountGeneration;
      const t0 =
        typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      let frame = null;
      try {
        frame = new CanonicalBodyFrame(this.THREE, this.scene, { mountToken });
        await frame.load();
        if (this.disposed || mountToken !== this._mountGeneration) {
          frame.dispose();
          return;
        }
        const exteriorRoot = this.scene._exterior?.root;
        if (!exteriorRoot) throw new Error("Exterior root missing for conformer");
        const bak = {
          position: exteriorRoot.position.clone(),
          quaternion: exteriorRoot.quaternion.clone(),
          scale: exteriorRoot.scale.clone()
        };
        try {
          frame.applyExteriorConformer(exteriorRoot);
        } catch (applyErr) {
          exteriorRoot.position.copy(bak.position);
          exteriorRoot.quaternion.copy(bak.quaternion);
          exteriorRoot.scale.copy(bak.scale);
          exteriorRoot.updateMatrixWorld(true);
          throw applyErr;
        }
        if (this.disposed || mountToken !== this._mountGeneration) {
          exteriorRoot.position.copy(bak.position);
          exteriorRoot.quaternion.copy(bak.quaternion);
          exteriorRoot.scale.copy(bak.scale);
          exteriorRoot.updateMatrixWorld(true);
          frame.dispose();
          return;
        }
        this.scene.requestFrame?.();

        this.canonicalFrame = frame;
        this.canonicalBodyMode = true;
        this.scene.fitToBody?.();
        this._canonicalPerf = {
          loadMs: frame.getMeta().loadMs,
          byteLength: frame.getMeta().byteLength,
          fromCache: frame.getMeta().fromCache,
          totalMs:
            (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()) -
            t0
        };

        if (this.canonicalAlignmentValidation) {
          this._enableCanonicalAlignmentValidation();
        } else {
          // Ensure patient / normal clinician never see the registration body.
          frame.setReferenceVisible(false);
        }

        if (typeof console !== "undefined" && console.info) {
          console.info("[CAE Spatial] canonicalBodyMode ON", {
            ...frame.getMeta(),
            perf: this._canonicalPerf,
            alignment: frame.getAlignmentReport()?.status || null
          });
        }
      } catch (err) {
        console.warn(
          "[CAE Spatial] canonical frame failed — continuing in normal Spatial mode",
          err
        );
        const exteriorRoot = this.scene?._exterior?.root;
        if (exteriorRoot && (this.canonicalBodyMode || frame?.conformer)) {
          exteriorRoot.position.set(0, 0, 0);
          exteriorRoot.rotation.set(0, 0, 0);
          exteriorRoot.scale.set(1, 1, 1);
          exteriorRoot.updateMatrixWorld(true);
        }
        try {
          frame?.dispose?.();
        } catch (_) {
          /* ignore */
        }
        this.canonicalFrame = null;
        this.canonicalBodyMode = false;
        this._canonicalDebug.clear();
      }
    }

    _enableCanonicalAlignmentValidation() {
      if (!this.canonicalFrame?.ready) return;
      this.canonicalFrame.setReferenceVisible(true, { wireframe: true, opacity: 0.2 });
      this._disposeCanonicalValidationHelpers();
      const THREE = this.THREE;
      const helpers = new THREE.Group();
      helpers.name = "canonicalAlignmentHelpers";
      const axes = new THREE.AxesHelper(0.35);
      axes.position.set(0, 0.9, 0);
      helpers.add(axes);

      const report = this.canonicalFrame.getAlignmentReport();
      const landmarks = report?.landmarkDistances || [];
      for (const lm of landmarks) {
        const g = new THREE.SphereGeometry(0.012, 10, 8);
        const m = new THREE.MeshBasicMaterial({ color: 0xc45c48 });
        const mesh = new THREE.Mesh(g, m);
        const p = lm.targetMeters || lm.mappedMeters;
        if (!p) continue;
        mesh.position.set(p[0], p[1], p[2]);
        mesh.name = `canonical-landmark-${lm.id}`;
        mesh.raycast = () => {};
        helpers.add(mesh);
      }
      this.scene.bodyRoot.add(helpers);
      this._canonicalValidationHelpers = helpers;
      this.scene.requestFrame?.();
      if (typeof console !== "undefined" && console.info) {
        console.info("[CAE Spatial] canonical-frame alignment report", report);
      }
    }

    _disposeCanonicalValidationHelpers() {
      if (!this._canonicalValidationHelpers) return;
      this._canonicalValidationHelpers.parent?.remove(this._canonicalValidationHelpers);
      this._canonicalValidationHelpers.traverse?.((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
      this._canonicalValidationHelpers = null;
    }

    _bindPointer() {
      if (this._bound || !this.scene) return;
      const el = this.scene.canvas;
      this._onDown = (e) => this._pointerDown(e);
      this._onMove = (e) => this._pointerMove(e);
      this._onUp = (e) => this._pointerUp(e);
      el.addEventListener("pointerdown", this._onDown);
      window.addEventListener("pointermove", this._onMove);
      window.addEventListener("pointerup", this._onUp);
      window.addEventListener("pointercancel", this._onUp);
      this._bound = true;
    }

    _unbindPointer() {
      if (!this._bound) return;
      this.scene?.canvas?.removeEventListener("pointerdown", this._onDown);
      window.removeEventListener("pointermove", this._onMove);
      window.removeEventListener("pointerup", this._onUp);
      window.removeEventListener("pointercancel", this._onUp);
      this._bound = false;
    }

    _pt(e) {
      if (e.touches?.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (e.changedTouches?.length) {
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    }

    _pointerDown(e) {
      if (!this.ready) return;
      if (e.button != null && e.button !== 0) return;
      const p = this._pt(e);
      this._drag = {
        active: true,
        moved: false,
        startX: p.x,
        startY: p.y,
        startYaw: this.scene.getYaw()
      };
      try {
        e.currentTarget?.setPointerCapture?.(e.pointerId);
      } catch (_) { /* ignore */ }
      e.preventDefault?.();
    }

    _pointerMove(e) {
      if (!this._drag?.active) return;
      const p = this._pt(e);
      const dx = p.x - this._drag.startX;
      const dy = p.y - this._drag.startY;
      if (!this._drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        this._drag.moved = true;
      }
      if (this._drag.moved) {
        this.scene.setYawImmediate(this._drag.startYaw + dx * 0.008);
      }
      e.preventDefault?.();
    }

    _pointerUp(e) {
      if (!this._drag?.active) return;
      const drag = this._drag;
      this._drag = null;
      const p = this._pt(e);

      if (drag.moved) {
        const view = SpatialProjection.nearestSnapView(this.scene.getYaw());
        this.scene.snapToView(view, {
          animate: !this.scene.prefersReducedMotion()
        });
        this._applyEngineView(view);
        this._refreshLegacy(view);
        this._reprojectSpatial(view);
        return;
      }
      this._tap(p.x, p.y);
    }

    _applyEngineView(view) {
      this.engine.viewType = view;
      if (global.state) global.state.view = view;
      document
        .querySelectorAll("#viewSelector .view-btn, #quickViewBar .view-btn")
        .forEach((b) => {
          const on = b.dataset.view === view;
          b.classList.toggle("active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
      this.engine.trigger?.("viewchanged", { viewType: view });
    }

    _tap(clientX, clientY) {
      const tool = this.store?.activeTool || "point";

      // Pain markers retain priority over anatomy-structure picking for select/eraser.
      if (tool === "eraser" || tool === "select") {
        const markerId = this._pickMarker(clientX, clientY);
        if (markerId) {
          this.layerController?.clearSelection?.();
          this._updateAnatomyContextPanel(null);
          if (tool === "eraser") {
            this.store.selectRegion?.(markerId);
            this.store.deleteSelectedRegions?.();
            this._attachments.delete(markerId);
            this.annotations.remove(markerId);
            this.engine.trigger?.("regionchanged", {});
            this._syncFromStore();
            return;
          }
          this.store.selectRegion?.(markerId);
          this.engine.trigger?.("regionselected", {
            region: this.store.findRegion?.(markerId)?.region
          });
          this._syncFromStore();
          return;
        }
        if (tool === "select") return;
        return;
      }

      // Clinician layer structure pick (active depth meshes only).
      if (this.layerController && this.layerController.getDepth() !== "surface") {
        // If a pain marker sits under the cursor, do not resolve it as anatomy.
        if (this._pickMarker(clientX, clientY)) {
          this.layerController.clearSelection?.();
          this._updateAnatomyContextPanel(null);
        } else {
          const picked = this.layerController.pickStructure(clientX, clientY);
          if (picked) return;
          // Empty layer click clears selection; still allow exterior pain placement below.
        }
      }

      const hit = this.scene.raycastClient(clientX, clientY);
      if (!hit) return;

      this._place(hit);
    }

    _pickMarker(clientX, clientY) {
      const markers = [...this.annotations._entries.values()].map((e) => e.marker);
      if (!markers.length) return null;
      const rect = this.scene.canvas.getBoundingClientRect();
      const pointer = new this.THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      this.scene.raycaster.setFromCamera(pointer, this.scene.camera);
      const hits = this.scene.raycaster.intersectObjects(markers, true);
      let obj = hits[0]?.object || null;
      while (obj) {
        if (obj.userData?.regionId) return obj.userData.regionId;
        obj = obj.parent;
      }
      return null;
    }

    _place(hit) {
      if (!this.store?.createPointRegion) return;

      const attachment = SpatialProjection.attachmentFromIntersection(this.THREE, hit);
      const view = SpatialProjection.nearestSnapView(this.scene.getYaw());
      this.scene.snapToView(view, { animate: false });
      this._applyEngineView(view);

      const anchors = this.scene.projectWorldToAnchors(hit.point.clone());
      const model =
        typeof normalizeModelType === "function"
          ? normalizeModelType(this.engine.modelType)
          : this.engine.modelType;
      const layer = this.engine.clinicalRenderer?.getActiveAnatomyLayer?.() || "skin";

      const region = this.store.createPointRegion(
        model,
        view,
        anchors.x,
        anchors.y,
        layer,
        !!this.engine.physicianMode
      );
      if (!region) return;

      this._attachments.set(region.id, attachment);

      // Runtime-only canonical projection — never written to PainRegion / storage.
      if (this.canonicalBodyMode && this.canonicalFrame?.ready) {
        const projection = this.canonicalFrame.projectHitToCanonical(hit);
        if (projection) {
          const debug = {
            ...projection,
            regionId: region.id,
            persisted: false,
            note: "runtime-only; PainEntry schema unchanged"
          };
          this._canonicalDebug.set(region.id, debug);
          // Attach parallel debug field on the session attachment map value (not schema).
          attachment.canonicalDebug = debug;
        }
      }

      this.annotations.upsertSpatial(region.id, attachment, { selected: true });
      this.engine.trigger?.("regionplaced", { entry: this.store.getActiveEntry?.() });
      this._syncFromStore();
    }

    _reprojectSpatial(view) {
      // Keep 3D mesh attachments; do NOT rewrite persisted view/anchors.
      // Plate filtering and history depend on the view the mark was placed on.
      if (!this.store) return;
      for (const [regionId, attachment] of this._attachments.entries()) {
        const found = this.store.findRegion?.(regionId);
        const region = found?.region;
        if (!region) continue;
        this.annotations.upsertSpatial(regionId, attachment, {
          selected: this._selectedIds.has(regionId)
        });
      }
      this._refreshLegacy?.(view);
    }

    _syncFromStore() {
      if (!this.store || !this.ready) return;
      const model =
        typeof normalizeModelType === "function"
          ? normalizeModelType(this.engine.modelType)
          : this.engine.modelType;

      const map = new Map();
      const push = (entry) => {
        (entry?.regions || []).forEach((r) => {
          map.set(r.id, { ...r, _entryId: entry.id, _entryIntensity: entry.intensity });
        });
      };
      (this.store.getAllEntries?.(model) || []).forEach(push);
      const active = this.store.getActiveEntry?.();
      if (active) push(active);

      this._regions = [...map.values()];
      this._selectedIds = new Set(this.store.selectedRegionIds || []);
      this._reconcile();
    }

    _reconcile() {
      if (!this.annotations) return;
      const live = new Set(this._regions.map((r) => r.id));
      for (const id of [...this.annotations._entries.keys()]) {
        if (!live.has(id)) {
          this.annotations.remove(id);
          if (!this.store?.findRegion?.(id)) this._attachments.delete(id);
        }
      }
      // Drop session attachments for regions that no longer exist.
      for (const id of [...this._attachments.keys()]) {
        if (!live.has(id) && !this.store?.findRegion?.(id)) this._attachments.delete(id);
      }
      const view = this.engine.viewType || "front";
      for (const region of this._regions) {
        const selected = this._selectedIds.has(region.id);
        const attachment = this._attachments.get(region.id);
        if (attachment) {
          const ok = this.annotations.upsertSpatial(region.id, attachment, { selected });
          if (!ok) {
            // Attachment could not bind after remount — show legacy 2D marker.
            this.annotations.upsertLegacy(region.id, region, view, { selected });
          }
        } else {
          this.annotations.upsertLegacy(region.id, region, view, { selected });
        }
      }
      this.scene.requestFrame();
    }

    _refreshLegacy(view) {
      for (const region of this._regions) {
        if (this._attachments.has(region.id)) continue;
        this.annotations.upsertLegacy(region.id, region, view, {
          selected: this._selectedIds.has(region.id)
        });
      }
    }

    _presentationMode() {
      if (typeof state !== "undefined" && state.presentationMode) {
        return state.presentationMode === "patient" ? "patient" : "clinician";
      }
      if (document.body.classList.contains("shell-patient")) return "patient";
      return "clinician";
    }

    /**
     * Re-bind clinician BP3D layer controls after Patient ↔ Clinician shell switch
     * without tearing down the Spatial scene / canonical frame.
     */
    refreshPresentationShell() {
      if (!this.ready || this.disposed) return;
      const mode = this._presentationMode();
      if (mode === "patient") {
        this.layerController?.dispose?.();
        this.layerController = null;
        const accordion = document.getElementById("accAnatomyDepth");
        if (accordion) accordion.hidden = true;
        const controls = document.getElementById("clinicianLayerControls");
        if (controls) controls.hidden = true;
        this._updateAnatomyContextPanel(null);
        // Keep canonical mesh hidden in patient shell.
        this.canonicalFrame?.setReferenceVisible?.(false);
        this.scene?.requestFrame?.();
        return;
      }
      this._initLayerController();
      this.scene?.requestFrame?.();
    }

    _initLayerController() {
      this.layerController?.dispose?.();
      this.layerController = null;
      if (this._presentationMode() === "patient") return;
      if (typeof SpatialLayerController !== "function") return;

      const params = new URLSearchParams(location.search || "");
      const validationMode = params.get("spatialLayerValidation") === "1";
      const registrationUrl =
        typeof CanonicalBodyFlag !== "undefined"
          ? CanonicalBodyFlag.shoulderRegistrationUrlForMode(this.canonicalBodyMode)
          : undefined;

      this.layerController = new SpatialLayerController(this.scene, this.THREE, {
        presentationMode: this._presentationMode(),
        validationMode,
        canonicalBodyMode: this.canonicalBodyMode,
        registrationUrl,
        onChange: (evt) => this._onLayerChange(evt),
        onError: (err) => this._onLayerError(err)
      });

      const accordion = document.getElementById("accAnatomyDepth");
      if (accordion) accordion.hidden = false;
      const controls = document.getElementById("clinicianLayerControls");
      if (controls) controls.hidden = false;
      this._bindLayerControlUi();
      this._syncLayerControlUi("surface", false);
      this._updateAnatomyContextPanel(null);
    }

    _bindLayerControlUi() {
      if (this._layerUiBound) return;
      this._layerUiBound = true;
      const controls = document.getElementById("clinicianLayerControls");
      controls?.addEventListener("click", (e) => {
        const btn = e.target.closest?.("[data-anatomy-depth]");
        if (!btn) return;
        const depth = btn.getAttribute("data-anatomy-depth");
        if (!depth) return;
        this.setAnatomyDepth(depth);
      });
      document.getElementById("btnClearAnatomySelection")?.addEventListener("click", () => {
        this.layerController?.clearSelection?.();
        this._updateAnatomyContextPanel(null);
      });
    }

    _onLayerChange(evt) {
      this._syncLayerControlUi(evt.depth, !!evt.loading);
      this._updateAnatomyContextPanel(evt.selected || null);
      this.annotations?.setPainMarkerDepthBoost?.(evt.depth !== "surface");
      this.scene?.requestFrame?.();
    }

    _onLayerError(err) {
      console.warn("[CAE Spatial] layer pack failed — reverting to Surface", err);
      const msg =
        err?.code === "REGISTRATION_FAILED"
          ? "Anatomy layer registration failed. Showing surface only."
          : "Anatomy layer unavailable. Showing surface only.";
      const toast = global.showToast || (typeof showToast === "function" ? showToast : null);
      if (typeof toast === "function") toast(msg, { tone: "warning" });
      this._syncLayerControlUi("surface", false);
      this._updateAnatomyContextPanel(null);
      if (this.engine) {
        this.engine.lastLayerFailure = err?.message || err?.code || "layer-load-failed";
      }
    }

    async setAnatomyDepth(depth) {
      if (!this.layerController) return { ok: false, reason: "unavailable" };
      return this.layerController.setDepth(depth);
    }

    getAnatomyDepth() {
      return this.layerController?.getDepth?.() || "surface";
    }

    _syncLayerControlUi(depth, loading = false) {
      const root = document.getElementById("clinicianLayerControls");
      if (!root) return;
      root.dataset.loading = loading ? "true" : "false";
      root.querySelectorAll("[data-anatomy-depth]").forEach((btn) => {
        const on = btn.getAttribute("data-anatomy-depth") === depth;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-checked", on ? "true" : "false");
        btn.disabled = !!loading && !on;
      });
      const live = document.getElementById("clinicianLayerStatus");
      if (live) {
        live.textContent = loading
          ? "Loading anatomy layer…"
          : depth === "surface"
            ? "Surface (styled exterior)"
            : depth === "muscle"
              ? "Muscle (BP3D)"
              : "Skeletal (BP3D)";
      }
    }

    _updateAnatomyContextPanel(selected) {
      const empty = document.getElementById("anatomyContextEmpty");
      const detail = document.getElementById("anatomyContextDetail");
      const nameEl = document.getElementById("anatomyContextName");
      const metaEl = document.getElementById("anatomyContextMeta");
      const clearBtn = document.getElementById("btnClearAnatomySelection");
      if (!detail || !empty) return;

      if (!selected) {
        empty.hidden = false;
        detail.hidden = true;
        if (clearBtn) clearBtn.hidden = true;
        return;
      }

      empty.hidden = true;
      detail.hidden = false;
      if (clearBtn) clearBtn.hidden = false;
      if (nameEl) {
        nameEl.textContent =
          selected.clinicalName || selected.structureName || selected.meshId || "Structure";
      }
      if (metaEl) {
        const bits = [];
        if (selected.structureId) bits.push(selected.structureId);
        if (selected.layer) bits.push(selected.layer);
        if (selected.laterality) bits.push(selected.laterality);
        if (selected.meshId) bits.push(selected.meshId);
        if (selected.sourceRepresentationId) bits.push(selected.sourceRepresentationId);
        metaEl.textContent = bits.join(" · ");
      }
      const announce = document.getElementById("anatomyContextAnnounce");
      if (announce) {
        announce.textContent =
          "Anatomical context: " +
          (selected.clinicalName || selected.structureName || selected.meshId || "");
      }
    }

  }

  global.SpatialAnatomyRenderer = SpatialAnatomyRenderer;
})(typeof window !== "undefined" ? window : globalThis);
