/**
 * Clinical Anatomy Markup Renderer — layered overlay stack with normalized coordinates.
 */

function intensityBaseColor(intensity) {
  const colors = typeof PAIN_COLORS !== "undefined" ? PAIN_COLORS : [];
  return colors[Math.max(0, Math.min(10, Math.round(intensity)))] || "#ef4444";
}

function painGradientStops(intensity, opacity) {
  const base = intensityBaseColor(intensity);
  const o = opacity ?? 0.7;
  return `
    <stop offset="0%" stop-color="${base}" stop-opacity="${Math.min(1, o + 0.18)}"/>
    <stop offset="40%" stop-color="${base}" stop-opacity="${o}"/>
    <stop offset="72%" stop-color="${base}" stop-opacity="${Math.min(0.85, o * 0.72)}"/>
    <stop offset="100%" stop-color="${base}" stop-opacity="${Math.min(0.2, o * 0.18)}"/>`;
}

function polygonPoints(anchors) {
  return anchors.map(a => `${a.x},${a.y}`).join(" ");
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
    const baseColor = intensityBaseColor(intensity);
    const opacity = getRegionOpacity(region, intensity);
    const c = getRegionCenter(region);
    const isPolygon = region.shape === "polygon" && region.anchors.length >= 3;
    const { rx, ry } = getRegionRadii(region, intensity);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "pain-region"
      + (selected ? " selected" : "")
      + (region._isActiveEntry ? " active-entry" : "")
      + (region._isDraft ? " draft" : ""));
    g.dataset.id = region.id;
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
      shape.setAttribute("fill-opacity", String(Math.min(0.9, opacity + 0.12)));
    } else {
      shape = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      shape.setAttribute("class", "pain-region-fill");
      shape.setAttribute("cx", String(c.x));
      shape.setAttribute("cy", String(c.y));
      shape.setAttribute("rx", String(rx));
      shape.setAttribute("ry", String(ry));
      shape.setAttribute("fill", `url(#${gradId})`);
    }
    shape.setAttribute("stroke", selected ? "#22d3ee" : baseColor);
    shape.setAttribute("stroke-opacity", selected ? "1" : "0.8");
    shape.setAttribute("stroke-width", selected ? "0.004" : "0.002");
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

    if (tool === "select" && !regionEl) {
      this.store.selectedRegionIds = [];
      this.renderer.renderRegions();
    }
  }

  bindMoveEnd() {
    const move = (ev) => {
      const pt = ev.touches ? ev.touches[0] : ev;
      const loc = this.clientToNorm(pt.clientX, pt.clientY);
      if (!loc) return;
      this._didDrag = true;

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
    };

    const end = (ev) => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("mouseup", end);
      document.removeEventListener("touchend", end);

      if (this._mode === "circle-draw" && this._start && this._didDrag) {
        const pt = ev.changedTouches ? ev.changedTouches[0] : ev;
        const loc = this.clientToNorm(pt.clientX, pt.clientY);
        if (loc) {
          this.store.createCircleRegion(
            normalizeModelType(this.engine.modelType),
            this.engine.viewType,
            this._start.x, this._start.y, loc.x, loc.y,
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
      this.renderer.renderRegions();
      this.engine.trigger("regionchanged", {});
    };

    document.addEventListener("mousemove", move);
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("mouseup", end);
    document.addEventListener("touchend", end);
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
    this._onResize = () => this.syncLayout();
    this._resizeObserver = null;
  }

  render(container) {
    this.fallbackActive = false;
    this.loadStatus = "loading";
    const imgPath = getAssetPath(this.engine.modelType, this.engine.viewType);

    window.removeEventListener("resize", this._onResize);
    this._resizeObserver?.disconnect();

    container.innerHTML = `
      <div class="cae-clinical-viewport">
        <svg id="caeTestBodySvg" class="cae-placeholder-body" viewBox="0 0 200 360" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="100" cy="50" rx="22" ry="28" fill="rgba(34,211,238,0.15)" stroke="#22d3ee" stroke-width="2"/>
          <path d="M68 110 C68 110 74 190 76 210 L100 240 L124 210 C126 190 132 110 132 110 Z" fill="rgba(34,211,238,0.15)" stroke="#22d3ee" stroke-width="2"/>
          <text x="100" y="150" fill="#22d3ee" font-size="12" font-weight="800" text-anchor="middle">CAE placeholder body</text>
        </svg>
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

    const placeholder = container.querySelector("#caeTestBodySvg");
    let settled = false;

    const handleLoad = () => {
      if (settled) return;
      settled = true;
      this.loadStatus = "loaded";
      this.fallbackActive = false;
      this.layers.image.show();
      if (placeholder) placeholder.style.display = "none";
      requestAnimationFrame(() => {
        this.syncLayout();
        requestAnimationFrame(() => this.syncLayout());
      });
      this.renderRegions();
      this.applyVisualizationClasses();
      this.injectDebugLabel(container, imgPath);
    };

    const handleError = () => {
      if (settled) return;
      settled = true;
      this.loadStatus = "failed (fallback active)";
      this.fallbackActive = true;
      this.layers.image.hide();
      if (placeholder) placeholder.style.display = "block";
      this.injectDebugLabel(container, imgPath);
    };

    img.onload = () => (img.naturalWidth > 0 ? handleLoad() : handleError());
    img.onerror = handleError;
    img.src = imgPath + "?v=" + Date.now();

    window.addEventListener("resize", this._onResize);
    if (typeof ResizeObserver !== "undefined" && this.viewport) {
      this._resizeObserver = new ResizeObserver(() => this.syncLayout());
      this._resizeObserver.observe(this.viewport);
    }
    this.injectDebugLabel(container, imgPath);
  }

  syncLayout() {
    if (!this.frame || !this.layers.image?.el) return;
    this.mapper.syncFrameToImage();
    if (this.layers.overlay) this.layers.overlay.render();
    if (this.layers.reference) this.layers.reference.render();
    this.applyVisualizationClasses();
    this.renderMarkers();
  }

  applyVisualizationClasses() {
    const viewport = this.viewport;
    if (!viewport) return;
    const viz = this.engine.visualization || {};
    viewport.classList.toggle("viz-heatmap", viz.baseMode === "heatmap");
    viewport.classList.toggle("viz-reference", viz.baseMode === "reference");
    viewport.classList.toggle("viz-standard", viz.baseMode === "standard" || !viz.baseMode);
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
