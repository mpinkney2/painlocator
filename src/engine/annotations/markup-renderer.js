/**
 * Clinical Anatomy Markup Renderer — layered overlay stack with normalized coordinates.
 */

function intensityBaseColor(intensity) {
  const colors = typeof PAIN_COLORS !== "undefined" ? PAIN_COLORS : [];
  return colors[Math.max(0, Math.min(10, Math.round(intensity)))] || "#ef4444";
}

function painGradientStops(intensity, opacity) {
  const base = intensityBaseColor(intensity);
  const o = opacity ?? 0.85;
  return `
    <stop offset="0%" stop-color="${base}" stop-opacity="1"/>
    <stop offset="35%" stop-color="${base}" stop-opacity="${o}"/>
    <stop offset="68%" stop-color="${base}" stop-opacity="${Math.min(0.92, o * 0.85)}"/>
    <stop offset="100%" stop-color="${base}" stop-opacity="${Math.min(0.35, o * 0.32)}"/>`;
}

function polygonPoints(anchors) {
  return anchors.map(a => `${a.x},${a.y}`).join(" ");
}

const SIMPLE_MARK_SIZE_KEY = "painlocator_mark_size";
const SIMPLE_MARK_SIZE_SCALES = { s: 0.5, m: 1, l: 1.5 };
const SIMPLE_VIEW_YAW = ["front", "right", "back", "left"];
const SIMPLE_PLATE_CACHE = "spm-mh-sex1";

function getSimpleMarkSizeScale() {
  try {
    const raw = typeof localStorage !== "undefined"
      ? localStorage.getItem(SIMPLE_MARK_SIZE_KEY)
      : null;
    const key = raw === "m" || raw === "l" ? raw : "s";
    return SIMPLE_MARK_SIZE_SCALES[key] || 0.5;
  } catch (_) {
    return 0.5;
  }
}

function setSimpleMarkSizePref(size) {
  const key = size === "m" || size === "l" ? size : "s";
  try {
    localStorage.setItem(SIMPLE_MARK_SIZE_KEY, key);
  } catch (_) { /* ignore */ }
  if (typeof document !== "undefined") {
    document.body?.setAttribute?.("data-mark-size", key);
  }
  return key;
}

function applySimpleMarkSizeAttr() {
  if (typeof document === "undefined") return;
  try {
    const raw = localStorage.getItem(SIMPLE_MARK_SIZE_KEY);
    const key = raw === "m" || raw === "l" ? raw : "s";
    document.body?.setAttribute?.("data-mark-size", key);
  } catch (_) {
    document.body?.setAttribute?.("data-mark-size", "s");
  }
}

/** Shortest turn on the Front → Right → Back → Left compass. 1 = CW, -1 = CCW, 0 = fade. */
function simpleViewTurnDir(fromView, toView) {
  const a = SIMPLE_VIEW_YAW.indexOf(fromView);
  const b = SIMPLE_VIEW_YAW.indexOf(toView);
  if (a < 0 || b < 0 || a === b) return 0;
  const cw = (b - a + SIMPLE_VIEW_YAW.length) % SIMPLE_VIEW_YAW.length;
  if (cw === 2) return 0;
  return cw === 1 ? 1 : -1;
}

function simplePlateSrc(model, view) {
  const path = typeof getAssetPath === "function" ? getAssetPath(model, view) : "";
  return path + "?v=" + SIMPLE_PLATE_CACHE;
}

function setSimplePlateImage(img, path) {
  if (!img || !path) return;
  if (typeof bindPlateImageSrc === "function") bindPlateImageSrc(img, path);
  else img.src = path;
}

class AnatomyImageLayer {
  constructor(root) {
    this.root = root;
    this.el = null;
  }

  mount(parent) {
    this.el = document.createElement("img");
    this.el.className = "cae-anatomy-image";
    this.el.alt = "Clinical Anatomy Plate";
    this.el.draggable = false;
    parent.appendChild(this.el);
    return this.el;
  }

  setSrc(path) {
    if (this.el) this.el.src = path;
  }

  show() { if (this.el) this.el.style.display = "block"; }
  hide() { if (this.el) this.el.style.display = "none"; }
}

class AnatomyLayerOverlay {
  constructor(engine) {
    this.engine = engine;
    this.el = null;
  }

  mount(parent) {
    this.el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.el.setAttribute("class", "cae-layer-overlay");
    this.el.setAttribute("viewBox", "0 0 1 1");
    this.el.setAttribute("preserveAspectRatio", "none");
    parent.appendChild(this.el);
    this.render();
    return this.el;
  }

  render() {
    if (!this.el) return;
    this.el.innerHTML = "";
  }
}

class ReferenceOverlayLayer {
  constructor(engine) {
    this.engine = engine;
    this.el = null;
  }

  mount(parent) {
    this.el = document.createElement("img");
    this.el.className = "cae-reference-overlay";
    this.el.alt = "";
    this.el.draggable = false;
    this.el.hidden = true;
    parent.appendChild(this.el);
    return this.el;
  }

