/**
 * Maps pointer events to normalized anatomy coordinates (0–1).
 * Owns letterbox fit, enlarge/zoom, and pan so image + SVG overlays stay locked.
 */

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

class AnatomyCoordinateMapper {
  static ENLARGED_ZOOM = 1.85;
  /** Simple map always letterboxes the full plate (no crop). */
  static SIMPLE_PAIN_MAP_DESKTOP_ZOOM = 1;
  /** Simple map always letterboxes the full plate (no crop). */
  static SIMPLE_PAIN_MAP_MOBILE_ZOOM = 1;

  constructor(frameEl, imageEl) {
    this.frameEl = frameEl;
    this.imageEl = imageEl;
    /** @type {number} 1 = fit-to-viewport; >1 enlarges silhouette for accuracy */
    this.zoom = 1;
    /** Normalized focus point kept near viewport center when enlarged */
    this.focusX = 0.5;
    this.focusY = 0.42;
    /** Extra pan in CSS pixels after focus centering */
    this.panX = 0;
    this.panY = 0;
  }

  setElements(frameEl, imageEl) {
    this.frameEl = frameEl;
    this.imageEl = imageEl;
  }

  isEnlarged() {
    return this.zoom > 1.001;
  }

  resetZoom() {
    this.zoom = 1;
    this.focusX = 0.5;
    this.focusY = 0.42;
    this.panX = 0;
    this.panY = 0;
  }

  /**
   * @param {number} zoom
   * @param {{ focusX?: number, focusY?: number, resetPan?: boolean }} [opts]
   */
  setZoom(zoom, opts = {}) {
    const next = Math.max(1, Math.min(3, zoom));
    this.zoom = next;
    if (opts.focusX != null) this.focusX = clamp01(opts.focusX);
    if (opts.focusY != null) this.focusY = clamp01(opts.focusY);
    if (opts.resetPan !== false) {
      this.panX = 0;
      this.panY = 0;
    }
    if (next <= 1.001) this.resetZoom();
  }

  setPan(panX, panY) {
    this.panX = panX;
    this.panY = panY;
    this.clampPan();
  }

  getFitBounds() {
    const container = this.frameEl?.parentElement;
    const frameW = container?.clientWidth || 1;
    const frameH = container?.clientHeight || 1;
    const img = this.imageEl;
    const naturalW = img?.naturalWidth || 1;
    const naturalH = img?.naturalHeight || 1;
    const scale = Math.min(frameW / naturalW, frameH / naturalH);
    const displayW = naturalW * scale;
    const displayH = naturalH * scale;
    return {
      left: (frameW - displayW) / 2,
      top: (frameH - displayH) / 2,
      width: displayW,
      height: displayH,
      scale,
      containerWidth: frameW,
      containerHeight: frameH
    };
  }

  getImageBounds() {
    const fit = this.getFitBounds();
    if (!this.isEnlarged()) return fit;

    const width = fit.width * this.zoom;
    const height = fit.height * this.zoom;
    let left = fit.containerWidth / 2 - this.focusX * width + this.panX;
    let top = fit.containerHeight / 2 - this.focusY * height + this.panY;

    left = this._clampAxis(left, width, fit.containerWidth);
    top = this._clampAxis(top, height, fit.containerHeight);

    return {
      left,
      top,
      width,
      height,
      scale: fit.scale * this.zoom,
      containerWidth: fit.containerWidth,
      containerHeight: fit.containerHeight
    };
  }

  _clampAxis(pos, size, containerSize) {
    if (size <= containerSize) {
      return (containerSize - size) / 2;
    }
    const min = containerSize - size;
    return clamp(pos, min, 0);
  }

