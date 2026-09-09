/**
 * Clinical Anatomy Engine (CAE)
 * Standalone anatomy visualization library.
 */

class ClinicalAnatomyEngine {
  constructor(container, config = {}) {
    if (!container) {
      throw new Error("ClinicalAnatomyEngine: Container element is required.");
    }
    this.container = container;

    // Component configurations
    this.modelType = config.modelType || "male";
    this.viewType = config.viewType || "front";
    this.detailLevel = config.detailLevel || "professional";
    this.painStyle = config.painStyle || "heatmap";
    this.physicianMode = config.physicianMode || false;
    this.rendererMode = config.rendererMode || "clinical";
    this.accessibility = config.accessibility || { colorblind: false, contrast: false, targets: false };
    
    this.activeLayers = config.activeLayers || {
      skin: true,
      muscle: false,
      skeletal: false,
      nerve: false,
      organ: false,
      vessel: false,
      lymphatic: false
    };

    this.visualization = config.visualization || {
      baseMode: "standard",
      referenceOverlay: "none",
      aiOverlays: {},
      availableOverlays: [],
      overlayPath: null
    };

    // Data structures
    this.pins = [];
    this.pendingPin = null;
    this.draggingPinId = null;

    // Callbacks
    this.callbacks = {
      pinadded: [],
      pindragged: [],
      pinselected: [],
      markerplaced: [],
      markerselected: [],
      markermoved: [],
      regionplaced: [],
      regionselected: [],
      regionchanged: [],
      displaymodechanged: [],
      viewchanged: []
    };

    this.markerStore = config.markerStore || null;

    if (window.ClinicalMarkupRenderer && this.markerStore) {
      this.clinicalRenderer = new ClinicalMarkupRenderer(this, this.markerStore);
    } else {
      this.clinicalRenderer = new ClinicalAnatomyRenderer(this);
    }
    this.prototypeRenderer = new PrototypeBodyRenderer(this);

    /** @type {"plate"|"spatial"|"spatial-loading"|"spatial-unavailable"} */
    this.displayMode = config.displayMode === "spatial" ? "spatial" : "plate";
    this.spatialRenderer = null;
    /** Monotonic token so overlapping plate↔spatial switches discard stale work */
    this._displayModeToken = 0;
    /** Runtime-only 3D surface attachments (not persisted / not schema) */
    this.spatialAttachments = new Map();
    /** Last Spatial failure reason (for status UI) */
    this.lastSpatialFailure = null;
    /** Last clinician layer failure (does not fail Spatial) */
    this.lastLayerFailure = null;
    /** Ephemeral Spatial boot state machine (not persisted) */
    this.spatialBootState =
      (typeof window !== "undefined" &&
        window.SpatialBootUtils &&
        window.SpatialBootUtils.createBootState &&
        window.SpatialBootUtils.createBootState()) ||
      { state: "idle", stage: "idle", error: null, timestamp: Date.now(), canonicalStatus: "idle" };
    /**
     * When true, Spatial failures show an unavailable panel instead of the plate PNG.
     * Product Spatial-primary locate uses this so the 2D image is not the default UI.
     */
    this.spatialPrimaryNoPlate = !!config.spatialPrimaryNoPlate;

    this.initDOM();
    if (this.displayMode === "spatial") {
      this.setDisplayMode("spatial");
    } else if (config.deferPlateRender) {
      this.showSpatialLoading();
    } else {
      this.render();
    }
  }

  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }

  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }

  update(config = {}) {
    if (config.modelType) this.modelType = config.modelType;
    if (config.viewType) this.viewType = config.viewType;
    if (config.detailLevel) this.detailLevel = config.detailLevel;
    if (config.painStyle) this.painStyle = config.painStyle;
    if (config.physicianMode !== undefined) this.physicianMode = config.physicianMode;
    if (config.rendererMode) this.rendererMode = config.rendererMode;
    if (config.accessibility) this.accessibility = { ...this.accessibility, ...config.accessibility };
    if (config.activeLayers) this.activeLayers = { ...this.activeLayers, ...config.activeLayers };
    if (config.visualization) this.visualization = { ...this.visualization, ...config.visualization };

    if (config.displayMode === "spatial" || config.displayMode === "plate") {
      this.setDisplayMode(config.displayMode);
      return;
    }

    // Spatial path: update in place — do not tear down WebGL with plate render().
    if (this.displayMode === "spatial" && this.spatialRenderer?.ready) {
      if (config.viewType) {
        this.spatialRenderer.setView(this.viewType, { animate: true });
      }
      this.spatialRenderer.setAnnotations?.(
        this._regionsForSpatial(),
        this.markerStore?.selectedRegionIds || []
      );
      return;
    }

    // Spatial-primary boot / unavailable — never paint the plate PNG into the stage.
    if (
      this.displayMode === "spatial-loading" ||
      this.displayMode === "spatial-unavailable" ||
      (this.spatialPrimaryNoPlate && this.displayMode !== "plate")
    ) {
      return;
    }

    this.render();
    if (this.clinicalRenderer.syncLayout) {
      this.clinicalRenderer.syncLayout();
    } else if (this.clinicalRenderer.layers?.overlay) {
      this.clinicalRenderer.layers.overlay.render();
      this.clinicalRenderer.layers.reference?.render();
      this.clinicalRenderer.renderMarkers?.();
      this.clinicalRenderer.applyVisualizationClasses?.();
    }
  }

  /**
   * Opt-in display mode. Plate remains explicit fallback / report compositor.
   * @param {"plate"|"spatial"} mode
   * @returns {Promise<boolean>}
   */
  async setDisplayMode(mode) {
    if (mode === "spatial") {
      await this.enableSpatialMode();
      return this.isSpatialMode();
    }
    this.enablePlateMode();
    return !this.isSpatialMode();
  }

  isSpatialMode() {
    return this.displayMode === "spatial" && !!this.spatialRenderer?.ready;
  }

  _revealSpatialViewport() {
    this.stage?.querySelectorAll?.(".cae-spatial-status")?.forEach((el) => el.remove());
    this.displayMode = "spatial";
    this.stage?.classList?.remove("cae-spatial-staging");
    this.stage?.classList?.add("cae-spatial-active");
    try {
      this.spatialRenderer?.resize?.();
    } catch (_) {
      /* ignore */
    }
    const chrome =
      (typeof window !== "undefined" && window.SpatialPrimaryChrome) || null;
    chrome?.applySpatialPrimaryChrome?.(true);
    this.trigger("displaymodechanged", { displayMode: "spatial" });
  }

  showSpatialLoading(message) {
    this.displayMode = "spatial-loading";
    this.stage?.classList?.remove("cae-plate-active", "cae-spatial-active");
    this.stage?.classList?.add("cae-spatial-staging");
    const chrome =
      (typeof window !== "undefined" && window.SpatialPrimaryChrome) || null;
    if (chrome) {
      chrome.renderStageStatus(
        this.container,
        "loading",
        null,
        message || "Loading 3D body…"
      );
    } else if (this.stage) {
      this.stage.innerHTML =
        '<div class="cae-spatial-status"><p class="cae-spatial-status-title">' +
        (message || "Loading 3D body…") +
        "</p></div>";
    }
    this.trigger("displaymodechanged", {
      displayMode: "spatial-loading",
      message: message || null
    });
  }

  setSpatialLoadingProgress(message) {
    if (this.displayMode !== "spatial-loading") return;
    const title = this.stage?.querySelector?.(".cae-spatial-status-title");
    if (title && message) title.textContent = message;
    else {
      const chrome =
        (typeof window !== "undefined" && window.SpatialPrimaryChrome) || null;
      chrome?.renderStageStatus?.(this.container, "loading", null, message);
    }
  }

  showSpatialUnavailable(reason) {
    this.lastSpatialFailure = reason || "spatial-unavailable";
    this.spatialRenderer?.dispose?.();
    this.spatialRenderer = null;
    this.displayMode = "spatial-unavailable";
    const bootUtils =
      (typeof window !== "undefined" && window.SpatialBootUtils) || null;
    bootUtils?.setBootState?.(this, bootUtils.BOOT_STATES?.FAILED_SPATIAL || "failed-spatial", {
      error: this.lastSpatialFailure
    });
    this.stage?.classList?.remove("cae-plate-active", "cae-spatial-active");
    this.stage?.classList?.add("cae-spatial-staging");
    // Clear any half-mounted viewport so the status card is the only UI.
    if (this.stage) {
      this.stage.querySelectorAll?.(".cae-spatial-viewport")?.forEach((el) => el.remove());
    }
    const chrome =
      (typeof window !== "undefined" && window.SpatialPrimaryChrome) || null;
    if (chrome) {
      chrome.renderStageStatus(this.container, "unavailable", this.lastSpatialFailure);
      chrome.applySpatialPrimaryChrome(false, { keepSpatialPrimary: true });
    } else if (this.stage) {
      this.stage.innerHTML =
        '<div class="cae-spatial-status"><p class="cae-spatial-status-title">3D body unavailable</p></div>';
    }
    this.trigger("displaymodechanged", {
      displayMode: "spatial-unavailable",
      reason: this.lastSpatialFailure
    });
    return false;
  }

  _recoverSpatialFailure(reason) {
    if (this.spatialPrimaryNoPlate) {
      return this.showSpatialUnavailable(reason);
    }
    this.enablePlateMode(reason);
    return false;
  }

  async enableSpatialMode() {
    const SpatialAnatomyRendererCtor =
      (typeof window !== "undefined" && window.SpatialAnatomyRenderer) || null;
    if (!SpatialAnatomyRendererCtor) {
      console.warn("[CAE] SpatialAnatomyRenderer not loaded");
      return this._recoverSpatialFailure("spatial-renderer-missing");
    }
    const token = ++this._displayModeToken;
    const bootUtils =
      (typeof window !== "undefined" && window.SpatialBootUtils) || null;
    const withTimeout = bootUtils?.withTimeout || ((p) => p);
    const mountMs = bootUtils?.TIMEOUTS?.mountMs || 45000;
    const retrying =
      this.displayMode === "spatial-unavailable" || !!this.lastSpatialFailure;

    this.lastSpatialFailure = null;

    // Clean retry only: drop a poisoned Three pending promise. First boot reuses cache.
    try {
      if (retrying) {
        window.SpatialThreeLoader?.clearThreeCache?.();
      }
      bootUtils?.resetDiagnosticsLogFlag?.();
      bootUtils?.setBootState?.(this, bootUtils.BOOT_STATES?.IDLE || "idle", {
        error: null,
        canonicalStatus: "idle"
      });
    } catch (_) {
      /* ignore */
    }

    try {
      this.showSpatialLoading("Loading 3D body…");
      this.spatialRenderer?.dispose?.();
      this.spatialRenderer = new SpatialAnatomyRendererCtor(this, {
        onFallback: (_reason, err) => {
          console.warn("[CAE] Spatial mount fallback signal", _reason, err);
          this.lastSpatialFailure = _reason || err?.message || "mount-failed";
        }
      });

      // Keep the loading card in the stage; mount appends the viewport underneath.
      this.stage.classList.remove("cae-plate-active");
      this.stage.classList.add("cae-spatial-staging");

      const ok = await withTimeout(
        this.spatialRenderer.mount(this.stage, {
          onProgress: (msg) => this.setSpatialLoadingProgress(msg),
          onInteractive: () => {
            if (token !== this._displayModeToken) return;
            this._revealSpatialViewport();
          }
        }),
        mountMs,
        "Spatial mount"
      );

      if (token !== this._displayModeToken) {
        this.spatialRenderer?.dispose?.();
        this.spatialRenderer = null;
        return this.isSpatialMode();
      }
      if (!ok) {
        return this._recoverSpatialFailure(
          this.lastSpatialFailure || "spatial-mount-failed"
        );
      }

      // Overlay should already be gone via onInteractive; keep this idempotent.
      this._revealSpatialViewport();
      bootUtils?.logDiagnosticsOnce?.(this);
      return true;
    } catch (err) {
      console.warn("[CAE] enableSpatialMode failed", err);
      if (token !== this._displayModeToken) return this.isSpatialMode();
      this.lastSpatialFailure = err?.message || "spatial-exception";
      return this._recoverSpatialFailure(this.lastSpatialFailure);
    }
  }

  enablePlateMode(reason) {
    this._displayModeToken += 1;
    this.spatialRenderer?.dispose?.();
    this.spatialRenderer = null;
    this.displayMode = "plate";
    this.spatialPrimaryNoPlate = false;
    this.stage?.classList?.remove("cae-spatial-active", "cae-spatial-staging");
    this.stage?.classList?.add("cae-plate-active");
    this.render();
    this.trigger("displaymodechanged", { displayMode: "plate", reason: reason || null });
    return true;
  }

  _regionsForSpatial() {
    if (!this.markerStore) return [];
    const model =
      typeof normalizeModelType === "function"
        ? normalizeModelType(this.modelType)
        : this.modelType;
    const map = new Map();
    const push = (entry) => {
      (entry?.regions || []).forEach((r) => map.set(r.id, r));
    };
    (this.markerStore.getAllEntries?.(model) || []).forEach(push);
    const active = this.markerStore.getActiveEntry?.();
    if (active) push(active);
    return [...map.values()];
  }

  isEnlarged() {
    return !!this.clinicalRenderer?.isEnlarged?.();
  }

  setEnlarged(enlarged, focus = null) {
    this.clinicalRenderer?.setEnlarged?.(enlarged, focus);
  }

  toggleEnlarge(focus = null) {
    return this.clinicalRenderer?.toggleEnlarge?.(focus) ?? false;
  }

  onZoomChange(callback) {
    this.clinicalRenderer?.onZoomChange?.(callback);
  }

  setPins(pins) {
    this.pins = pins;
    this.renderPins();
  }

  setPendingPin(pin) {
    this.pendingPin = pin;
    this.renderPins();
  }

  clearPendingPin() {
    this.pendingPin = null;
    this.renderPins();
  }

  initDOM() {
    this.container.innerHTML = "";
    this.container.classList.add("cae-viewport-wrapper");
    
    this.stage = document.createElement("div");
    this.stage.className = "cae-stage";
    this.stage.style.width = "100%";
    this.stage.style.height = "100%";
    this.stage.style.position = "relative";
    this.container.appendChild(this.stage);
  }

  render() {
    if (this.displayMode === "spatial" && this.spatialRenderer?.ready) {
      this.spatialRenderer.render(this.stage);
      return;
    }
    if (
      this.displayMode === "spatial-loading" ||
      this.displayMode === "spatial-unavailable" ||
      (this.spatialPrimaryNoPlate && this.displayMode !== "plate")
    ) {
      return;
    }
    if (this.rendererMode === "clinical") {
      this.clinicalRenderer.render(this.stage);
    } else {
      this.prototypeRenderer.render(this.stage);
      this.clinicalRenderer.loadStatus = "prototype (geometric)";
      this.clinicalRenderer.fallbackActive = false;
      this.clinicalRenderer.injectDebugLabel(this.stage, getAssetPath(this.modelType, this.viewType));
    }
  }

  renderPins() {
    if (this.clinicalRenderer.renderMarkers) {
      this.clinicalRenderer.renderMarkers();
      this.clinicalRenderer.updateDebugLabel?.();
      return;
    }
    const group = document.getElementById("caePinsGroup");
    if (!group) return;
    
    if (this.rendererMode === "clinical" && !this.clinicalRenderer.fallbackActive) {
      this.clinicalRenderer.renderPins(group);
    } else {
      this.prototypeRenderer.renderPins(group);
    }
  }

  getMappedRegionName(region) {
    const dict = {
      "Head": { patient: "Head", physician: "Cranium & Facial bones" },
      "Neck": { patient: "Neck", physician: "Cervical Spine" },
      "Chest": { patient: "Chest", physician: "Pectoralis Major / Sternum" },
      "Upper Back": { patient: "Upper Back", physician: "Thoracic Spine" },
      "Lower Back": { patient: "Lower Back", physician: "Lumbar Spine" },
      "Abdomen": { patient: "Abdomen", physician: "Rectus Abdominis / Epigastrium" },
      "Pelvis": { patient: "Hips", physician: "Sacroiliac / Pelvic Girdle" },
      "Left Shoulder": { patient: "Left Shoulder", physician: "L-Acromion Joint" },
      "Right Shoulder": { patient: "Right Shoulder", physician: "R-Acromion Joint" },
      "Left Arm": { patient: "Left Arm", physician: "L-Humerus / Biceps" },
      "Right Arm": { patient: "Right Arm", physician: "R-Humerus / Biceps" },
      "Left Hand": { patient: "Left Hand", physician: "L-Carpi / Metacarpals" },
      "Right Hand": { patient: "Right Hand", physician: "R-Carpi / Metacarpals" },
      "Left Leg": { patient: "Left Leg", physician: "L-Femur / Quadriceps" },
      "Right Leg": { patient: "Right Leg", physician: "R-Femur / Quadriceps" },
      "Left Foot": { patient: "Left Foot", physician: "L-Tarsals / Calcaneus" },
      "Right Foot": { patient: "Right Foot", physician: "R-Tarsals / Calcaneus" }
    };

    if (dict[region]) {
      return this.physicianMode ? dict[region].physician : dict[region].patient;
    }
    return region;
  }
}