  render() {
    if (!this.el) return;
    const viz = this.engine.visualization || {};
    const path = viz.overlayPath;
    const show = viz.baseMode === "reference" && path;
    if (!show) {
      this.el.hidden = true;
      this.el.removeAttribute("src");
      return;
    }
    this.el.src = path;
    this.el.hidden = false;
  }
}

class PainRegionLayer {
  constructor(engine, store) {
    this.engine = engine;
    this.store = store;
    this.el = null;
    this.group = null;
    this.preview = null;
  }

  mount(parent) {
    this.el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.el.setAttribute("class", "cae-region-layer");
    this.el.setAttribute("viewBox", "0 0 1 1");
    this.el.setAttribute("preserveAspectRatio", "none");
    this.el.innerHTML = `
      <defs>${this.getDefs()}</defs>
      <rect class="cae-hit-surface" x="0" y="0" width="1" height="1" fill="transparent"/>
      <g id="caeRegionsGroup"></g>
      <g id="caeRegionPreview"></g>`;
    parent.appendChild(this.el);
    this.group = this.el.querySelector("#caeRegionsGroup");
    this.preview = this.el.querySelector("#caeRegionPreview");
    return this.el;
  }

  getDefs() {
    return `
      <radialGradient id="pain-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fca5a5" stop-opacity="0.85"/>
        <stop offset="35%" stop-color="#ef4444" stop-opacity="0.55"/>
        <stop offset="70%" stop-color="#b91c1c" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#7f1d1d" stop-opacity="0"/>
      </radialGradient>`;
  }

  render(store, drawPreview = null) {
    if (!this.group) return;
    this.el.querySelectorAll("defs radialGradient[id^='pain-grad-']").forEach(n => n.remove());
    this.group.innerHTML = "";
    const model = normalizeModelType(this.engine.modelType);
    const regions = store.getRegionsForView(model, this.engine.viewType);
    const selected = new Set(store.selectedRegionIds || []);

    regions.forEach(r => {
      this.group.appendChild(this.createRegionEl(r, selected.has(r.id)));
    });

    if (this.preview) {
      this.preview.innerHTML = "";
      if (drawPreview) this.preview.appendChild(this.createPreviewEl(drawPreview));
    }
  }

