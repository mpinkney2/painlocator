/**
 * Clinical Anatomy Engine — MetaHuman variation engine.
 *
 * Bakes orthographic plates from a parametric body. Identity DNA (neutral
 * ancestry, natural skin, average build/height) keeps the captured MetaHuman
 * stills. Any Appearance change rebuilds geometry — it does not tint or
 * CSS-scale the still.
 */

const BAKE_W = 768;
const BAKE_H = 1152;
const _bakeCache = new Map();
const _inflight = new Map();
const _blobUrls = new Set();

function _viewYaw(view) {
  if (view === "back") return Math.PI;
  if (view === "left") return Math.PI * 0.5;
  if (view === "right") return -Math.PI * 0.5;
  return 0;
}

function _loadThree() {
  if (typeof SpatialThreeLoader !== "undefined" && SpatialThreeLoader.loadThreeModule) {
    return SpatialThreeLoader.loadThreeModule();
  }
  if (typeof window !== "undefined" && window.SpatialThreeLoader?.loadThreeModule) {
    return window.SpatialThreeLoader.loadThreeModule();
  }
  return Promise.reject(new Error("SpatialThreeLoader unavailable"));
}

function bakeMetahumanPlate(dna, view, THREE) {
  const key = typeof bodyDnaKey === "function" ? bodyDnaKey(dna, view) : String(view);
  if (_bakeCache.has(key)) return Promise.resolve(_bakeCache.get(key));
  if (_inflight.has(key)) return _inflight.get(key);

  const work = Promise.resolve(THREE || _loadThree()).then((mod) => {
    const body = buildParametricBody(mod, dna);
    if (!body) throw new Error("parametric body failed");

    const scene = new mod.Scene();
    scene.background = null;
    body.rotation.y = _viewYaw(view);
    scene.add(body);

    const hemi = new mod.HemisphereLight(0xfff4ea, 0xd8d2c8, 0.95);
    scene.add(hemi);
    const keyL = new mod.DirectionalLight(0xfff7f0, 0.85);
    keyL.position.set(1.4, 2.4, 2.2);
    scene.add(keyL);
    const fill = new mod.DirectionalLight(0xe8eef6, 0.35);
    fill.position.set(-1.6, 1.4, 1.2);
    scene.add(fill);

    const box = new mod.Box3().setFromObject(body);
    const size = box.getSize(new mod.Vector3());
    const center = box.getCenter(new mod.Vector3());
    const canvas = document.createElement("canvas");
    canvas.width = BAKE_W;
    canvas.height = BAKE_H;
    const renderer = new mod.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(BAKE_W, BAKE_H, false);
    renderer.outputColorSpace = mod.SRGBColorSpace || renderer.outputColorSpace;

    const aspect = BAKE_W / BAKE_H;
    const pad = 1.08;
    const halfH = Math.max(size.y * 0.5 * pad, (size.x * 0.5 * pad) / aspect);
    const halfW = halfH * aspect;
    const camera = new mod.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 8);
    camera.position.set(center.x, center.y, center.z + 3);
    camera.lookAt(center);

    renderer.render(scene, camera);
    const url = canvas.toDataURL("image/png");
    renderer.dispose();
    scene.traverse((obj) => {
      if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose && m.dispose());
      }
    });
    _bakeCache.set(key, url);
    return url;
  }).finally(() => {
    _inflight.delete(key);
  });

  _inflight.set(key, work);
  return work;
}

function currentEngineDna(modelType) {
  const like = typeof getLikenessPref === "function" ? getLikenessPref() : {};
  return resolveBodyDna(modelType, like);
}

function applyMetahumanEnginePlate(img, fallbackPath, modelType, view) {
  if (!img) return Promise.resolve(null);
  const model = modelType
    || img.dataset.mhModel
    || (typeof state !== "undefined" ? state.modelType : "adult-male");
  const vw = view || img.dataset.mhView || "front";
  img.dataset.mhModel = model;
  img.dataset.mhView = vw;
  if (fallbackPath) {
    img.dataset.plateSrc = fallbackPath;
    img.src = fallbackPath;
  }

  const dna = currentEngineDna(model);
  if (typeof isIdentityDna === "function" && isIdentityDna(dna)) {
    if (typeof bindPlateImageSrc === "function" && fallbackPath) {
      bindPlateImageSrc(img, fallbackPath);
    }
    return Promise.resolve(fallbackPath);
  }

  const gen = Number(img.dataset.mhGen || 0) + 1;
  img.dataset.mhGen = String(gen);
  return bakeMetahumanPlate(dna, vw).then((url) => {
    if (img.dataset.mhGen !== String(gen)) return url;
    img.src = url;
    img.dataset.mhBaked = "1";
    return url;
  }).catch(() => {
    if (fallbackPath && img.dataset.mhGen === String(gen)) img.src = fallbackPath;
    return fallbackPath;
  });
}

function refreshMetahumanFigure() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".cae-anatomy-image").forEach((img) => {
    const path = img.dataset.plateSrc;
    applyMetahumanEnginePlate(img, path, img.dataset.mhModel, img.dataset.mhView);
  });
}

window.bakeMetahumanPlate = bakeMetahumanPlate;
window.applyMetahumanEnginePlate = applyMetahumanEnginePlate;
window.refreshMetahumanFigure = refreshMetahumanFigure;
window.currentEngineDna = currentEngineDna;