// ==========================================================================
// CLINICAL ANATOMY RENDERER (HIGH-FIDELITY MEDICAL ATLAS)
// ==========================================================================
class ClinicalAnatomyRenderer {
  constructor(engine) {
    this.engine = engine;
    this.loadStatus = "loading";
    this.fallbackActive = false;
  }

  render(container) {
    this.fallbackActive = false;
    this.loadStatus = "loading";
    const imgPath = getAssetPath(this.engine.modelType, this.engine.viewType);

    container.innerHTML = `
      <div class="cae-clinical-viewport" style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 1;">
        
        <!-- Temporary Guaranteed Test Body (Visible until asset loads or if it fails) -->
        <svg id="caeTestBodySvg" viewBox="0 0 200 360" xmlns="http://www.w3.org/2000/svg" style="height: 70%; width: auto; max-width: 100%; border: 2px dashed #22d3ee; border-radius: 8px; background: rgba(34, 211, 238, 0.05); z-index: 1; transition: opacity 0.3s ease;">
          <ellipse cx="100" cy="50" rx="22" ry="28" fill="rgba(34, 211, 238, 0.15)" stroke="#22d3ee" stroke-width="2" />
          <path d="M 68 110 C 68 110 74 190 76 210 L 100 240 L 124 210 C 126 190 132 110 132 110 Z" fill="rgba(34, 211, 238, 0.15)" stroke="#22d3ee" stroke-width="2" />
          <line x1="82" y1="240" x2="80" y2="330" stroke="#22d3ee" stroke-width="3" stroke-linecap="round" />
          <line x1="118" y1="240" x2="120" y2="330" stroke="#22d3ee" stroke-width="3" stroke-linecap="round" />
          <line x1="68" y1="120" x2="48" y2="190" stroke="#22d3ee" stroke-width="3" stroke-linecap="round" />
          <line x1="132" y1="120" x2="152" y2="190" stroke="#22d3ee" stroke-width="3" stroke-linecap="round" />
          <text x="100" y="150" fill="#22d3ee" font-size="12" font-weight="800" text-anchor="middle" font-family="sans-serif">CAE placeholder body</text>
        </svg>

        <!-- Radiology Translucent Model Image Plate -->
        <img src="${imgPath}" alt="Clinical Anatomy Plate" class="cae-anatomy-image" style="height: 100%; width: auto; object-fit: contain; pointer-events: none; z-index: 2; position: absolute; display: none;" />
        
        <!-- Interactive SVG hit mask overlay -->
        <svg id="caeSvg" viewBox="0 0 200 360" xmlns="http://www.w3.org/2000/svg" class="cae-canvas-svg" style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; z-index: 3;">
          <defs>
            <radialGradient id="grad-radiating" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
              <stop offset="25%" stop-color="#fef08a" stop-opacity="0.9" />
              <stop offset="55%" stop-color="#ef4444" stop-opacity="0.7" />
              <stop offset="85%" stop-color="#dc2626" stop-opacity="0.25" />
              <stop offset="100%" stop-color="#dc2626" stop-opacity="0" />
            </radialGradient>
            
            <radialGradient id="grad-heatmap-clinical" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
              <stop offset="15%" stop-color="#fef08a" stop-opacity="0.95" />
              <stop offset="45%" stop-color="#ef4444" stop-opacity="0.8" />
              <stop offset="75%" stop-color="#b91c1c" stop-opacity="0.35" />
              <stop offset="100%" stop-color="#b91c1c" stop-opacity="0" />
            </radialGradient>

            <radialGradient id="grad-deep-clinical" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#701a75" stop-opacity="0.95" />
              <stop offset="35%" stop-color="#dc2626" stop-opacity="0.65" />
              <stop offset="75%" stop-color="#b91c1c" stop-opacity="0.2" />
              <stop offset="100%" stop-color="#b91c1c" stop-opacity="0" />
            </radialGradient>

            <radialGradient id="grad-diffuse" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#f87171" stop-opacity="0.65" />
              <stop offset="50%" stop-color="#f87171" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#f87171" stop-opacity="0" />
            </radialGradient>
          </defs>

          <!-- Hotspot paths -->
          ${this.getHitboxSegments()}
          
          <g id="caePinsGroup"></g>
        </svg>
      </div>
    `;

    const img = container.querySelector(".cae-anatomy-image");
    const placeholder = container.querySelector("#caeTestBodySvg");
    let settled = false;

    const handleLoad = () => {
      if (settled) return;
      settled = true;
      this.loadStatus = "loaded";
      this.fallbackActive = false;
      console.log("CAE Image Loaded successfully:", imgPath);
      const assetEl = container.querySelector(".cae-anatomy-image, .cae-anatomy-inline");
      if (assetEl) {
        assetEl.style.display = assetEl.tagName === "IMG" ? "block" : "flex";
      }
      if (placeholder) {
        placeholder.style.display = "none";
      }
      this.updateDebugLabel();
    };

    const handleError = () => {
      if (settled) return;
      settled = true;
      console.error("CAE Clinical Asset Load Failed! Path requested:", imgPath);
      this.loadStatus = "failed (fallback active)";
      this.fallbackActive = true;
      this.updateDebugLabel();

      const assetEl = container.querySelector(".cae-anatomy-image, .cae-anatomy-inline");
      if (assetEl) assetEl.style.display = "none";
      if (placeholder) {
        placeholder.style.display = "block";
        placeholder.style.opacity = "1";
      }

      const viewport = container.querySelector(".cae-clinical-viewport");
      const prototypeContainer = document.createElement("div");
      prototypeContainer.style.position = "absolute";
      prototypeContainer.style.inset = "0";
      prototypeContainer.style.pointerEvents = "none";
      prototypeContainer.style.zIndex = "2";
      viewport.appendChild(prototypeContainer);
      this.engine.prototypeRenderer.render(prototypeContainer);

      const fallbackBadge = document.createElement("div");
      fallbackBadge.className = "cae-fallback-badge";
      fallbackBadge.textContent = "Prototype fallback active";
      viewport.appendChild(fallbackBadge);
    };

    const loadClinicalAsset = () => {
      console.log("CAE initiating asset load for path:", imgPath);
      const isSvg = imgPath.endsWith(".svg");

      if (isSvg) {
        fetch(imgPath, { cache: "force-cache" })
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
          })
          .then(svgText => {
            const inlineHost = document.createElement("div");
            inlineHost.className = "cae-anatomy-image cae-anatomy-inline";
            inlineHost.innerHTML = svgText;
            const inlineSvg = inlineHost.querySelector("svg");
            if (inlineSvg) {
              inlineSvg.setAttribute("role", "img");
              inlineSvg.setAttribute("aria-label", "Clinical Anatomy Plate");
            }
            img.replaceWith(inlineHost);
            handleLoad();
          })
          .catch(handleError);
        return;
      }