  createPreviewEl(p) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "pain-region-preview");
    const intensity = this.store.getActiveEntry()?.intensity ?? 5;
    const color = intensityBaseColor(intensity);

    if (p.type === "polygon" && p.vertices?.length) {
      const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      poly.setAttribute("points", polygonPoints(p.vertices));
      poly.setAttribute("fill", color);
      poly.setAttribute("fill-opacity", "0.55");
      poly.setAttribute("stroke", color);
      poly.setAttribute("stroke-width", "0.003");
      poly.setAttribute("stroke-dasharray", "0.008 0.005");
      g.appendChild(poly);
      p.vertices.forEach((v, i) => {
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", String(v.x));
        dot.setAttribute("cy", String(v.y));
        dot.setAttribute("r", i === 0 ? "0.01" : "0.007");
        dot.setAttribute("fill", i === 0 && p.vertices.length >= 3 ? "#22d3ee" : color);
        dot.setAttribute("stroke", "#0f172a");
        dot.setAttribute("stroke-width", "0.002");
        g.appendChild(dot);
      });
      return g;
    }

    const el = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    el.setAttribute("cx", String(p.cx));
    el.setAttribute("cy", String(p.cy));
    el.setAttribute("rx", String(Math.max(p.rx, 0.01)));
    el.setAttribute("ry", String(Math.max(p.ry || p.rx, 0.01)));
    el.setAttribute("fill", color);
    el.setAttribute("fill-opacity", "0.7");
    el.setAttribute("stroke", color);
    el.setAttribute("stroke-width", "0.003");
    el.setAttribute("stroke-dasharray", "0.008 0.005");
    g.appendChild(el);
    return g;
  }

  createRegionEl(region, selected) {
    const intensity = region._entryIntensity ?? 5;
    const simplePatient =
      typeof document !== "undefined" &&
      document.body?.classList?.contains("simple-pain-map");
    // Marker color tracks entry intensity (0–10 scale); prefer stamped color when present.
    const baseColor = region._entryColor || intensityBaseColor(intensity);
    const opacity = simplePatient ? Math.max(0.9, getRegionOpacity(region, intensity)) : getRegionOpacity(region, intensity);
    const c = getRegionCenter(region);
    const isPolygon = region.shape === "polygon" && region.anchors.length >= 3;
    let { rx, ry } = getRegionRadii(region, intensity);
    if (simplePatient) {
      const scale = getSimpleMarkSizeScale();
      const floor = 0.03 * scale;
      rx = Math.max(rx, floor);
      ry = Math.max(ry, floor);
    }
    if (typeof isCircularPainMark === "function" ? isCircularPainMark(region) : !isPolygon) {
      const visualR = Math.max(rx, ry);
      const box = this.el?.getBoundingClientRect?.();
      if (typeof aspectCorrectedCircleRadii === "function" && box && box.width > 1 && box.height > 1) {
        ({ rx, ry } = aspectCorrectedCircleRadii(box.width, box.height, visualR));
      }
    }
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "pain-region"
      + (selected ? " selected" : "")
      + (region._isActiveEntry ? " active-entry" : "")
      + (region._isDraft ? " draft" : ""));
    g.dataset.id = region.id;
    g.dataset.intensity = String(intensity);
    g.dataset.color = baseColor;
    g.style.pointerEvents = "all";
    g.style.cursor = this.store.activeTool === "select" ? "grab" : "crosshair";

    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    const label = this.engine.physicianMode ? (region.physicianLabel || region.patientLabel) : (region.patientLabel || region.physicianLabel);
    title.textContent = `${region._entryLabel || ""} ${label || "Pain"} · ${intensity}/10`;
    g.appendChild(title);

    const gradId = `pain-grad-${region.id}`;
    const defs = this.el.querySelector("defs");
    const grad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
    grad.setAttribute("id", gradId);
    grad.setAttribute("cx", "50%"); grad.setAttribute("cy", "50%"); grad.setAttribute("r", "50%");
    grad.innerHTML = painGradientStops(intensity, opacity);
    defs.appendChild(grad);

    let shape;
    if (isPolygon) {
      shape = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      shape.setAttribute("class", "pain-region-fill");
      shape.setAttribute("points", polygonPoints(region.anchors));
      shape.setAttribute("fill", baseColor);
      shape.setAttribute("fill-opacity", String(Math.min(0.92, opacity + 0.12)));
    } else {
      shape = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      shape.setAttribute("class", "pain-region-fill");
      shape.setAttribute("cx", String(c.x));
      shape.setAttribute("cy", String(c.y));
      shape.setAttribute("rx", String(rx));
      shape.setAttribute("ry", String(ry));
      // Solid intensity color on the patient map (slider-linked); soft gradient elsewhere.
      shape.setAttribute("fill", simplePatient ? baseColor : `url(#${gradId})`);
      if (simplePatient) shape.setAttribute("fill-opacity", "0.95");
    }
    shape.setAttribute("stroke", selected ? "#182a42" : (simplePatient ? "#182a42" : baseColor));
    shape.setAttribute("stroke-opacity", "1");
    shape.setAttribute("stroke-width", selected ? "0.007" : (simplePatient ? "0.005" : "0.002"));
    g.appendChild(shape);

    if (selected && !isPolygon) {
      [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy]) => {
        const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        handle.setAttribute("class", "region-handle");
        handle.setAttribute("data-handle", "resize");
        handle.setAttribute("cx", String(c.x + dx * rx));
        handle.setAttribute("cy", String(c.y + dy * ry));
        handle.setAttribute("r", "0.008");
        handle.setAttribute("fill", "#22d3ee");
        handle.setAttribute("stroke", "#0f172a");
        handle.setAttribute("stroke-width", "0.002");
        g.appendChild(handle);
      });
    }

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const labelX = isPolygon ? c.x : c.x + rx * 0.6;
    const labelY = isPolygon ? c.y : c.y - ry * 0.5;
    text.setAttribute("x", String(labelX));
    text.setAttribute("y", String(labelY));
    text.setAttribute("font-size", "0.028");
    text.setAttribute("fill", "#f8fafc");
    text.setAttribute("stroke", "rgba(15,23,42,0.9)");
    text.setAttribute("stroke-width", "0.003");
    text.setAttribute("paint-order", "stroke");
    text.setAttribute("font-family", "Inter, sans-serif");
    text.setAttribute("font-weight", "700");
    text.textContent = region._entryLabel || "";
    if (this.engine.physicianMode) g.appendChild(text);
    return g;
  }
}

class RegionInteractionLayer {
  constructor(renderer) {
    this.renderer = renderer;
    this.engine = renderer.engine;
    this.store = renderer.store;
    this.svg = null;
    this.mapper = renderer.mapper;
    this.tooltipEl = renderer.tooltip;
    this._mode = null;
    this._dragId = null;
    this._dragKind = null;
    this._start = null;
    this._didDrag = false;
    this._preview = null;
    this._polygonVerts = null;
    this._panOrigin = null;
    this._pointerOrigin = null;
    this._raf = 0;
    this._pendingMove = null;
    this._unbindMoveEnd = null;
  }

  dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  cancelPolygonDraw() {
    this._polygonVerts = null;
    this._mode = null;
    this._preview = null;
    this.renderer.renderRegions();
  }

  finishPolygonDraw() {
    if (!this._polygonVerts || this._polygonVerts.length < 3) {
      this.cancelPolygonDraw();
      return;
    }
    this.store.createPolygonRegion(
      normalizeModelType(this.engine.modelType),
      this.engine.viewType,
      this._polygonVerts,
      this.renderer.getActiveAnatomyLayer(),
      this.engine.physicianMode
    );
    this.engine.trigger("regionplaced", { entry: this.store.getActiveEntry() });
    this._polygonVerts = null;
    this._mode = null;
    this._preview = null;
    this.renderer.renderRegions();
  }

  buildPolygonPreview() {
    return { type: "polygon", vertices: this._polygonVerts || [] };
  }

