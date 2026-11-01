/**
 * Clinical Anatomy Engine — anatomy plate asset resolution.
 *
 * Packs:
 *   classic   — clinical atlas plates under /anatomy/{model}/{view}.png
 *   metahuman — lifelike MetaHuman-style plates under /anatomy/metahuman/{model}/{view}.png
 *
 * Pack selection is a presentation concern; path resolution stays in CAE.
 *
 * Simple Pain Map uses an 8-profile sex × life-stage matrix. Classic clinician
 * plates stay on the original 5 folders (teen/child/senior are not sexed).
 */

const ANATOMY_MODELS = [
  "adult-male",
  "adult-female",
  "teen-male",
  "teen-female",
  "child-male",
  "child-female",
  "senior-male",
  "senior-female"
];
const ANATOMY_STAGES = ["adult", "teen", "child", "senior"];
const ANATOMY_SEXES = ["male", "female"];
const ANATOMY_VIEWS = ["front", "back", "left", "right"];
const ANATOMY_PACKS = ["classic", "metahuman"];
const SIMPLE_PAIN_MAP_MODEL = "simple-pain-map";

const MODEL_ALIASES = {
  male: "adult-male",
  female: "adult-female",
  man: "adult-male",
  woman: "adult-female",
  child: "child-male",
  teen: "teen-male",
  senior: "senior-male",
  elderly: "senior-male",
  simple: "adult-male",
  [SIMPLE_PAIN_MAP_MODEL]: "adult-male"
};

function normalizeAnatomyModel(modelType) {
  if (modelType && typeof modelType === "object") {
    return "adult-male";
  }
  if (MODEL_ALIASES[modelType]) return MODEL_ALIASES[modelType];
  if (ANATOMY_MODELS.includes(modelType)) return modelType;
  return modelType || "adult-male";
}

function composeBodyModel(stage, sex) {
  const life = ANATOMY_STAGES.includes(stage) ? stage : "adult";
  const bodySex = sex === "female" ? "female" : "male";
  return `${life}-${bodySex}`;
}

function parseBodyProfile(modelType) {
  const model = normalizeAnatomyModel(modelType);
  const sex = String(model).includes("female") ? "female" : "male";
  let stage = "adult";
  if (String(model).startsWith("teen")) stage = "teen";
  else if (String(model).startsWith("child")) stage = "child";
  else if (String(model).startsWith("senior")) stage = "senior";
  const canonical = ANATOMY_MODELS.includes(model) ? model : composeBodyModel(stage, sex);
  return { stage, sex, model: canonical };
}

function clinicianRadioValue(modelType) {
  const { stage, sex } = parseBodyProfile(modelType);
  if (stage === "adult") return sex === "female" ? "female" : "male";
  return stage;
}

function classicAnatomyFolder(modelType) {
  const { stage, model } = parseBodyProfile(modelType);
  if (stage === "adult") return model;
  return stage;
}

function metahumanAnatomyFolder(modelType) {
  const { model } = parseBodyProfile(modelType);
  return ANATOMY_MODELS.includes(model) ? model : "adult-male";
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
  const pack = ANATOMY_PACKS.includes(packId) ? packId : getAnatomyPack();
  const folder = pack === "classic"
    ? classicAnatomyFolder(modelType)
    : metahumanAnatomyFolder(modelType);
  return `${getAnatomyAssetRoot(pack)}/${folder}/${view}.png`;
}

function getAnatomyThumbPath(modelType) {
  if (getAnatomyPack() === "metahuman") {
    const folder = metahumanAnatomyFolder(modelType);
    return `/anatomy/metahuman/thumbs/${folder}.png`;
  }
  return getAssetPath(modelType, "front", "classic");
}

/**
 * Blender / glTF drop-in paths for a profile. First existing file wins.
 * Export from Blender as glTF Binary (.glb), +Y up, applied transforms.
 */
function getMetahumanGlbCandidates(modelType) {
  const folder = metahumanAnatomyFolder(modelType);
  const root = getAnatomyAssetRoot("metahuman");
  return [
    `${root}/${folder}/body.glb`,
    `${root}/${folder}/figure.glb`,
    `${root}/${folder}/body.gltf`,
    `${root}/body.glb`
  ];
}

function getMetahumanGlbPath(modelType) {
  return getMetahumanGlbCandidates(modelType)[0];
}

window.ANATOMY_MODELS = ANATOMY_MODELS;
window.ANATOMY_STAGES = ANATOMY_STAGES;
window.ANATOMY_SEXES = ANATOMY_SEXES;
window.ANATOMY_VIEWS = ANATOMY_VIEWS;
window.ANATOMY_PACKS = ANATOMY_PACKS;
window.SIMPLE_PAIN_MAP_MODEL = SIMPLE_PAIN_MAP_MODEL;
window.getAssetPath = getAssetPath;
window.getAnatomyPack = getAnatomyPack;
window.getAnatomyThumbPath = getAnatomyThumbPath;
window.normalizeAnatomyModel = normalizeAnatomyModel;
window.composeBodyModel = composeBodyModel;
window.parseBodyProfile = parseBodyProfile;
window.clinicianRadioValue = clinicianRadioValue;
window.classicAnatomyFolder = classicAnatomyFolder;
window.metahumanAnatomyFolder = metahumanAnatomyFolder;
window.getMetahumanGlbCandidates = getMetahumanGlbCandidates;
window.getMetahumanGlbPath = getMetahumanGlbPath;
window.isSimplePainMapShell = isSimplePainMapShell;