      img.onload = () => {
        if (img.naturalWidth > 0 || img.naturalHeight > 0) {
          handleLoad();
        } else {
          handleError();
        }
      };
      img.onerror = handleError;
      img.src = imgPath + (imgPath.includes("?") ? "&" : "?") + "v=" + Date.now();
    };

    loadClinicalAsset();

    const hitSvg = container.querySelector("#caeSvg");
    this.bindClickEvents(hitSvg);
    this.renderPins(container.querySelector("#caePinsGroup"));
    this.injectDebugLabel(container, imgPath);
  }

  injectDebugLabel(container, imgPath) {
    if (!window.DEV_MODE) return;

    const existing = container.querySelector("#caeDebugLabel");
    if (existing) existing.remove();

    const label = document.createElement("div");
    label.id = "caeDebugLabel";
    label.className = "cae-debug-badge";
    
    label.innerHTML = `
      <div><strong>Renderer:</strong> <span id="caeRendererModeVal">${this.engine.rendererMode}</span></div>
      <div><strong>Patient:</strong> <span id="caePatientModelVal">${this.engine.modelType}</span></div>
      <div><strong>View:</strong> <span id="caeBodyViewVal">${this.engine.viewType}</span></div>
      <div><strong>Asset path:</strong> ${imgPath}</div>
      <div><strong>Status:</strong> <span id="caeLoadStatusVal">${this.loadStatus}</span></div>
    `;
    container.appendChild(label);
  }

  updateDebugLabel() {
    const labelVal = document.getElementById("caeLoadStatusVal");
    if (labelVal) {
      labelVal.textContent = this.loadStatus;
      labelVal.classList.remove('status-failed', 'status-loaded', 'status-loading');
      if (this.loadStatus.includes('failed')) labelVal.classList.add('status-failed');
      else if (this.loadStatus === 'loaded') labelVal.classList.add('status-loaded');
      else labelVal.classList.add('status-loading');
    }
    const modeVal = document.getElementById("caeRendererModeVal");
    if (modeVal) modeVal.textContent = this.engine.rendererMode;
    const modelVal = document.getElementById("caePatientModelVal");
    if (modelVal) modelVal.textContent = this.engine.modelType;
    const viewVal = document.getElementById("caeBodyViewVal");
    if (viewVal) viewVal.textContent = this.engine.viewType;
  }

  getHitboxSegments() {
    const isBack = this.engine.viewType === "back";
    const isSide = this.engine.viewType === "left" || this.engine.viewType === "right";
    const isLeft = this.engine.viewType === "left";
    const mirror = this.engine.viewType === "right" ? 'transform="scale(-1,1) translate(-200,0)"' : "";

    const mappingChest = isBack ? "Upper Back" : "Chest";
    const mappingBelly = isBack ? "Lower Back" : "Abdomen";

    if (isSide) {
      return `
        <g ${mirror} fill="transparent" stroke="transparent" stroke-width="2">
          <path class="anatomy-segment" data-region="Head" d="M 96 18 C 114 18 122 30 120 40 C 118 48 114 50 116 54 C 118 56 122 58 118 60 C 114 62 108 60 98 60 Z" />
          <rect class="anatomy-segment" data-region="Neck" x="90" y="60" width="16" height="16" rx="2" />
          <path class="anatomy-segment" data-region="Chest" d="M 90 76 C 90 76 118 80 114 122 C 110 144 80 144 80 144 L 82 76 Z" />
          <path class="anatomy-segment" data-region="Lower Back" d="M 80 122 C 80 122 84 154 84 160 C 84 166 112 166 112 160 C 112 154 110 122 110 122 Z" />
          <path class="anatomy-segment" data-region="Pelvis" d="M 84 160 L 112 160 L 108 184 L 82 184 Z" />
          <path class="anatomy-segment" data-region="${isLeft ? 'Left' : 'Right'} Shoulder" d="M 96 76 C 90 82 92 90 92 90" stroke-width="8" stroke-linecap="round" />
          <path class="anatomy-segment" data-region="${isLeft ? 'Left' : 'Right'} Arm" d="M 92 90 L 88 138 L 84 180" stroke-width="12" stroke-linecap="round" />
          <circle class="anatomy-segment" data-region="${isLeft ? 'Left' : 'Right'} Hand" cx="82" cy="188" r="7" />
          <path class="anatomy-segment" data-region="${isLeft ? 'Left' : 'Right'} Leg" d="M 96 184 L 98 255 L 94 326" stroke-width="18" stroke-linecap="round" />
          <ellipse class="anatomy-segment" data-region="${isLeft ? 'Left' : 'Right'} Foot" cx="102" cy="336" rx="14" ry="6" />
        </g>
      `;
    }

    return `
      <g fill="transparent" stroke="transparent" stroke-width="2">
        <ellipse class="anatomy-segment" data-region="Head" cx="100" cy="40" rx="18" ry="22" />
        <rect class="anatomy-segment" data-region="Neck" x="93" y="62" width="14" height="14" rx="2" />
        
        <path class="anatomy-segment" data-region="${mappingChest}" d="M 62 76 C 62 76 66 114 74 122 C 80 130 120 130 126 122 C 134 114 138 76 138 76 Z" />
        <path class="anatomy-segment" data-region="${mappingBelly}" d="M 74 122 C 74 122 76 154 76 160 C 80 166 120 166 124 160 C 124 154 126 122 126 122 Z" />
        <path class="anatomy-segment" data-region="Pelvis" d="M 76 160 L 124 160 L 126 184 L 74 184 Z" />
        
        <path class="anatomy-segment" data-region="Left Shoulder" d="M 62 76 Q 52 82 48 92" stroke-width="8" stroke-linecap="round" />
        <path class="anatomy-segment" data-region="Left Arm" d="M 48 92 L 38 140 L 30 185" stroke-width="12" stroke-linecap="round" />
        <circle class="anatomy-segment" data-region="Left Hand" cx="27" cy="194" r="7" />
        
        <path class="anatomy-segment" data-region="Right Shoulder" d="M 138 76 Q 148 82 152 92" stroke-width="8" stroke-linecap="round" />
        <path class="anatomy-segment" data-region="Right Arm" d="M 152 92 L 162 140 L 170 185" stroke-width="12" stroke-linecap="round" />
        <circle class="anatomy-segment" data-region="Right Hand" cx="173" cy="194" r="7" />
        
        <path class="anatomy-segment" data-region="Left Leg" d="M 85 184 L 81 255 L 77 326" stroke-width="16" stroke-linecap="round" />
        <ellipse class="anatomy-segment" data-region="Left Foot" cx="74" cy="336" rx="10" ry="6" />
        
        <path class="anatomy-segment" data-region="Right Leg" d="M 115 184 L 119 255 L 123 326" stroke-width="16" stroke-linecap="round" />
        <ellipse class="anatomy-segment" data-region="Right Foot" cx="126" cy="336" rx="10" ry="6" />
      </g>
    `;
  }

  bindClickEvents(svg) {
    if (!svg) return;
    svg.querySelectorAll(".anatomy-segment").forEach(seg => {
      seg.addEventListener("click", e => {
        if (this.engine.draggingPinId) return;

        const coords = this.getSVGCoords(e, svg);
        const x = Math.max(0, Math.min(200, coords.x));
        const y = Math.max(0, Math.min(360, coords.y));

        const xPercent = (x / 200) * 100;
        const yPercent = (y / 360) * 100;

        const region = seg.getAttribute("data-region");
        const mappedName = this.engine.getMappedRegionName(region);

        this.engine.pendingPin = {
          x: xPercent,
          y: yPercent,
          region: mappedName,
          view: this.engine.viewType
        };

        this.engine.trigger("pinadded", this.engine.pendingPin);
        this.renderPins(svg.querySelector("#caePinsGroup"));
      });
    });
  }

  getSVGCoords(e, svg) {
    const rect = svg.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = ((clientX - rect.left) / (rect.width || 1)) * 200;
    const y = ((clientY - rect.top) / (rect.height || 1)) * 360;
    return { x, y };
  }

  renderPins(group) {
    if (!group) return;
    group.innerHTML = "";

    this.engine.pins
      .filter(p => p.view === this.engine.viewType)
      .forEach(pin => {
        const pinEl = this.createPinVector(pin.id, (pin.x / 100) * 200, (pin.y / 100) * 360, pin.intensity, false);
        group.appendChild(pinEl);
      });

    if (this.engine.pendingPin && this.engine.pendingPin.view === this.engine.viewType) {
      const pinEl = this.createPinVector("pending", (this.engine.pendingPin.x / 100) * 200, (this.engine.pendingPin.y / 100) * 360, this.engine.pendingPin.intensity || 5, true);
      group.appendChild(pinEl);
    }
  }

  createPinVector(id, x, y, intensity, isPending = false) {
    const color = PAIN_COLORS[intensity] || "#ef4444";
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "cae-pin-group" + (isPending ? " pending" : ""));
    g.setAttribute("transform", `translate(${x}, ${y})`);
    g.dataset.id = id;
    g.style.cursor = "pointer";
    g.style.pointerEvents = "all";

    let mainShape;
    let haloCircle = null;
    
    const baseRadius = 8 + (intensity * 2.2);

    if (this.engine.painStyle === "heatmap") {
      g.style.filter = `drop-shadow(0 0 10px ${color})`;
      
      haloCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      haloCircle.setAttribute("cx", "0");
      haloCircle.setAttribute("cy", "0");
      haloCircle.setAttribute("r", isPending ? (baseRadius + 6).toString() : baseRadius.toString());
      haloCircle.setAttribute("fill", "url(#grad-heatmap-clinical)");
      
      const anim = document.createElementNS("http://www.w3.org/2000/svg", "animate");
      anim.setAttribute("attributeName", "r");
      anim.setAttribute("values", `${baseRadius - 2};${baseRadius + 5};${baseRadius - 2}`);
      anim.setAttribute("dur", "2.5s");
      anim.setAttribute("repeatCount", "indefinite");
      haloCircle.appendChild(anim);

      mainShape = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      mainShape.setAttribute("cx", "0");
      mainShape.setAttribute("cy", "0");
      mainShape.setAttribute("r", "4");
      mainShape.setAttribute("fill", "#ffffff");
      mainShape.setAttribute("stroke", "#fef08a");
      mainShape.setAttribute("stroke-width", "1.5");
      
    } else if (this.engine.painStyle === "radiating") {
      haloCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      haloCircle.setAttribute("cx", "0");
      haloCircle.setAttribute("cy", "0");
      haloCircle.setAttribute("r", (baseRadius + 8).toString());
      haloCircle.setAttribute("fill", "url(#grad-radiating)");

      const animOp = document.createElementNS("http://www.w3.org/2000/svg", "animate");
      animOp.setAttribute("attributeName", "opacity");
      animOp.setAttribute("values", "1;0.3;1");
      animOp.setAttribute("dur", "2s");
      animOp.setAttribute("repeatCount", "indefinite");
      haloCircle.appendChild(animOp);

      mainShape = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      mainShape.setAttribute("cx", "0");
      mainShape.setAttribute("cy", "0");
      mainShape.setAttribute("r", "5");
      mainShape.setAttribute("fill", color);
      mainShape.setAttribute("stroke", "#ffffff");
      mainShape.setAttribute("stroke-width", "1");

    } else if (this.engine.painStyle === "deep") {
      haloCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      haloCircle.setAttribute("cx", "0");
      haloCircle.setAttribute("cy", "0");
      haloCircle.setAttribute("r", baseRadius.toString());
      haloCircle.setAttribute("fill", "url(#grad-deep-clinical)");

      mainShape = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      mainShape.setAttribute("cx", "0");
      mainShape.setAttribute("cy", "0");
      mainShape.setAttribute("r", "4");
      mainShape.setAttribute("fill", "#701a75");
      mainShape.setAttribute("stroke", color);
      mainShape.setAttribute("stroke-width", "1");

    } else if (this.engine.painStyle === "diffuse") {
      haloCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      haloCircle.setAttribute("cx", "0");
      haloCircle.setAttribute("cy", "0");
      haloCircle.setAttribute("r", (baseRadius + 12).toString());
      haloCircle.setAttribute("fill", "url(#grad-diffuse)");

      mainShape = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      mainShape.setAttribute("cx", "0");
      mainShape.setAttribute("cy", "0");
      mainShape.setAttribute("r", "3");
      mainShape.setAttribute("fill", color);

    } else if (this.engine.painStyle === "target") {
      haloCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      haloCircle.setAttribute("cx", "0");
      haloCircle.setAttribute("cy", "0");
      haloCircle.setAttribute("r", "12");
      haloCircle.setAttribute("fill", "none");
      haloCircle.setAttribute("stroke", color);
      haloCircle.setAttribute("stroke-width", "1.5");

      mainShape = document.createElementNS("http://www.w3.org/2000/svg", "path");
      mainShape.setAttribute("d", "M -14 0 L 14 0 M 0 -14 L 0 14");
      mainShape.setAttribute("stroke", color);
      mainShape.setAttribute("stroke-width", "2");

    } else {
      mainShape = document.createElementNS("http://www.w3.org/2000/svg", "path");
      mainShape.setAttribute("d", "M -7 -7 L 7 7 M -7 7 L 7 -7");
      mainShape.setAttribute("stroke", color);
      mainShape.setAttribute("stroke-width", "3.5");
      mainShape.setAttribute("stroke-linecap", "round");
    }

    if (isPending && this.engine.painStyle !== "target" && this.engine.painStyle !== "trigger") {
      mainShape.setAttribute("stroke", "#ffffff");
      mainShape.setAttribute("stroke-width", "1.5");
    }

    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    if (isPending) {
      title.textContent = `Pending Pin - ${this.engine.pendingPin.region}`;
    } else {
      const pin = this.engine.pins.find(p => p.id === id);
      title.textContent = `${pin ? pin.region : 'Anatomy'}: ${intensity}/10`;
    }
    g.appendChild(title);

    if (haloCircle) g.appendChild(haloCircle);
    g.appendChild(mainShape);

    this.setupDragHooks(g, id);

    return g;
  }

  setupDragHooks(g, id) {
    const onStart = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.engine.draggingPinId = id;

      document.addEventListener("mousemove", onMove);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("mouseup", onEnd);
      document.addEventListener("touchend", onEnd);
    };

    const onMove = (e) => {
      if (this.engine.draggingPinId !== id) return;
      e.preventDefault();

      const svg = this.engine.stage.querySelector("svg");
      if (!svg) return;

      const coords = this.getSVGCoords(e, svg);
      const x = Math.max(0, Math.min(200, coords.x));
      const y = Math.max(0, Math.min(360, coords.y));

      if (id === "pending") {
        if (this.engine.pendingPin) {
          this.engine.pendingPin.x = (x / 200) * 100;
          this.engine.pendingPin.y = (y / 360) * 100;
        }
      } else {
        const pin = this.engine.pins.find(p => p.id === id);
        if (pin) {
          pin.x = (x / 200) * 100;
          pin.y = (y / 360) * 100;
        }
      }

      g.setAttribute("transform", `translate(${x}, ${y})`);
      this.engine.trigger("pindragged", { id, x: (x / 200) * 100, y: (y / 360) * 100 });
    };

    const onEnd = (e) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchend", onEnd);

      if (this.engine.draggingPinId === id) {
        let clientX, clientY;
        if (e.changedTouches && e.changedTouches.length > 0) {
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
        } else {
          clientX = e.clientX;
          clientY = e.clientY;
        }

        g.style.pointerEvents = "none";
        const element = document.elementFromPoint(clientX, clientY);
        g.style.pointerEvents = "auto";

        const segment = element ? element.closest(".anatomy-segment") : null;
        const region = segment ? segment.getAttribute("data-region") : null;

        if (region) {
          const mappedName = this.engine.getMappedRegionName(region);
          if (id === "pending") {
            if (this.engine.pendingPin) this.engine.pendingPin.region = mappedName;
          } else {
            const pin = this.engine.pins.find(p => p.id === id);
            if (pin) pin.region = mappedName;
          }
        }

        this.engine.draggingPinId = null;
        this.renderPins(this.engine.stage.querySelector("#caePinsGroup"));
        
        if (id !== "pending") {
          const pin = this.engine.pins.find(p => p.id === id);
          if (pin) this.engine.trigger("pinselected", pin);
        }
      }
    };

    g.addEventListener("mousedown", onStart);
    g.addEventListener("touchstart", onStart, { passive: false });
  }
}