  clientToNorm(clientX, clientY) {
    if (this.mapper?.frameEl) return this.mapper.clientToNormalized(clientX, clientY);
    return null;
  }

  bind(svg) {
    this.svg = svg;
    if (!svg) return;

    svg.style.touchAction = "none";
    svg.addEventListener("mousedown", (e) => this.onPointerDown(e));
    svg.addEventListener("touchstart", (e) => this.onPointerDown(e), { passive: false });
    svg.addEventListener("dblclick", (e) => {
      if (this.store.activeTool === "polygon" && this._polygonVerts?.length >= 3) {
        e.preventDefault();
        this.finishPolygonDraw();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this._polygonVerts?.length) this.cancelPolygonDraw();
    });
  }

  onPointerDown(e) {
    const pt = e.touches ? e.touches[0] : e;
    if (!this.mapper?.isInsideImage(pt.clientX, pt.clientY) && this.store.activeTool !== "select") {
      return;
    }
    const loc = this.clientToNorm(pt.clientX, pt.clientY);
    if (!loc) return;
    const tool = this.store.activeTool;
    const regionEl = e.target.closest(".pain-region");
    const handle = e.target.closest(".region-handle");

    if (tool === "eraser" && regionEl) {
      e.preventDefault();
      this.store.selectRegion(regionEl.dataset.id);
      this.store.deleteSelectedRegions();
      this.renderer.renderRegions();
      this.engine.trigger("regionchanged", {});
      return;
    }

    if (tool === "select" && handle) {
      e.preventDefault();
      e.stopPropagation();
      this._dragId = regionEl.dataset.id;
      this._dragKind = "resize";
      this._didDrag = false;
      this.bindMoveEnd();
      return;
    }

    if (tool === "select" && regionEl) {
      e.preventDefault();
      e.stopPropagation();
      this.store.selectRegion(regionEl.dataset.id, e.shiftKey);
      this._dragId = regionEl.dataset.id;
      this._dragKind = "move";
      this._start = loc;
      this._didDrag = false;
      this.engine.trigger("regionselected", { region: this.store.findRegion(regionEl.dataset.id)?.region });
      this.renderer.renderRegions();
      this.bindMoveEnd();
      return;
    }

    if (this.renderer.isEnlarged() && !regionEl && (tool === "select" || e.shiftKey || e.altKey)) {
      e.preventDefault();
      this._dragKind = "pan";
      this._didDrag = false;
      this._pointerOrigin = { x: pt.clientX, y: pt.clientY };
      this._panOrigin = { x: this.mapper.panX, y: this.mapper.panY };
      if (tool === "select" && !regionEl) {
        this.store.selectedRegionIds = [];
        this.renderer.renderRegions();
      }
      this.bindMoveEnd();
      return;
    }

    if (tool === "point") {
      e.preventDefault();
      this.store.createPointRegion(
        normalizeModelType(this.engine.modelType),
        this.engine.viewType, loc.x, loc.y,
        this.renderer.getActiveAnatomyLayer(),
        this.engine.physicianMode
      );
      this.engine.trigger("regionplaced", { entry: this.store.getActiveEntry() });
      this.renderer.renderRegions();
      return;
    }

    if (tool === "circle") {
      e.preventDefault();
      this._mode = "circle-draw";
      this._start = loc;
      this._preview = { cx: loc.x, cy: loc.y, rx: 0.02, ry: 0.02 };
      this.renderer.renderRegions(this._preview);
      this.bindMoveEnd();
      return;
    }

    if (tool === "polygon") {
      e.preventDefault();
      if (this._polygonVerts?.length >= 3 && this.dist(loc, this._polygonVerts[0]) < 0.025) {
        this.finishPolygonDraw();
        return;
      }
      if (!this._polygonVerts) this._polygonVerts = [];
      this._polygonVerts.push({ x: loc.x, y: loc.y });
      this._mode = "polygon-draw";
      this.renderer.renderRegions(this.buildPolygonPreview());
      return;
    }

    if (tool === "brush" || tool === "lasso") return;

    if (this.renderer.isEnlarged() && !regionEl) {
      e.preventDefault();
      this._dragKind = "pan";
      this._didDrag = false;
      this._pointerOrigin = { x: pt.clientX, y: pt.clientY };
      this._panOrigin = { x: this.mapper.panX, y: this.mapper.panY };
      this.bindMoveEnd();
      return;
    }

    if (tool === "select" && !regionEl) {
      this.store.selectedRegionIds = [];
      this.renderer.renderRegions();
    }
  }

