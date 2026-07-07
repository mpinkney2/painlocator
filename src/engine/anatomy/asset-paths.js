/**
 * Clinical Anatomy Engine — anatomy plate asset resolution.
 */

const ANATOMY_MODELS = ["adult-male", "adult-female", "child", "teen", "senior"];
const ANATOMY_VIEWS = ["front", "back", "left", "right"];

function normalizeAnatomyModel(modelType) {
  if (modelType === "male") return "adult-male";
  if (modelType === "female") return "adult-female";
  return modelType || "adult-male";
}

function getAnatomyAssetRoot() {
  return '/anatomy';
}

function getAssetPath(modelType, viewType) {
  const model = normalizeAnatomyModel(modelType);
  const view = ANATOMY_VIEWS.includes(viewType) ? viewType : 'front';
  const folder = ANATOMY_MODELS.includes(model) ? model : 'adult-male';
  return `${getAnatomyAssetRoot()}/${folder}/${view}.png`;
}

window.ANATOMY_MODELS = ANATOMY_MODELS;
window.ANATOMY_VIEWS = ANATOMY_VIEWS;
window.getAssetPath = getAssetPath;
window.normalizeAnatomyModel = normalizeAnatomyModel;
