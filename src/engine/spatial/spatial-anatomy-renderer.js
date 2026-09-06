/**
 * SpatialAnatomyRenderer — Phase 1 CAE spatial display adapter.
 *
 * Contract (duck-typed): mount, render, dispose, setView, resize, setAnnotations
 * Three.js loads only on demand. Failures invoke onFallback → plate renderer.
 *
 * Persisted PainRegion fields remain view + anchors + anatomyLayer.
 * Surface attachment is runtime-only (engine.spatialAttachments Map), never written
 * to storage/schema. Switching plate ↔ spatial within a session keeps the Map so
 * remount can re-parent markers; a full page reload intentionally loses 3D metadata.
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
      this.THREE = null;
      this.ready = false;
      this.disposed = false;
      this._regions = [];
      this._selectedIds = new Set();
      /** @type {Map<string, object>} regionId → runtime surface attachment (session) */
      if (!engine.spatialAttachments) engine.spatialAttachments = new Map();
      this._attachments = engine.spatialAttachments;
      this._drag = null;
      this._bound = false;
      this._onStoreChange = null;
      this._mountGeneration = 0;
    }

    async mount(container) {
      if (this.disposed) return false;
      this.container = container;
      const generation = ++this._mountGeneration;
      try {
        if (!SpatialThreeLoader.isWebGLAvailable()) {
          throw new Error("WebGL unavailable");
        }
        this.THREE = await SpatialThreeLoader.loadThreeModule();
        if (this.disposed || generation !== this._mountGeneration) return false;

        // Tear down any prior spatial DOM/listeners before remounting.
        this._teardownMount({ keepAttachments: true });

        container.classList.add("cae-spatial-active");

        this.mountEl = document.createElement("div");
        this.mountEl.className = "cae-spatial-viewport";
        this.mountEl.dataset.renderer = "spatial";
        container.appendChild(this.mountEl);

        const hint = document.createElement("div");
        hint.className = "cae-spatial-hint";
        hint.innerHTML =
          "<span>Drag to rotate · Marks stay on the body surface</span>" +
          "<span class=\"cae-spatial-legend\">" +
          "<i class=\"cae-dot spatial\"></i> Spatial " +
          "<i class=\"cae-dot legacy\"></i> Legacy 2D (snap view only)</span>";
        this.mountEl.appendChild(hint);

        this.scene = new SpatialSceneController(this.mountEl, this.THREE);
        this.annotations = new SpatialAnnotationLayer(this.scene, this.THREE);
        this._bindPointer();
        if (this.store?.onChange) {
          this._onStoreChange = () => {
            if (this.ready && !this.disposed) this._syncFromStore();
          };
          this.store.onChange(this._onStoreChange);
        }
        this.ready = true;

        const view = this.engine.viewType || "front";
        this.scene.snapToView(view, { animate: false });
        this._syncFromStore();
        return true;
      } catch (err) {
        console.warn("[CAE Spatial] mount failed — falling back to plate renderer", err);
        this._teardownMount({ keepAttachments: true });
        this.onFallback("mount-failed", err);
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
      const view = SpatialProjection.SPATIAL_VIEWS.includes(viewType) ? viewType : "front";
      this.scene.snapToView(view, {
        animate: animate && !this.scene.prefersReducedMotion()
      });
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

    _teardownMount({ keepAttachments = false } = {}) {
      this._unbindPointer();
      if (this._onStoreChange && this.store?.offChange) {
        this.store.offChange(this._onStoreChange);
      }
      this._onStoreChange = null;
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
      if (!keepAttachments) this._attachments.clear();
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
      const hit = this.scene.raycastClient(clientX, clientY);
      if (!hit) return;

      const tool = this.store?.activeTool || "point";
      if (tool === "eraser") {
        const id = this._pickMarker(clientX, clientY);
        if (id) {
          this.store.selectRegion?.(id);
          this.store.deleteSelectedRegions?.();
          this._attachments.delete(id);
          this.annotations.remove(id);
          this.engine.trigger?.("regionchanged", {});
          this._syncFromStore();
        }
        return;
      }

      if (tool === "select") {
        const id = this._pickMarker(clientX, clientY);
        if (id) {
          this.store.selectRegion?.(id);
          this.engine.trigger?.("regionselected", {
            region: this.store.findRegion?.(id)?.region
          });
          this._syncFromStore();
        }
        return;
      }

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
      const hits = this.scene.raycaster.intersectObjects(markers, false);
      return hits[0]?.object?.userData?.regionId || null;
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
      this.annotations.upsertSpatial(region.id, attachment, { selected: true });
      this.engine.trigger?.("regionplaced", { entry: this.store.getActiveEntry?.() });
      this._syncFromStore();
    }

    _reprojectSpatial(view) {
      if (!this.store) return;
      let changed = false;
      for (const [regionId, attachment] of this._attachments.entries()) {
        const found = this.store.findRegion?.(regionId);
        const region = found?.region;
        if (!region) continue;
        const world = SpatialProjection.resolveAttachmentWorldPoint(
          this.THREE,
          attachment,
          this.scene.meshByUuid
        );
        if (!world) continue;
        const anchors = this.scene.projectWorldToAnchors(world);
        region.view = view;
        region.anchors = [{ x: anchors.x, y: anchors.y }];
        region.updatedAt = new Date().toISOString();
        changed = true;
        this.annotations.upsertSpatial(regionId, attachment, {
          selected: this._selectedIds.has(regionId)
        });
      }
      if (changed) {
        this.store.dirty = true;
        this.store.save?.();
        this.engine.trigger?.("regionchanged", {});
      }
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
        if (attachment) this.annotations.upsertSpatial(region.id, attachment, { selected });
        else this.annotations.upsertLegacy(region.id, region, view, { selected });
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
  }

  global.SpatialAnatomyRenderer = SpatialAnatomyRenderer;
})(window);
