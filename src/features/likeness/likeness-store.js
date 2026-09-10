/**
 * Patient likeness / body-builder preferences (app layer).
 * Stored locally until a future account + body-scan pipeline exists.
 */

const STORAGE_KEY = "painlocator.likeness.v1";

const BODY_TYPES = [
  { id: "female", model: "female", label: "Woman", folder: "adult-female" },
  { id: "male", model: "male", label: "Man", folder: "adult-male" },
  { id: "teen", model: "teen", label: "Teen", folder: "teen" },
  { id: "child", model: "child", label: "Child", folder: "child" },
  { id: "senior", model: "senior", label: "Elderly", folder: "senior" }
];

/** Facial / appearance presets (MVP — CSS-driven until generative MetaHuman pipeline). */
const FACIAL_PRESETS = [
  { id: "neutral", label: "Neutral", filter: "none" },
  { id: "fair", label: "Fair", filter: "brightness(1.08) saturate(0.92)" },
  { id: "medium", label: "Medium", filter: "brightness(0.92) sepia(0.18) saturate(1.05)" },
  { id: "deep", label: "Deep", filter: "brightness(0.72) sepia(0.35) saturate(1.15)" },
  { id: "warm", label: "Warm", filter: "sepia(0.22) saturate(1.2) hue-rotate(-8deg)" },
  { id: "cool", label: "Cool", filter: "saturate(0.85) hue-rotate(12deg) brightness(1.02)" }
];

const BUILD_PRESETS = [
  { id: "average", label: "Average", scaleX: 1 },
  { id: "slender", label: "Slender", scaleX: 0.92 },
  { id: "athletic", label: "Athletic", scaleX: 1.06 },
  { id: "broad", label: "Broad", scaleX: 1.12 }
];

function defaultLikeness() {
  return {
    pack: "metahuman",
    bodyType: "male",
    facialPreset: "neutral",
    buildPreset: "average",
    likenessPhotoDataUrl: null,
    likenessPhotoName: null,
    scanStatus: "none", // none | queued | coming_soon
    updatedAt: null
  };
}

function loadLikeness() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLikeness();
    return { ...defaultLikeness(), ...JSON.parse(raw) };
  } catch (_) {
    return defaultLikeness();
  }
}

function saveLikeness(partial) {
  const next = {
    ...loadLikeness(),
    ...partial,
    updatedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (_) {
    /* quota / private */
  }
  return next;
}

function clearLikenessPhoto() {
  return saveLikeness({ likenessPhotoDataUrl: null, likenessPhotoName: null });
}

window.LikenessStore = {
  STORAGE_KEY,
  BODY_TYPES,
  FACIAL_PRESETS,
  BUILD_PRESETS,
  defaultLikeness,
  loadLikeness,
  saveLikeness,
  clearLikenessPhoto
};