// ==========================================================================
// PROTOTYPE BODY RENDERER (GEOMETRIC OUTLINES - FALLBACK)
// ==========================================================================
class PrototypeBodyRenderer {
  constructor(engine) {
    this.engine = engine;
  }

  render(container) {
    const svgHTML = `
      <svg id="caeSvg" viewBox="0 0 200 360" xmlns="http://www.w3.org/2000/svg" class="cae-canvas-svg" style="width: 100%; height: 100%;">
        <defs>
          <radialGradient id="grad-radiating" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
            <stop offset="25%" stop-color="#fef08a" stop-opacity="0.9" />
            <stop offset="55%" stop-color="#ef4444" stop-opacity="0.7" />
            <stop offset="85%" stop-color="#dc2626" stop-opacity="0.25" />
            <stop offset="100%" stop-color="#dc2626" stop-opacity="0" />
          </radialGradient>
          
          <radialGradient id="grad-heatmap-clinical" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
            <stop offset="15%" stop-color="#fef08a" stop-opacity="0.95" />
            <stop offset="45%" stop-color="#ef4444" stop-opacity="0.8" />
            <stop offset="75%" stop-color="#b91c1c" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#b91c1c" stop-opacity="0" />
          </radialGradient>

          <radialGradient id="grad-deep-clinical" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#701a75" stop-opacity="0.95" />
            <stop offset="35%" stop-color="#dc2626" stop-opacity="0.65" />
            <stop offset="75%" stop-color="#b91c1c" stop-opacity="0.2" />
            <stop offset="100%" stop-color="#b91c1c" stop-opacity="0" />
          </radialGradient>

          <radialGradient id="grad-diffuse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#f87171" stop-opacity="0.65" />
            <stop offset="50%" stop-color="#f87171" stop-opacity="0.3" />
            <stop offset="100%" stop-color="#f87171" stop-opacity="0" />
          </radialGradient>
          
          <linearGradient id="muscle-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0e7490" stop-opacity="0.6" />
            <stop offset="100%" stop-color="#1e3a8a" stop-opacity="0.35" />
          </linearGradient>
        </defs>
        
        ${this.buildAnatomicalLayers()}
        <g id="caePinsGroup"></g>
      </svg>
    `;

    container.innerHTML = svgHTML;
    this.bindClickEvents(container.querySelector("svg"));
    this.renderPins(container.querySelector("#caePinsGroup"));
  }

