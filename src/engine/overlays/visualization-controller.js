/**
 * VisualizationController — base anatomy, reference overlays, pain display, AI overlays.
 */

const REFERENCE_OVERLAY_DEFS = [
  { id: "muscle", label: "Muscle" },
  { id: "skeleton", label: "Skeleton" },
  { id: "nerve", label: "Peripheral Nerves" },
  { id: "organ", label: "Organs" }
];

function overlayAssetPath(overlayId, modelType, viewType) {
  const model = normalizeModelType(modelType).replace("adult-", "");
  const gender = model.includes("female") ? "female" : "male";
  return `public/anatomy/overlays/overlay_${overlayId}_${gender}_${viewType}.png`;
}

class VisualizationController {
  constructor(options = {}) {
    this.engine = options.engine || null;
    this.onChange = options.onChange || (() => {});
    this.baseMode = "standard";
    this.referenceOverlay = "none";
    this.aiOverlays = {
      suggested: false,
      referred: false,
      dermatomes: false,
      myotomes: false
    };
    this.availableOverlays = new Set();
    this._probeToken = 0;
  }

  attachEngine(engine) {
    this.engine = engine;
    this.apply();
  }

  setBaseMode(mode) {
    if (!["standard", "heatmap", "reference"].includes(mode)) return;
    this.baseMode = mode;
    if (mode !== "reference") this.referenceOverlay = "none";
    this.apply();
    this.onChange({ type: "baseMode", value: mode });
  }

  setReferenceOverlay(overlayId) {
    if (overlayId !== "none" && !this.availableOverlays.has(overlayId)) return;
    this.referenceOverlay = overlayId;
    if (overlayId !== "none") this.baseMode = "reference";
    this.apply();
    this.onChange({ type: "referenceOverlay", value: overlayId });
  }

  setAIOverlay(key, enabled) {
    if (!(key in this.aiOverlays)) return;
    this.aiOverlays[key] = !!enabled;
    this.apply();
    this.onChange({ type: "aiOverlay", key, enabled: !!enabled });
  }

  getState() {
    return {
      baseMode: this.baseMode,
      referenceOverlay: this.referenceOverlay,
      aiOverlays: { ...this.aiOverlays },
      availableOverlays: [...this.availableOverlays],
      overlayPath: this.getActiveOverlayPath()
    };
  }

  getActiveOverlayPath() {
    if (this.referenceOverlay === "none" || !this.engine) return null;
    if (!this.availableOverlays.has(this.referenceOverlay)) return null;
    return overlayAssetPath(this.referenceOverlay, this.engine.modelType, this.engine.viewType);
  }

  async refreshAvailability(modelType, viewType) {
    const token = ++this._probeToken;
    const next = new Set();
    for (const def of REFERENCE_OVERLAY_DEFS) {
      const path = overlayAssetPath(def.id, modelType, viewType);
      if (await this.assetExists(path)) next.add(def.id);
    }
    if (token !== this._probeToken) return;
    this.availableOverlays = next;
    if (this.referenceOverlay !== "none" && !next.has(this.referenceOverlay)) {
      this.referenceOverlay = "none";
      if (this.baseMode === "reference") this.baseMode = "standard";
    }
    this.apply();
    this.onChange({ type: "availability", available: [...next] });
    return [...next];
  }

  assetExists(url) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0);
      img.onerror = () => resolve(false);
      img.src = `${url}?probe=${Date.now()}`;
    });
  }

  apply() {
    if (!this.engine) return;
    const patch = {
      visualization: this.getState()
    };
    if (this.baseMode === "heatmap") patch.painStyle = "heatmap";
    this.engine.update(patch);
  }

  getOverlayDefsForUI() {
    return REFERENCE_OVERLAY_DEFS.filter(d => this.availableOverlays.has(d.id));
  }
}

window.VisualizationController = VisualizationController;
window.REFERENCE_OVERLAY_DEFS = REFERENCE_OVERLAY_DEFS;
window.overlayAssetPath = overlayAssetPath;
