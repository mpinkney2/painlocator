/**
 * Clinical Anatomy Engine — anatomy plate asset resolution.
 *
 * Packs:
 *   classic   — clinical atlas plates under /anatomy/{model}/{view}.png
 *   metahuman — lifelike MetaHuman-style plates under /anatomy/metahuman/{model}/{view}.png
 *
 * Pack selection is presentation/app concern; resolution stays in CAE so
 * future apps can reuse the same path logic without PainLocator UI.
 */

const ANATOMY_MODELS = ["adult-male", "adult-female", "child", "teen", "senior"];
const ANATOMY_VIEWS = ["front", "back", "left", "right"];
const ANATOMY_PACKS = ["classic", "metahuman"];
const ANATOMY_PACK_STORAGE_KEY = "painlocator.anatomyPack";

let _anatomyPack = "metahuman";

function normalizeAnatomyModel(modelType) {
  if (modelType === "male") return "adult-male";
  if (modelType === "female") return "adult-female";
  return modelType || "adult-male";
}

function normalizeAnatomyPack(packId) {
  return ANATOMY_PACKS.includes(packId) ? packId : "classic";
}

function getAnatomyPack() {
  return _anatomyPack;
}

function setAnatomyPack(packId) {
  _anatomyPack = normalizeAnatomyPack(packId);
  try {
    localStorage.setItem(ANATOMY_PACK_STORAGE_KEY, _anatomyPack);
  } catch (_) {
    /* private mode */
  }
  return _anatomyPack;
}

function loadStoredAnatomyPack() {
  try {
    const stored = localStorage.getItem(ANATOMY_PACK_STORAGE_KEY);
    if (stored) _anatomyPack = normalizeAnatomyPack(stored);
  } catch (_) {
    /* ignore */
  }
  return _anatomyPack;
}

function getAnatomyAssetRoot(packId) {
  const pack = normalizeAnatomyPack(packId || _anatomyPack);
  return pack === "metahuman" ? "/anatomy/metahuman" : "/anatomy";
}

function getAssetPath(modelType, viewType, packId) {
  const model = normalizeAnatomyModel(modelType);
  const view = ANATOMY_VIEWS.includes(viewType) ? viewType : "front";
  const folder = ANATOMY_MODELS.includes(model) ? model : "adult-male";
  return `${getAnatomyAssetRoot(packId)}/${folder}/${view}.png`;
}

function getAnatomyThumbPath(modelType, packId) {
  const model = normalizeAnatomyModel(modelType);
  const folder = ANATOMY_MODELS.includes(model) ? model : "adult-male";
  const pack = normalizeAnatomyPack(packId || _anatomyPack);
  if (pack === "metahuman") {
    return `/anatomy/metahuman/thumbs/${folder}.png`;
  }
  return getAssetPath(folder, "front", "classic");
}

loadStoredAnatomyPack();

window.ANATOMY_MODELS = ANATOMY_MODELS;
window.ANATOMY_VIEWS = ANATOMY_VIEWS;
window.ANATOMY_PACKS = ANATOMY_PACKS;
window.getAssetPath = getAssetPath;
window.getAnatomyAssetRoot = getAnatomyAssetRoot;
window.getAnatomyPack = getAnatomyPack;
window.setAnatomyPack = setAnatomyPack;
window.loadStoredAnatomyPack = loadStoredAnatomyPack;
window.getAnatomyThumbPath = getAnatomyThumbPath;
window.normalizeAnatomyModel = normalizeAnatomyModel;
window.normalizeAnatomyPack = normalizeAnatomyPack;