  applyPendingMove() {
    this._raf = 0;
    const pending = this._pendingMove;
    this._pendingMove = null;
    if (!pending) return;

    if (this._dragKind === "pan" && this._panOrigin && this._pointerOrigin) {
      this.mapper.setPan(
        this._panOrigin.x + (pending.clientX - this._pointerOrigin.x),
        this._panOrigin.y + (pending.clientY - this._pointerOrigin.y)
      );
      this.renderer.syncLayout();
      return;
    }

    const loc = this.clientToNorm(pending.clientX, pending.clientY);
    if (!loc) return;

    if (this._mode === "circle-draw" && this._start) {
      this._preview = {
        cx: this._start.x,
        cy: this._start.y,
        rx: Math.abs(loc.x - this._start.x),
        ry: Math.abs(loc.y - this._start.y)
      };
      this.renderer.renderRegions(this._preview);
      return;
    }

    if (this._dragKind === "move" && this._dragId) {
      this.store.moveRegion(this._dragId, loc.x, loc.y);
      this.renderer.renderRegions();
      return;
    }

    if (this._dragKind === "resize" && this._dragId) {
      this.store.resizeRegion(this._dragId, loc.x, loc.y);
      this.renderer.renderRegions();
    }
  }

  bindMoveEnd() {
    this._unbindMoveEnd?.();

    const move = (ev) => {
      if (ev.cancelable) ev.preventDefault();
      const pt = ev.touches ? ev.touches[0] : ev;
      if (!pt) return;
      this._didDrag = true;
      this._pendingMove = { clientX: pt.clientX, clientY: pt.clientY };
      if (!this._raf) {
        this._raf = requestAnimationFrame(() => this.applyPendingMove());
      }
    };

    const end = (ev) => {
      this._unbindMoveEnd?.();
      this._unbindMoveEnd = null;
      if (this._raf) {
        cancelAnimationFrame(this._raf);
        this._raf = 0;
      }
      if (this._pendingMove) this.applyPendingMove();

      const wasPan = this._dragKind === "pan";

      if (this._mode === "circle-draw" && this._start) {
        const pt = ev.changedTouches ? ev.changedTouches[0] : ev;
        const loc = this.clientToNorm(pt.clientX, pt.clientY);
        if (loc) {
          const endX = this._didDrag ? loc.x : this._start.x;
          const endY = this._didDrag ? loc.y : this._start.y;
          // Tap without drag still places a mark (same as a small Area).
          this.store.createCircleRegion(
            normalizeModelType(this.engine.modelType),
            this.engine.viewType,
            this._start.x, this._start.y, endX, endY,
            this.renderer.getActiveAnatomyLayer(),
            this.engine.physicianMode
          );
          this.engine.trigger("regionplaced", { entry: this.store.getActiveEntry() });
        }
      }

      this._mode = null;
      this._dragId = null;
      this._dragKind = null;
      this._start = null;
      this._preview = null;
      this._panOrigin = null;
      this._pointerOrigin = null;
      this.renderer.renderRegions();
      if (!wasPan) this.engine.trigger("regionchanged", {});
    };

    document.addEventListener("mousemove", move);
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("mouseup", end);
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", end);

    this._unbindMoveEnd = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("mouseup", end);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", end);
    };
  }
}

class ClinicalMarkupRenderer {
  constructor(engine, markerStore) {
    this.engine = engine;
    this.store = markerStore;
    this.loadStatus = "loading";
    this.fallbackActive = false;
    this.mapper = new AnatomyCoordinateMapper(null, null);
    this.layers = {};
    this.viewport = null;
    this.frame = null;
    this.tooltip = null;
    this._boundView = null;
    this._boundModel = null;
    this._onResize = () => {
      this.applySimplePainMapPresentationScale();
      this.syncLayout();
    };
    this._resizeObserver = null;
    this._zoomListeners = [];
    this._spmScaleMode = null;
    this._viewSwapGen = 0;
    this._cancelViewSwap = null;
  }

  _isSimplePainMap() {
    return typeof document !== "undefined"
      && document.body?.classList?.contains("simple-pain-map");
  }

  _simplePlateToken() {
    return this._isSimplePainMap() ? SIMPLE_PLATE_CACHE : String(Date.now());
  }

  preloadSimpleViewPlates() {
    if (!this._isSimplePainMap() || typeof getAssetPath !== "function") return;
    if (typeof Image === "undefined") return;
    const model = this.engine.modelType;
    const skin = typeof getLikenessPref === "function" ? getLikenessPref().skin : "natural";
    ["front", "back", "left", "right"].forEach((view) => {
      const path = simplePlateSrc(model, view);
      const img = new Image();
      img.src = path;
      if (skin !== "natural" && typeof tintPlateSrc === "function") {
        tintPlateSrc(path, skin);
      }
    });
  }