  clampPan() {
    if (!this.isEnlarged()) {
      this.panX = 0;
      this.panY = 0;
      return;
    }
    const fit = this.getFitBounds();
    const width = fit.width * this.zoom;
    const height = fit.height * this.zoom;
    const idealLeft = fit.containerWidth / 2 - this.focusX * width;
    const idealTop = fit.containerHeight / 2 - this.focusY * height;
    const clampedLeft = this._clampAxis(idealLeft + this.panX, width, fit.containerWidth);
    const clampedTop = this._clampAxis(idealTop + this.panY, height, fit.containerHeight);
    this.panX = clampedLeft - idealLeft;
    this.panY = clampedTop - idealTop;
  }

  syncFrameToImage() {
    if (!this.frameEl) return;
    this.clampPan();
    const b = this.getImageBounds();
    const frame = this.frameEl;
    // First layout: snap without transition so the figure does not jump from 0,0.
    if (!frame.dataset.spmLaidOut) {
      frame.style.transition = "none";
      frame.style.width = `${b.width}px`;
      frame.style.height = `${b.height}px`;
      frame.style.left = `${b.left}px`;
      frame.style.top = `${b.top}px`;
      // Force reflow, then allow progressive transitions.
      void frame.offsetWidth;
      frame.style.transition = "";
      frame.dataset.spmLaidOut = "1";
      return;
    }
    frame.style.width = `${b.width}px`;
    frame.style.height = `${b.height}px`;
    frame.style.left = `${b.left}px`;
    frame.style.top = `${b.top}px`;
  }

  /**
   * Bitmap rectangle actually painted by the plate image.
   * object-fit contain/cover and object-position are included so a tap
   * maps to the picture, not the letterbox margin around it.
   */
  getVisibleImageRect() {
    const img = this.imageEl;
    const frame = this.frameEl;
    const basis = (img && typeof img.getBoundingClientRect === "function")
      ? img.getBoundingClientRect()
      : (frame && typeof frame.getBoundingClientRect === "function"
        ? frame.getBoundingClientRect()
        : null);
    if (!basis || !basis.width || !basis.height) {
      return { left: 0, top: 0, width: 1, height: 1 };
    }
    const nw = img?.naturalWidth || 0;
    const nh = img?.naturalHeight || 0;
    if (!nw || !nh || typeof window === "undefined" || !window.getComputedStyle || !img) {
      return basis;
    }
    let fit = "fill";
    let posX = 0.5;
    let posY = 0.5;
    try {
      const cs = window.getComputedStyle(img);
      fit = String(cs.objectFit || "fill").toLowerCase();
      const parts = String(cs.objectPosition || "50% 50%").trim().split(/\s+/);
      const parse = (token, size) => {
        if (!token) return 0.5;
        if (token.endsWith("%")) return (parseFloat(token) || 0) / 100;
        if (token === "left" || token === "top") return 0;
        if (token === "right" || token === "bottom") return 1;
        if (token === "center") return 0.5;
        const px = parseFloat(token);
        return Number.isFinite(px) ? px / (size || 1) : 0.5;
      };
      posX = parse(parts[0], basis.width);
      posY = parse(parts[1] || "50%", basis.height);
    } catch (_) { /* use the element box */ }
    if (fit === "fill" || fit === "none") return basis;
    const scale = fit === "cover"
      ? Math.max(basis.width / nw, basis.height / nh)
      : Math.min(basis.width / nw, basis.height / nh);
    const width = nw * scale;
    const height = nh * scale;
    return {
      left: basis.left + (basis.width - width) * posX,
      top: basis.top + (basis.height - height) * posY,
      width,
      height
    };
  }

  clientToNormalizedRaw(clientX, clientY) {
    const rect = this.getVisibleImageRect();
    const x = (clientX - rect.left) / (rect.width || 1);
    const y = (clientY - rect.top) / (rect.height || 1);
    return { x, y };
  }

  clientToNormalized(clientX, clientY) {
    const n = this.clientToNormalizedRaw(clientX, clientY);
    return { x: clamp01(n.x), y: clamp01(n.y) };
  }

  isInsideImage(clientX, clientY) {
    const n = this.clientToNormalizedRaw(clientX, clientY);
    return n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1;
  }
}

window.AnatomyCoordinateMapper = AnatomyCoordinateMapper;
