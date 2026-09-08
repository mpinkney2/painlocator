/**
 * Clinical Anatomy Engine — anatomy plate asset resolution.
 */

const ANATOMY_MODELS = ["adult-male", "adult-female", "child", "teen", "senior"];
const ANATOMY_VIEWS = ["front", "back", "left", "right"];
const SIMPLE_PAIN_MAP_MODEL = "simple-pain-map";

function normalizeAnatomyModel(modelType) {
  if (modelType === "male") return "adult-male";
  if (modelType === "female") return "adult-female";
  if (modelType === SIMPLE_PAIN_MAP_MODEL || modelType === "simple") return SIMPLE_PAIN_MAP_MODEL;
  return modelType || "adult-male";
}

function getAnatomyAssetRoot() {
  return '/anatomy';
}

function isSimplePainMapShell() {
  try {
    if (typeof document !== "undefined" && document.body?.classList?.contains("simple-pain-map")) {
      return true;
    }
    if (typeof state !== "undefined" && state?.presentationMode === "patient") {
      return true;
    }
  } catch (_) { /* ignore */ }
  return false;
}

function getAssetPath(modelType, viewType) {
  const view = ANATOMY_VIEWS.includes(viewType) ? viewType : 'front';
  // Simple pain-chart uses realistic studio person plates (not CAE placeholder plates).
  if (isSimplePainMapShell() || modelType === SIMPLE_PAIN_MAP_MODEL || modelType === "simple") {
    return `${getAnatomyAssetRoot()}/${SIMPLE_PAIN_MAP_MODEL}/${view}.png`;
  }
  const model = normalizeAnatomyModel(modelType);
  const folder = ANATOMY_MODELS.includes(model) ? model : 'adult-male';
  return `${getAnatomyAssetRoot()}/${folder}/${view}.png`;
}

window.ANATOMY_MODELS = ANATOMY_MODELS;
window.ANATOMY_VIEWS = ANATOMY_VIEWS;
window.SIMPLE_PAIN_MAP_MODEL = SIMPLE_PAIN_MAP_MODEL;
window.getAssetPath = getAssetPath;
window.normalizeAnatomyModel = normalizeAnatomyModel;
window.isSimplePainMapShell = isSimplePainMapShell;