  buildAnatomicalLayers() {
    const isBack = this.engine.viewType === "back";
    const isSide = this.engine.viewType === "left" || this.engine.viewType === "right";
    const isLeft = this.engine.viewType === "left";
    const mirror = this.engine.viewType === "right" ? 'transform="scale(-1,1) translate(-200,0)"' : "";

    let headTransform = 'transform="translate(0, 0) scale(1)"';
    let torsoTransform = 'transform="translate(0, 0) scale(1)"';
    let leftArmTransform = 'transform="translate(0, 0) scale(1)"';
    let rightArmTransform = 'transform="translate(0, 0) scale(1)"';
    let leftLegTransform = 'transform="translate(0, 0) scale(1)"';
    let rightLegTransform = 'transform="translate(0, 0) scale(1)"';

    if (this.engine.modelType === "female") {
      headTransform = 'transform="translate(0, 1.5) scale(0.94)"';
      torsoTransform = 'transform="translate(4, 0) scale(0.96, 1)"';
      leftArmTransform = 'transform="translate(4, 0) scale(0.94, 0.98)"';
      rightArmTransform = 'transform="translate(-4, 0) scale(0.94, 0.98)"';
      leftLegTransform = 'transform="translate(-1, 0) scale(1.02, 0.98)"';
      rightLegTransform = 'transform="translate(1, 0) scale(1.02, 0.98)"';
    } else if (this.engine.modelType === "child") {
      headTransform = 'transform="translate(0, 24) scale(1.2)"';
      torsoTransform = 'transform="translate(15, 30) scale(0.85, 0.72)"';
      leftArmTransform = 'transform="translate(16, 30) scale(0.78, 0.68)"';
      rightArmTransform = 'transform="translate(-16, 30) scale(0.78, 0.68)"';
      leftLegTransform = 'transform="translate(10, 32) scale(0.85, 0.7)"';
      rightLegTransform = 'transform="translate(-10, 32) scale(0.85, 0.7)"';
    }

    const skinStroke = this.engine.accessibility.contrast ? "#ffffff" : (this.engine.accessibility.colorblind ? "#3B82F6" : "#38bdf8");
    const skinFill = this.engine.accessibility.contrast ? "#020617" : "#0d1b30";
    const muscleFill = "url(#muscle-grad)";
    const skeletalFill = "#e2e8f0";
    const nerveStroke = "#eab308";
    const organFill = "#818cf8";
    const vesselArtery = "#ef4444";
    const vesselVein = "#3b82f6";

    const skinOpacity = this.engine.activeLayers.skin ? (this.engine.accessibility.contrast ? "1.0" : "0.55") : "0";
    const muscleOpacity = this.engine.activeLayers.muscle ? "0.75" : "0";
    const skeletalOpacity = this.engine.activeLayers.skeletal ? "0.5" : "0";
    const nerveOpacity = this.engine.activeLayers.nerve ? "0.85" : "0";
    const organOpacity = this.engine.activeLayers.organ ? "0.65" : "0";
    const vesselOpacity = this.engine.activeLayers.vessel ? "0.8" : "0";

    let spineJoints = "";
    if (this.engine.activeLayers.skeletal) {
      for (let yVal = 64; yVal <= 178; yVal += 6) {
        spineJoints += `<rect x="98.5" y="${yVal}" width="3" height="3" rx="0.5" fill="${skeletalFill}" opacity="0.5" />`;
      }
    }

    let ribsCurves = "";
    if (this.engine.activeLayers.skeletal) {
      for (let idx = 0; idx < 7; idx++) {
        const ry = 84 + idx * 8;
        const rxOffset = idx * 2.2;
        ribsCurves += `<path d="M 98.5 ${ry} Q ${80 - rxOffset} ${ry + 5} ${78 - idx} ${ry}" stroke="${skeletalFill}" stroke-width="1.2" fill="none" opacity="0.3" />`;
        ribsCurves += `<path d="M 101.5 ${ry} Q ${120 + rxOffset} ${ry + 5} ${122 + idx} ${ry}" stroke="${skeletalFill}" stroke-width="1.2" fill="none" opacity="0.3" />`;
      }
    }

    if (isSide) {
      return `
        <g ${mirror}>
          <g class="cae-layer" opacity="${skinOpacity}">
            <path class="anatomy-segment" data-region="Head" d="M 96 18 C 114 18 122 30 120 40 C 118 48 114 50 116 54 C 118 56 122 58 118 60 C 114 62 108 60 98 60 Z" fill="${skinFill}" stroke="${skinStroke}" stroke-width="1.5" />
            <rect class="anatomy-segment" data-region="Neck" x="90" y="60" width="16" height="16" rx="2" fill="${skinFill}" stroke="${skinStroke}" stroke-width="1.5" />
            <path class="anatomy-segment" data-region="Chest" d="M 90 76 C 90 76 118 80 114 122 C 110 144 80 144 80 144 L 82 76 Z" fill="${skinFill}" stroke="${skinStroke}" stroke-width="1.5" />
            <path class="anatomy-segment" data-region="Lower Back" d="M 80 122 C 80 122 84 154 84 160 C 84 166 112 166 112 160 C 112 154 110 122 110 122 Z" fill="${skinFill}" stroke="${skinStroke}" stroke-width="1.5" />
            <path class="anatomy-segment" data-region="Pelvis" d="M 84 160 L 112 160 L 108 184 L 82 184 Z" fill="${skinFill}" stroke="${skinStroke}" stroke-width="1.5" />
            <path class="anatomy-segment" data-region="${isLeft ? 'Left' : 'Right'} Shoulder" d="M 96 76 C 90 82 92 90 92 90" stroke="${skinStroke}" stroke-width="8" fill="none" stroke-linecap="round" />
            <path class="anatomy-segment" data-region="${isLeft ? 'Left' : 'Right'} Arm" d="M 92 90 L 88 138 L 84 180" stroke="${skinStroke}" stroke-width="12" fill="none" stroke-linecap="round" />
            <circle class="anatomy-segment" data-region="${isLeft ? 'Left' : 'Right'} Hand" cx="82" cy="188" r="7" fill="${skinFill}" stroke="${skinStroke}" stroke-width="1.5" />
            <path class="anatomy-segment" data-region="${isLeft ? 'Left' : 'Right'} Leg" d="M 96 184 L 98 255 L 94 326" stroke="${skinStroke}" stroke-width="18" fill="none" stroke-linecap="round" />
            <ellipse class="anatomy-segment" data-region="${isLeft ? 'Left' : 'Right'} Foot" cx="102" cy="336" rx="14" ry="6" fill="${skinFill}" stroke="${skinStroke}" stroke-width="1.5" />
          </g>
        </g>
      `;
    }

    const mappingChest = isBack ? "Upper Back" : "Chest";
    const mappingBelly = isBack ? "Lower Back" : "Abdomen";

    return `
      <g class="cae-layer" opacity="${skeletalOpacity}">
        <g ${headTransform}><ellipse cx="100" cy="38" rx="12" ry="15" fill="${skeletalFill}" opacity="0.4" /></g>
        <g ${torsoTransform}>${spineJoints}${ribsCurves}</g>
      </g>
      <g class="cae-layer" opacity="${muscleOpacity}">
        <g ${torsoTransform}>
          <path d="M 76 84 C 84 82 96 84 98 98 L 98 112 Z" fill="${muscleFill}" stroke="${skinStroke}" stroke-width="0.5" />
          <path d="M 124 84 C 116 82 104 84 102 98 L 102 112 Z" fill="${muscleFill}" stroke="${skinStroke}" stroke-width="0.5" />
        </g>
      </g>
      <g class="cae-layer" opacity="${skinOpacity}">
        <g ${headTransform}><ellipse class="anatomy-segment" data-region="Head" cx="100" cy="40" rx="18" ry="22" fill="${skinFill}" stroke="${skinStroke}" stroke-width="1.8" /></g>
        <g ${torsoTransform}>
          <rect class="anatomy-segment" data-region="Neck" x="92" y="58" width="16" height="18" rx="2" fill="${skinFill}" stroke="${skinStroke}" stroke-width="1.5" />
          <path class="anatomy-segment" data-region="${mappingChest}" d="M 62 76 C 62 76 66 114 74 122 C 80 130 120 130 126 122 C 134 114 138 76 138 76 Z" fill="${skinFill}" stroke="${skinStroke}" stroke-width="1.8" />
          <path class="anatomy-segment" data-region="${mappingBelly}" d="M 74 122 C 74 122 76 154 76 160 C 80 166 120 166 124 160 C 124 154 126 122 126 122 Z" fill="${skinFill}" stroke="${skinStroke}" stroke-width="1.8" />
          <path class="anatomy-segment" data-region="Pelvis" d="M 76 160 L 124 160 L 126 184 L 74 184 Z" fill="${skinFill}" stroke="${skinStroke}" stroke-width="1.8" />
        </g>
        <g ${leftArmTransform}><path class="anatomy-segment" data-region="Left Shoulder" d="M 62 76 Q 52 82 48 92" stroke="${skinStroke}" stroke-width="8" fill="none" stroke-linecap="round" /></g>
        <g ${rightArmTransform}><path class="anatomy-segment" data-region="Right Shoulder" d="M 138 76 Q 148 82 152 92" stroke="${skinStroke}" stroke-width="8" fill="none" stroke-linecap="round" /></g>
      </g>
    `;
  }