  /**
   * In-place compass turn: keep zoom, crossfade/slide the plate, no remount.
   * @param {string} fromView
   * @param {string} toView
   * @returns {boolean}
   */
  swapSimpleView(fromView, toView) {
    if (!this._isSimplePainMap()) return false;
    if (!this.layers?.image?.el || !this.frame || !this.viewport) return false;
    if (!fromView || fromView === toView) return false;

    this._cancelViewSwap?.();
    const gen = ++this._viewSwapGen;
    this._boundView = toView;
    this._boundModel = this.engine.modelType;
    this.preloadSimpleViewPlates();

    const current = this.layers.image.el;
    current.classList.add("is-view-swap", "is-loaded");
    const incoming = document.createElement("img");
    incoming.className = "cae-anatomy-image is-view-swap is-incoming";
    incoming.alt = "Clinical Anatomy Plate";
    incoming.draggable = false;
    incoming.setAttribute("data-loaded", "1");
    current.insertAdjacentElement("afterend", incoming);

    const dir = simpleViewTurnDir(fromView, toView);
    const reduced = typeof window !== "undefined"
      && window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const frame = this.frame;
    frame.classList.remove("is-turning-cw", "is-turning-ccw", "is-turning-fade");
    frame.classList.add("is-turning");
    if (reduced || dir === 0) frame.classList.add("is-turning-fade");
    else if (dir > 0) frame.classList.add("is-turning-cw");
    else frame.classList.add("is-turning-ccw");

    let finished = false;
    const cleanupFrame = () => {
      frame.classList.remove("is-turning", "is-turning-cw", "is-turning-ccw", "is-turning-fade");
    };

    const finish = () => {
      if (finished || gen !== this._viewSwapGen) return;
      finished = true;
      this._cancelViewSwap = null;
      current.src = incoming.src;
      current.classList.remove("is-out");
      current.classList.add("is-loaded", "is-view-swap");
      incoming.remove();
      cleanupFrame();
      this.layers.image.el = current;
      this.mapper.setElements(this.frame, current);
      this.renderRegions();
      this.syncLayout();
      this.updateDebugLabel();
    };

    this._cancelViewSwap = () => {
      if (finished) return;
      finished = true;
      incoming.remove();
      current.classList.remove("is-out");
      cleanupFrame();
    };

    let started = false;
    const startTurn = () => {
      if (started || gen !== this._viewSwapGen) return;
      started = true;
      incoming.classList.add("is-ready");
      requestAnimationFrame(() => {
        if (gen !== this._viewSwapGen) return;
        incoming.classList.add("is-in");
        current.classList.add("is-out");
        this.renderRegions();
      });
      incoming.addEventListener("transitionend", finish, { once: true });
      setTimeout(finish, reduced ? 80 : 220);
    };

    incoming.onload = () => {
      if (incoming.naturalWidth > 0) startTurn();
    };
    incoming.onerror = () => {
      this._cancelViewSwap?.();
      return false;
    };
    setSimplePlateImage(incoming, simplePlateSrc(this.engine.modelType, toView));
    if (incoming.complete && incoming.naturalWidth > 0) {
      startTurn();
    }
    return true;
  }

  onZoomChange(cb) {
    if (typeof cb === "function") this._zoomListeners.push(cb);
  }

  _emitZoomChange() {
    const payload = { enlarged: this.isEnlarged(), zoom: this.mapper.zoom };
    this._zoomListeners.forEach(cb => {
      try { cb(payload); } catch (_) { /* ignore listener errors */ }
    });
  }

  isEnlarged() {
    return this.mapper.isEnlarged();
  }

  /**
   * Patient simple map: keep the studio figure large in the map view.
   * On wide screens the shell is expanded; add a mild zoom only when
   * letterboxing leaves unused space. Avoid aggressive crop of the head/feet.
   */
  applySimplePainMapPresentationScale() {
    if (typeof document === "undefined") return;
    if (!document.body?.classList?.contains("simple-pain-map")) {
      this._spmScaleMode = null;
      return;
    }
    const wide =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(min-width: 901px)").matches;
    const mode = wide ? "desktop" : "mobile";
    const fit = this.mapper.getFitBounds?.() || null;
    let target = wide
      ? AnatomyCoordinateMapper.SIMPLE_PAIN_MAP_DESKTOP_ZOOM
      : AnatomyCoordinateMapper.SIMPLE_PAIN_MAP_MOBILE_ZOOM;
    if (fit && fit.width > 1 && fit.height > 1) {
      // Studio plates include padding around the person — zoom past letterbox
      // so the human (not the empty plate margin) fills the map stage.
      const widthTarget = (0.98 * fit.containerWidth) / fit.width;
      const heightBudget = wide ? 1.62 : 1.22;
      const heightTarget = (heightBudget * fit.containerHeight) / fit.height;
      if (wide) {
        target = Math.min(widthTarget, heightTarget);
        target = Math.max(1.28, Math.min(target, 1.72));
      } else {
        target = Math.min(widthTarget, heightTarget);
        target = Math.max(1.04, Math.min(target, 1.14));
      }
    }
    if (this._spmScaleMode === mode && Math.abs(this.mapper.zoom - target) < 0.025) {
      return;
    }
    this._spmScaleMode = mode;
    // Bias focus slightly upward so head/torso stay clear of the intensity dock.
    this.mapper.setZoom(target, { focusX: 0.5, focusY: wide ? 0.4 : 0.42, resetPan: true });
    this._emitZoomChange();
  }

  getFocusFromSelection() {
    const ids = this.store?.selectedRegionIds || [];
    if (ids.length) {
      const found = this.store.findRegion(ids[0]);
      if (found?.region && typeof getRegionCenter === "function") {
        return getRegionCenter(found.region);
      }
    }
    const model = typeof normalizeModelType === "function"
      ? normalizeModelType(this.engine.modelType)
      : this.engine.modelType;
    const regions = this.store?.getRegionsForView?.(model, this.engine.viewType) || [];
    if (regions.length && typeof getRegionCenter === "function") {
      const c = getRegionCenter(regions[regions.length - 1]);
      return { x: c.x, y: c.y };
    }
    return { x: 0.5, y: 0.42 };
  }

