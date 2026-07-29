/**
 * VisualizationController — base anatomy, reference overlays, pain display, AI overlays.
 */

const REFERENCE_OVERLAY_DEFS = [
  { id: "muscle", label: "Muscle" },
  { id: "skeleton", label: "Skeleton" },
  { id: "nerve", label: "Peripheral Nerves" },
  { id: "organ", label: "Organs" }
];

function overlayAssetPath(overlayId, modelType, viewType, ext = "svg") {
  const model = normalizeModelType(modelType).replace("adult-", "");
  const gender = model.includes("female") ? "female" : "male";
  return `/anatomy/overlays/overlay_${overlayId}_${gender}_${viewType}.${ext}`;
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
    // Vector schematic overlays are always available in CAE.
    this.availableOverlays = new Set(REFERENCE_OVERLAY_DEFS.map(d => d.id));
    this.assetOverlays = new Set();
    this.assetOverlayPaths = new Map();
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
      overlayPath: this.getActiveOverlayPath(),
      useVectorOverlay: true
    };
  }

  getActiveOverlayPath() {
    if (this.referenceOverlay === "none" || !this.engine) return null;
    return this.assetOverlayPaths.get(this.referenceOverlay) || null;
  }

  async refreshAvailability(modelType, viewType) {
    const token = ++this._probeToken;
    const nextAssets = new Set();
    const nextPaths = new Map();
    for (const def of REFERENCE_OVERLAY_DEFS) {
      const svgPath = overlayAssetPath(def.id, modelType, viewType, "svg");
      const pngPath = overlayAssetPath(def.id, modelType, viewType, "png");
      if (await this.assetExists(svgPath)) {
        nextAssets.add(def.id);
        nextPaths.set(def.id, svgPath);
      } else if (await this.assetExists(pngPath)) {
        nextAssets.add(def.id);
        nextPaths.set(def.id, pngPath);
      }
    }
    if (token !== this._probeToken) return;
    this.assetOverlays = nextAssets;
    this.assetOverlayPaths = nextPaths;
    // Keep vector overlays selectable even without PNG/SVG files.
    this.availableOverlays = new Set(REFERENCE_OVERLAY_DEFS.map(d => d.id));
    this.apply();
    this.onChange({ type: "availability", available: [...this.availableOverlays], assets: [...nextAssets] });
    return [...this.availableOverlays];
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