  bindClickEvents(svg) {
    if (!svg) return;
    svg.querySelectorAll(".anatomy-segment").forEach(seg => {
      seg.addEventListener("click", e => {
        if (this.engine.draggingPinId) return;

        const coords = this.getSVGCoords(e, svg);
        const x = Math.max(0, Math.min(200, coords.x));
        const y = Math.max(0, Math.min(360, coords.y));

        const xPercent = (x / 200) * 100;
        const yPercent = (y / 360) * 100;

        const region = seg.getAttribute("data-region");
        const mappedName = this.engine.getMappedRegionName(region);

        this.engine.pendingPin = {
          x: xPercent,
          y: yPercent,
          region: mappedName,
          view: this.engine.viewType
        };

        this.engine.trigger("pinadded", this.engine.pendingPin);
        this.renderPins(svg.querySelector("#caePinsGroup"));
      });
    });
  }

  getSVGCoords(e, svg) {
    const rect = svg.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = ((clientX - rect.left) / (rect.width || 1)) * 200;
    const y = ((clientY - rect.top) / (rect.height || 1)) * 360;
    return { x, y };
  }

  renderPins(group) {
    if (!group) return;
    group.innerHTML = "";

    this.engine.pins
      .filter(p => p.view === this.engine.viewType)
      .forEach(pin => {
        const pinEl = this.createPinVector(pin.id, (pin.x / 100) * 200, (pin.y / 100) * 360, pin.intensity, false);
        group.appendChild(pinEl);
      });

    if (this.engine.pendingPin && this.engine.pendingPin.view === this.engine.viewType) {
      const pinEl = this.createPinVector("pending", (this.engine.pendingPin.x / 100) * 200, (this.engine.pendingPin.y / 100) * 360, this.engine.pendingPin.intensity || 5, true);
      group.appendChild(pinEl);
    }
  }