  /**
   * Enlarge silhouette for precise marking, or return to fit.
   * @param {boolean} [enlarged]
   * @param {{ focusX?: number, focusY?: number }} [focus]
   */
  setEnlarged(enlarged, focus = null) {
    if (enlarged) {
      const c = focus || this.getFocusFromSelection();
      this.mapper.setZoom(AnatomyCoordinateMapper.ENLARGED_ZOOM, {
        focusX: c.x,
        focusY: c.y,
        resetPan: true
      });
    } else {
      this.mapper.resetZoom();
    }
    this.syncLayout();
    this._emitZoomChange();
  }

  toggleEnlarge(focus = null) {
    this.setEnlarged(!this.isEnlarged(), focus);
    return this.isEnlarged();
  }

  render(container) {
    this.fallbackActive = false;
    this.loadStatus = "loading";
    const imgPath = getAssetPath(this.engine.modelType, this.engine.viewType);

    const viewChanged = this._boundView !== this.engine.viewType
      || this._boundModel !== this.engine.modelType;
    if (viewChanged && this._boundView != null && !this._isSimplePainMap()) {
      this.mapper.resetZoom();
      this._spmScaleMode = null;
      this._emitZoomChange();
    }
    this._boundView = this.engine.viewType;
    this._boundModel = this.engine.modelType;
    applySimpleMarkSizeAttr();
    if (typeof applyLikenessPresentation === "function") applyLikenessPresentation();

    this._cancelViewSwap?.();
    this._cancelViewSwap = null;
    this._viewSwapGen += 1;
    window.removeEventListener("resize", this._onResize);
    this._resizeObserver?.disconnect();

    container.innerHTML = `
      <div class="cae-clinical-viewport">
        ${
          typeof document !== "undefined" &&
          document.body?.classList?.contains("simple-pain-map")
            ? `<div class="simple-figure-loading" aria-live="polite">Loading body…</div>`
            : `<svg id="caeTestBodySvg" class="cae-placeholder-body" viewBox="0 0 200 360" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="100" cy="50" rx="22" ry="28" fill="rgba(34,211,238,0.15)" stroke="#22d3ee" stroke-width="2"/>
          <path d="M68 110 C68 110 74 190 76 210 L100 240 L124 210 C126 190 132 110 132 110 Z" fill="rgba(34,211,238,0.15)" stroke="#22d3ee" stroke-width="2"/>
          <text x="100" y="150" fill="#22d3ee" font-size="12" font-weight="800" text-anchor="middle">CAE placeholder body</text>
        </svg>`
        }
        <div class="cae-image-frame" id="caeImageFrame"></div>
        <div class="cae-marker-tooltip" id="caeMarkerTooltip" hidden></div>
      </div>`;

    this.viewport = container.querySelector(".cae-clinical-viewport");
    this.frame = container.querySelector("#caeImageFrame");
    this.tooltip = container.querySelector("#caeMarkerTooltip");

    this.layers.image = new AnatomyImageLayer(this.frame);
    this.layers.overlay = new AnatomyLayerOverlay(this.engine);
    this.layers.reference = new ReferenceOverlayLayer(this.engine);
    this.layers.markers = new PainRegionLayer(this.engine, this.store);
    const img = this.layers.image.mount(this.frame);
    this.layers.overlay.mount(this.frame);
    this.layers.reference.mount(this.frame);
    this.layers.markers.mount(this.frame);
    this.mapper.setElements(this.frame, img);
    this.layers.interaction = new RegionInteractionLayer(this);
    this.layers.interaction.bind(this.layers.markers.el);
    this.applyZoomClasses();

    const placeholder = container.querySelector("#caeTestBodySvg");
    let settled = false;

    const handleLoad = () => {
      if (settled) return;
      settled = true;
      this.loadStatus = "loaded";
      this.fallbackActive = false;
      this.layers.image.show();
      if (placeholder) {
        placeholder.style.display = "none";
        placeholder.setAttribute("hidden", "");
      }
      if (img) {
        img.classList.add("is-loaded");
        img.setAttribute("data-loaded", "1");
      }
      this.viewport?.classList?.add("has-figure");
      container.querySelector(".simple-figure-loading")?.remove();
      requestAnimationFrame(() => {
        this.applySimplePainMapPresentationScale();
        this.syncLayout();
        requestAnimationFrame(() => this.syncLayout());
      });
      this.renderRegions();
      this.applyVisualizationClasses();
      this.injectDebugLabel(container, imgPath);
      this.preloadSimpleViewPlates();
      if (img) img.classList.add("is-view-swap");
    };

    const handleError = () => {
      if (settled) return;
      settled = true;
      this.loadStatus = "failed (fallback active)";
      this.fallbackActive = true;
      this.layers.image.hide();
      const loading = container.querySelector(".simple-figure-loading");
      if (loading) {
        loading.textContent = "Body image unavailable — try Front / Back again.";
      } else if (placeholder) {
        placeholder.style.display = "block";
      }
      this.injectDebugLabel(container, imgPath);
    };

    img.onload = () => (img.naturalWidth > 0 ? handleLoad() : handleError());
    img.onerror = handleError;
    const cacheToken = this._isSimplePainMap()
      ? SIMPLE_PLATE_CACHE
      : String(Date.now());
    const plateSrc = imgPath + "?v=" + cacheToken;
    if (this._isSimplePainMap()) setSimplePlateImage(img, plateSrc);
    else img.src = plateSrc;

    window.addEventListener("resize", this._onResize);
    if (typeof ResizeObserver !== "undefined" && this.viewport) {
      this._resizeObserver = new ResizeObserver(() => {
        this.applySimplePainMapPresentationScale();
        this.syncLayout();
      });
      this._resizeObserver.observe(this.viewport);
    }
    this.injectDebugLabel(container, imgPath);
  }

