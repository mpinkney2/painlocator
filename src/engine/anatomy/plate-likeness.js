/**
 * Clinical Anatomy Engine — plate likeness (skin shader + build/height).
 *
 * Sex × life-stage plates stay the coordinate frame. Likeness is a presentation
 * layer: a skin-tone shader that preserves gray clothing, plus CSS scale for
 * weight (scaleX) and height (uniform scale). Not a combinatorial asset factory.
 */

const LIKENESS_STORAGE_KEY = "painlocator_likeness";

const SKIN_PRESETS = {
  natural: { id: "natural", label: "As shown", target: null, strength: 0 },
  fair: { id: "fair", label: "Fair", target: [238, 208, 188], strength: 0.58 },
  light: { id: "light", label: "Light", target: [222, 178, 148], strength: 0.54 },
  olive: { id: "olive", label: "Olive", target: [184, 146, 104], strength: 0.56 },
  tan: { id: "tan", label: "Tan", target: [166, 112, 76], strength: 0.6 },
  brown: { id: "brown", label: "Brown", target: [116, 72, 48], strength: 0.64 },
  deep: { id: "deep", label: "Deep", target: [64, 40, 30], strength: 0.68 }
};

const WEIGHT_SCALES = { slim: 0.88, average: 1, heavy: 1.12 };
const HEIGHT_SCALES = { short: 0.88, average: 0.96, tall: 1 };

const _tintCache = new Map();
const _tintInflight = new Map();
const _blobUrls = new Set();

function normalizeLikeness(partial) {
  const src = partial && typeof partial === "object" ? partial : {};
  const skin = SKIN_PRESETS[src.skin] ? src.skin : "natural";
  const weight = Object.prototype.hasOwnProperty.call(WEIGHT_SCALES, src.weight)
    ? src.weight
    : "average";
  const height = Object.prototype.hasOwnProperty.call(HEIGHT_SCALES, src.height)
    ? src.height
    : "average";
  return { skin, weight, height };
}

function getLikenessPref() {
  try {
    const raw = typeof localStorage !== "undefined"
      ? localStorage.getItem(LIKENESS_STORAGE_KEY)
      : null;
    return normalizeLikeness(raw ? JSON.parse(raw) : {});
  } catch (_) {
    return normalizeLikeness({});
  }
}

function setLikenessPref(partial) {
  const next = normalizeLikeness({ ...getLikenessPref(), ...(partial || {}) });
  try {
    localStorage.setItem(LIKENESS_STORAGE_KEY, JSON.stringify(next));
  } catch (_) { /* ignore */ }
  applyLikenessPresentation();
  return next;
}

function applyLikenessPresentation(root) {
  const doc = root || (typeof document !== "undefined" ? document : null);
  if (!doc?.body) return getLikenessPref();
  const pref = getLikenessPref();
  const body = doc.body;
  if (body.style && typeof body.style.setProperty === "function") {
    const w = WEIGHT_SCALES[pref.weight];
    const h = HEIGHT_SCALES[pref.height];
    const contain = Math.min(1, 1 / Math.max(w, 1), 1 / Math.max(h, 1));
    body.style.setProperty("--spm-weight", String(w));
    body.style.setProperty("--spm-height", String(h));
    body.style.setProperty("--spm-fit-x", String(w * contain));
    body.style.setProperty("--spm-fit-y", String(h * contain));
  }
  if (typeof body.setAttribute === "function") {
    body.setAttribute("data-spm-skin", pref.skin);
    body.setAttribute("data-spm-weight", pref.weight);
    body.setAttribute("data-spm-height", pref.height);
  }
  return pref;
}

