/**
 * Clinical Anatomy Engine — anatomy plate asset resolution.
 *
 * Packs:
 *   classic   — clinical atlas plates under /anatomy/{model}/{view}.png
 *   metahuman — lifelike MetaHuman-style plates under /anatomy/metahuman/{model}/{view}.png
 *
 * Pack selection is a presentation concern; path resolution stays in CAE.
 */

const ANATOMY_MODELS = ["adult-male", "adult-female", "child", "teen", "senior"];
const ANATOMY_VIEWS = ["front", "back", "left", "right"];
const ANATOMY_PACKS = ["classic", "metahuman"];
const SIMPLE_PAIN_MAP_MODEL = "simple-pain-map";

function normalizeAnatomyModel(modelType) {
  if (modelType === "male") return "adult-male";
  if (modelType === "female") return "adult-female";
  if (modelType === SIMPLE_PAIN_MAP_MODEL || modelType === "simple") return "adult-male";
  return modelType || "adult-male";
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

function getAnatomyPack() {
  return isSimplePainMapShell() ? "metahuman" : "classic";
}

function getAnatomyAssetRoot(packId) {
  const pack = ANATOMY_PACKS.includes(packId) ? packId : getAnatomyPack();
  return pack === "metahuman" ? "/anatomy/metahuman" : "/anatomy";
}

function getAssetPath(modelType, viewType, packId) {
  const view = ANATOMY_VIEWS.includes(viewType) ? viewType : "front";
  const model = normalizeAnatomyModel(modelType);
  const folder = ANATOMY_MODELS.includes(model) ? model : "adult-male";
  const pack = ANATOMY_PACKS.includes(packId) ? packId : getAnatomyPack();
  return `${getAnatomyAssetRoot(pack)}/${folder}/${view}.png`;
}

function getAnatomyThumbPath(modelType) {
  const model = normalizeAnatomyModel(modelType);
  const folder = ANATOMY_MODELS.includes(model) ? model : "adult-male";
  if (getAnatomyPack() === "metahuman") {
    return `/anatomy/metahuman/thumbs/${folder}.png`;
  }
  return getAssetPath(folder, "front", "classic");
}

window.ANATOMY_MODELS = ANATOMY_MODELS;
window.ANATOMY_VIEWS = ANATOMY_VIEWS;
window.ANATOMY_PACKS = ANATOMY_PACKS;
window.SIMPLE_PAIN_MAP_MODEL = SIMPLE_PAIN_MAP_MODEL;
window.getAssetPath = getAssetPath;
window.getAnatomyPack = getAnatomyPack;
window.getAnatomyThumbPath = getAnatomyThumbPath;
window.normalizeAnatomyModel = normalizeAnatomyModel;
window.isSimplePainMapShell = isSimplePainMapShell;