  syncLayout() {
    if (!this.frame || !this.layers.image?.el) return;
    this.mapper.syncFrameToImage();
    this.applyZoomClasses();
    if (this.layers.overlay) this.layers.overlay.render();
    if (this.layers.reference) this.layers.reference.render();
    this.applyVisualizationClasses();
    this.renderMarkers();
  }

  applyZoomClasses() {
    const viewport = this.viewport;
    if (!viewport) return;
    const enlarged = this.isEnlarged();
    viewport.classList.toggle("cae-enlarged", enlarged);
    viewport.parentElement?.classList.toggle("cae-enlarged", enlarged);
    document.getElementById("avatarWrap")?.classList.toggle("anatomy-enlarged", enlarged);
  }

  applyVisualizationClasses() {
    const viewport = this.viewport;
    if (!viewport) return;
    const viz = this.engine.visualization || {};
    viewport.classList.toggle("viz-heatmap", viz.baseMode === "heatmap");
    viewport.classList.toggle("viz-reference", viz.baseMode === "reference");
    viewport.classList.toggle("viz-standard", viz.baseMode === "standard" || !viz.baseMode);
    this.applyZoomClasses();
  }

  handlePlace() { /* legacy — tools handle placement */ }
  handleSelect(id, additive) {
    this.store.selectRegion(id, additive);
    this.engine.trigger("regionselected", { region: this.store.findRegion(id)?.region, entry: this.store.getActiveEntry() });
    this.renderRegions();
  }
  handleMove() { /* handled in RegionInteractionLayer */ }

  getActiveAnatomyLayer() {
    const l = this.engine.activeLayers || {};
    if (l.skeletal) return "skeleton";
    if (l.muscle) return "muscle";
    if (l.nerve) return "nerve";
    if (l.organ) return "organ";
    return "skin";
  }

  renderRegions(preview) {
    if (this.layers.markers) {
      this.layers.markers.render(this.store, preview);
    }
    if (this.layers.reference) this.layers.reference.render();
    this.applyVisualizationClasses();
  }

  renderMarkers() { this.renderRegions(); }

  injectDebugLabel(container, imgPath) {
    if (!window.DEV_MODE) return;
    container.querySelector("#caeDebugLabel")?.remove();
    const label = document.createElement("div");
    label.id = "caeDebugLabel";
    label.className = "cae-debug-badge show-clinical";
    label.innerHTML = `
      <div><strong>Renderer:</strong> ${this.engine.rendererMode}</div>
      <div><strong>Patient:</strong> ${this.engine.modelType}</div>
      <div><strong>View:</strong> ${this.engine.viewType}</div>
      <div><strong>Asset:</strong> ${imgPath}</div>
      <div><strong>Status:</strong> <span id="caeLoadStatusVal">${this.loadStatus}</span></div>
      <div><strong>Regions:</strong> <span id="caeMarkerCountVal">0</span></div>
      <div><strong>Entries:</strong> <span id="caeEntryCountVal">0</span></div>`;
    container.querySelector(".cae-clinical-viewport").appendChild(label);
  }

  updateDebugLabel() {
    const el = document.getElementById("caeLoadStatusVal");
    if (el) el.textContent = this.loadStatus;
    const model = normalizeModelType(this.engine.modelType);
    const count = document.getElementById("caeMarkerCountVal");
    if (count && this.store) {
      count.textContent = String(this.store.getRegionsForView(model, this.engine.viewType).length);
    }
    const entryCount = document.getElementById("caeEntryCountVal");
    if (entryCount && this.store) {
      entryCount.textContent = String(this.store.getAllEntries(model).length);
    }
  }
}

window.ClinicalMarkupRenderer = ClinicalMarkupRenderer;
window.getSimpleMarkSizeScale = getSimpleMarkSizeScale;
window.setSimpleMarkSizePref = setSimpleMarkSizePref;
window.simpleViewTurnDir = simpleViewTurnDir;
window.SIMPLE_MARK_SIZE_KEY = SIMPLE_MARK_SIZE_KEY;
window.setSimplePlateImage = setSimplePlateImage;