function recolorPlatePixels(data, _width, _height, preset) {
  if (!data || !preset || !preset.target) return data;
  const tr = preset.target[0];
  const tg = preset.target[1];
  const tb = preset.target[2];
  const strength = preset.strength || 0;
  const tLum = 0.2126 * tr + 0.7152 * tg + 0.0722 * tb;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 16) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const chroma = max - min;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // Gray heather tee/shorts and other achromatic fabric — leave untouched.
    if (chroma < 26 && lum > 55 && lum < 220) continue;
    const hair = lum < 52 && chroma < 45;
    const skinness = hair ? 0.22 : Math.min(1, chroma / 40);
    if (skinness < 0.08) continue;
    const t = strength * skinness;
    const newLum = lum * (1 - t) + tLum * t;
    const srcR = r / (lum + 0.001);
    const srcG = g / (lum + 0.001);
    const srcB = b / (lum + 0.001);
    const tgtR = tr / (tLum + 0.001);
    const tgtG = tg / (tLum + 0.001);
    const tgtB = tb / (tLum + 0.001);
    const chromaMix = t * 0.72;
    data[i] = Math.max(0, Math.min(255, newLum * (srcR * (1 - chromaMix) + tgtR * chromaMix)));
    data[i + 1] = Math.max(0, Math.min(255, newLum * (srcG * (1 - chromaMix) + tgtG * chromaMix)));
    data[i + 2] = Math.max(0, Math.min(255, newLum * (srcB * (1 - chromaMix) + tgtB * chromaMix)));
  }
  return data;
}

function _cacheKey(src, skin) {
  return String(src) + "|" + String(skin);
}

function tintPlateSrc(src, skin) {
  const preset = SKIN_PRESETS[skin];
  if (!src || !preset || !preset.target) {
    return Promise.resolve(src);
  }
  const key = _cacheKey(src, skin);
  if (_tintCache.has(key)) return Promise.resolve(_tintCache.get(key));
  if (_tintInflight.has(key)) return _tintInflight.get(key);

  const work = new Promise((resolve, reject) => {
    if (typeof Image === "undefined" || typeof document === "undefined") {
      resolve(src);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx || !canvas.width || !canvas.height) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        recolorPlatePixels(imageData.data, canvas.width, canvas.height, preset);
        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(src);
            return;
          }
          const url = URL.createObjectURL(blob);
          _blobUrls.add(url);
          _tintCache.set(key, url);
          resolve(url);
        }, "image/png");
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  }).then((url) => {
    _tintInflight.delete(key);
    return url;
  }, (err) => {
    _tintInflight.delete(key);
    return src;
  });

  _tintInflight.set(key, work);
  return work;
}

function applyLikenessToImageElement(img, platePath, gen) {
  if (!img || !platePath) return Promise.resolve();
  img.dataset.plateSrc = platePath;
  const token = gen != null ? String(gen) : img.dataset.likenessGen || "0";
  const pref = getLikenessPref();
  if (pref.skin === "natural" || !SKIN_PRESETS[pref.skin]?.target) {
    img.src = platePath;
    return Promise.resolve(platePath);
  }
  return tintPlateSrc(platePath, pref.skin).then((url) => {
    if (img.dataset.likenessGen && img.dataset.likenessGen !== token) return url;
    img.src = url;
    return url;
  });
}

function bindPlateImageSrc(img, path) {
  if (!img || !path) return;
  img.dataset.plateSrc = path;
  const gen = Number(img.dataset.likenessGen || 0) + 1;
  img.dataset.likenessGen = String(gen);
  applyLikenessToImageElement(img, path, gen);
}

function refreshPlateLikeness() {
  applyLikenessPresentation();
  if (typeof document === "undefined") return;
  document.querySelectorAll(".cae-anatomy-image[data-plate-src]").forEach((img) => {
    bindPlateImageSrc(img, img.dataset.plateSrc);
  });
}

window.LIKENESS_STORAGE_KEY = LIKENESS_STORAGE_KEY;
window.SKIN_PRESETS = SKIN_PRESETS;
window.WEIGHT_SCALES = WEIGHT_SCALES;
window.HEIGHT_SCALES = HEIGHT_SCALES;
window.normalizeLikeness = normalizeLikeness;
window.getLikenessPref = getLikenessPref;
window.setLikenessPref = setLikenessPref;
window.applyLikenessPresentation = applyLikenessPresentation;
window.recolorPlatePixels = recolorPlatePixels;
window.tintPlateSrc = tintPlateSrc;
window.applyLikenessToImageElement = applyLikenessToImageElement;
window.bindPlateImageSrc = bindPlateImageSrc;
window.refreshPlateLikeness = refreshPlateLikeness;

if (typeof document !== "undefined" && document.body) {
  applyLikenessPresentation();
}
