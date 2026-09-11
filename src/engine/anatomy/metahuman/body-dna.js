/**
 * Clinical Anatomy Engine — MetaHuman body DNA.
 *
 * A DNA vector is the reusable input to the variation engine. It is not a
 * CSS scale and not a pixel tint: resolveBodyProportions() returns bone
 * lengths, soft-tissue girth, and craniofacial metrics that the baker uses
 * to build a new mesh.
 */

(function (global) {
const BODY_ANCESTRY = {
  neutral: { id: "neutral", label: "As shown" },
  european: { id: "european", label: "European" },
  "east-asian": { id: "east-asian", label: "East Asian" },
  "south-asian": { id: "south-asian", label: "South Asian" },
  african: { id: "african", label: "African" },
  latino: { id: "latino", label: "Latino" }
};

const SKIN_RGB = {
  natural: [210, 168, 138],
  fair: [238, 208, 188],
  light: [222, 178, 148],
  olive: [184, 146, 104],
  tan: [166, 112, 76],
  brown: [116, 72, 48],
  deep: [64, 40, 30]
};

const STAGE_STATURE = {
  child: { male: 1.22, female: 1.18 },
  teen: { male: 1.62, female: 1.58 },
  adult: { male: 1.76, female: 1.63 },
  senior: { male: 1.7, female: 1.57 }
};

const HEIGHT_BONE = { short: 0.92, average: 1, tall: 1.08 };
const BUILD_SOFT = { slim: 0.82, average: 1, heavy: 1.22 };

const ANCESTRY_MORPH = {
  neutral: { faceW: 1, jaw: 1, nose: 1, midface: 1, limb: 1, hip: 1 },
  european: { faceW: 0.94, jaw: 0.96, nose: 1.08, midface: 1.04, limb: 1, hip: 0.98 },
  "east-asian": { faceW: 1.08, jaw: 1.04, nose: 0.9, midface: 0.94, limb: 0.96, hip: 1.02 },
  "south-asian": { faceW: 1.02, jaw: 1.02, nose: 1.04, midface: 0.98, limb: 0.98, hip: 1 },
  african: { faceW: 1.06, jaw: 1.08, nose: 1.12, midface: 0.96, limb: 1.04, hip: 1.04 },
  latino: { faceW: 1.02, jaw: 1.02, nose: 1.02, midface: 0.99, limb: 0.99, hip: 1.03 }
};

function _profileOf(modelType) {
  if (typeof parseBodyProfile === "function") return parseBodyProfile(modelType);
  const raw = String(modelType || "adult-male");
  return {
    sex: raw.includes("female") ? "female" : "male",
    stage: raw.startsWith("teen")
      ? "teen"
      : raw.startsWith("child")
        ? "child"
        : raw.startsWith("senior")
          ? "senior"
          : "adult",
    model: raw
  };
}

function normalizeBodyDna(partial) {
  const src = partial && typeof partial === "object" ? partial : {};
  const profile = _profileOf(src.model || src.modelType);
  const ancestry = BODY_ANCESTRY[src.ancestry] ? src.ancestry : "neutral";
  const skin = SKIN_RGB[src.skin] ? src.skin : "natural";
  const weight = Object.prototype.hasOwnProperty.call(BUILD_SOFT, src.weight)
    ? src.weight
    : "average";
  const height = Object.prototype.hasOwnProperty.call(HEIGHT_BONE, src.height)
    ? src.height
    : "average";
  return {
    sex: profile.sex,
    stage: profile.stage,
    model: profile.model,
    ancestry,
    skin,
    weight,
    height
  };
}

function resolveBodyDna(modelType, likeness) {
  const like = likeness && typeof likeness === "object" ? likeness : {};
  return normalizeBodyDna({
    model: modelType,
    ancestry: like.ancestry,
    skin: like.skin,
    weight: like.weight,
    height: like.height
  });
}

function isIdentityDna(dna) {
  const d = normalizeBodyDna(dna);
  return d.ancestry === "neutral"
    && d.skin === "natural"
    && d.weight === "average"
    && d.height === "average";
}

function bodyDnaKey(dna, view) {
  const d = normalizeBodyDna(dna);
  return [d.model, d.ancestry, d.skin, d.weight, d.height, view || "front"].join("|");
}

/**
 * Anthropometric metrics in meters. Tall/short change bone lengths.
 * Slim/heavy change soft-tissue girth. Ancestry changes craniofacial
 * and limb/hip ratios. None of these is a uniform scale of a photo.
 */
function resolveBodyProportions(dna) {
  const d = normalizeBodyDna(dna);
  const female = d.sex === "female";
  const child = d.stage === "child";
  const teen = d.stage === "teen";
  const senior = d.stage === "senior";
  const bone = HEIGHT_BONE[d.height];
  const soft = BUILD_SOFT[d.weight];
  const anc = ANCESTRY_MORPH[d.ancestry] || ANCESTRY_MORPH.neutral;

  const refStature = STAGE_STATURE[d.stage][d.sex];
  const stature = refStature * bone;

  const headShare = child ? 0.195 : teen ? 0.145 : 0.13;
  const headR = refStature * headShare * 0.48 * anc.faceW;
  const neckLen = stature * (child ? 0.04 : 0.055);
  const neckR = headR * (female ? 0.38 : 0.42);

  const shoulderW = refStature * (female ? 0.215 : 0.245) * (0.7 + 0.3 * soft) * (senior ? 0.96 : 1);
  const hipW = refStature * (female ? 0.2 : 0.175) * (0.72 + 0.28 * soft) * anc.hip;
  const chestW = shoulderW * (female ? 0.72 : 0.78);
  const chestD = chestW * (female ? 0.62 : 0.7) * (0.85 + 0.15 * soft);
  const waistW = hipW * (female ? 0.78 : 0.88) * (0.7 + 0.3 * soft);

  const torsoLen = stature * (child ? 0.32 : 0.3);
  const pelvisH = stature * 0.08;
  const upperArmLen = stature * 0.16 * anc.limb;
  const forearmLen = stature * 0.145 * anc.limb;
  const armGirth = refStature * (female ? 0.028 : 0.032) * soft;
  const thighLen = stature * (child ? 0.2 : 0.235) * anc.limb;
  const shinLen = stature * (child ? 0.2 : 0.22) * anc.limb;
  const thighGirth = refStature * (female ? 0.055 : 0.052) * soft;
  const shinGirth = thighGirth * 0.72;
  const footLen = stature * 0.08;

  const kyphosis = senior ? 0.04 : 0;
  const skin = SKIN_RGB[d.skin] || SKIN_RGB.natural;

  return {
    dna: d,
    stature,
    headR,
    headW: anc.faceW,
    faceW: anc.faceW,
    limb: anc.limb,
    jaw: anc.jaw,
    nose: anc.nose,
    midface: anc.midface,
    neckLen,
    neckR,
    shoulderW,
    hipW,
    chestW,
    chestD,
    waistW,
    torsoLen,
    pelvisH,
    upperArmLen,
    forearmLen,
    armGirth,
    thighLen,
    shinLen,
    thighGirth,
    shinGirth,
    footLen,
    kyphosis,
    skinRgb: skin,
    clothingRgb: [168, 172, 178],
    hairRgb: child ? [62, 42, 32] : [28, 22, 20]
  };
}

global.BODY_ANCESTRY = BODY_ANCESTRY;
global.SKIN_RGB = SKIN_RGB;
global.STAGE_STATURE = STAGE_STATURE;
global.HEIGHT_BONE = HEIGHT_BONE;
global.BUILD_SOFT = BUILD_SOFT;
global.ANCESTRY_MORPH = ANCESTRY_MORPH;
global.normalizeBodyDna = normalizeBodyDna;
global.resolveBodyDna = resolveBodyDna;
global.isIdentityDna = isIdentityDna;
global.bodyDnaKey = bodyDnaKey;
global.resolveBodyProportions = resolveBodyProportions;
})(typeof window !== "undefined" ? window : globalThis);