  createPinVector(id, x, y, intensity, isPending = false) {
    const color = PAIN_COLORS[intensity] || "#ef4444";
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "cae-pin-group" + (isPending ? " pending" : ""));
    g.setAttribute("transform", `translate(${x}, ${y})`);
    g.dataset.id = id;

    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", "0");
    c.setAttribute("cy", "0");
    c.setAttribute("r", "8");
    c.setAttribute("fill", color);
    c.setAttribute("stroke", "#fff");
    c.setAttribute("stroke-width", "1.5");
    g.appendChild(c);

    this.setupDragHooks(g, id);
    return g;
  }

  setupDragHooks(g, id) {
    const onStart = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.engine.draggingPinId = id;

      document.addEventListener("mousemove", onMove);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("mouseup", onEnd);
      document.addEventListener("touchend", onEnd);
    };

    const onMove = (e) => {
      if (this.engine.draggingPinId !== id) return;
      e.preventDefault();

      const svg = this.engine.stage.querySelector("svg");
      if (!svg) return;

      const coords = this.getSVGCoords(e, svg);
      const x = Math.max(0, Math.min(200, coords.x));
      const y = Math.max(0, Math.min(360, coords.y));

      if (id === "pending") {
        if (this.engine.pendingPin) {
          this.engine.pendingPin.x = (x / 200) * 100;
          this.engine.pendingPin.y = (y / 360) * 100;
        }
      } else {
        const pin = this.engine.pins.find(p => p.id === id);
        if (pin) {
          pin.x = (x / 200) * 100;
          pin.y = (y / 360) * 100;
        }
      }

      g.setAttribute("transform", `translate(${x}, ${y})`);
      this.engine.trigger("pindragged", { id, x: (x / 200) * 100, y: (y / 360) * 100 });
    };

    const onEnd = (e) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchend", onEnd);

      if (this.engine.draggingPinId === id) {
        let clientX, clientY;
        if (e.changedTouches && e.changedTouches.length > 0) {
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
        } else {
          clientX = e.clientX;
          clientY = e.clientY;
        }

        g.style.pointerEvents = "none";
        const element = document.elementFromPoint(clientX, clientY);
        g.style.pointerEvents = "auto";

        const segment = element ? element.closest(".anatomy-segment") : null;
        const region = segment ? segment.getAttribute("data-region") : null;

        if (region) {
          const mappedName = this.engine.getMappedRegionName(region);
          if (id === "pending") {
            if (this.engine.pendingPin) this.engine.pendingPin.region = mappedName;
          } else {
            const pin = this.engine.pins.find(p => p.id === id);
            if (pin) pin.region = mappedName;
          }
        }

        this.engine.draggingPinId = null;
        this.renderPins(this.engine.stage.querySelector("#caePinsGroup"));
        
        if (id !== "pending") {
          const pin = this.engine.pins.find(p => p.id === id);
          if (pin) this.engine.trigger("pinselected", pin);
        }
      }
    };

    g.addEventListener("mousedown", onStart);
    g.addEventListener("touchstart", onStart, { passive: false });
  }
}

window.ClinicalAnatomyEngine = ClinicalAnatomyEngine;
