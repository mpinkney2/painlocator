/**
 * Clinical Anatomy Engine — MetaHuman plate baker.
 *
 * Prefers a Blender / glTF mesh dropped at
 * /anatomy/metahuman/{profile}/body.glb. Identity DNA without a mesh keeps
 * the captured stills. The parametric capsule figure is not used on the
 * patient map — it is only a last-resort lab hook.
 */

(function (global) {
const BAKE_W = 768;
const BAKE_H = 1152;
const bakeCache = new Map();
const bakeInflight = new Map();

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

function _resolveBody(mod, dna) {
  const model = (dna && dna.model) || "adult-male";
  const findGlb = typeof findMetahumanGlb === "function"
    ? findMetahumanGlb
    : () => Promise.resolve(null);
  return findGlb(model).then((url) => {
    if (url && typeof cloneMetahumanGlbBody === "function") {
      return cloneMetahumanGlbBody(mod, dna, url);
    }
    if (global.CAE_ALLOW_PARAMETRIC_METAHUMAN && typeof buildParametricBody === "function") {
      return buildParametricBody(mod, dna);
    }
    return null;
  });
}

function bakeMetahumanPlate(dna, view, THREE) {
  const key = typeof bodyDnaKey === "function" ? bodyDnaKey(dna, view) : String(view);
  if (bakeCache.has(key)) return Promise.resolve(bakeCache.get(key));
  if (bakeInflight.has(key)) return bakeInflight.get(key);

  const work = Promise.resolve(THREE || _loadThree()).then((mod) => {
    return _resolveBody(mod, dna).then((body) => {
      if (!body) throw new Error("no blender mesh");

      const scene = new mod.Scene();
      scene.background = null;
      body.rotation.y += _viewYaw(view);
      scene.add(body);

      const hemi = new mod.HemisphereLight(0xfff4ea, 0xd8d2c8, 1.05);
      scene.add(hemi);
      const keyL = new mod.DirectionalLight(0xfff7f0, 1.05);
      keyL.position.set(1.4, 2.4, 2.2);
      scene.add(keyL);
      const fill = new mod.DirectionalLight(0xe8eef6, 0.45);
      fill.position.set(-1.6, 1.4, 1.2);
      scene.add(fill);
      const rim = new mod.DirectionalLight(0xf4f7ff, 0.28);
      rim.position.set(-0.4, 1.8, -2.2);
      scene.add(rim);

      body.updateMatrixWorld(true);
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
      if (mod.ACESFilmicToneMapping) renderer.toneMapping = mod.ACESFilmicToneMapping;

      const aspect = BAKE_W / BAKE_H;
      const pad = 1.08;
      const halfH = Math.max(size.y * 0.5 * pad, (size.x * 0.5 * pad) / aspect);
      const halfW = halfH * aspect;
      const camera = new mod.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 16);
      camera.position.set(center.x, center.y, center.z + 6);
      camera.lookAt(center);

      renderer.render(scene, camera);
      const url = canvas.toDataURL("image/png");
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose && m.dispose());
        }
      });
      bakeCache.set(key, url);
      return url;
    });
  }).finally(() => {
    bakeInflight.delete(key);
  });

  bakeInflight.set(key, work);
  return work;
}

function currentEngineDna(modelType) {
  const like = typeof getLikenessPref === "function" ? getLikenessPref() : {};
  return resolveBodyDna(modelType, like);
}

function _keepStill(img, fallbackPath) {
  if (typeof bindPlateImageSrc === "function" && fallbackPath) {
    bindPlateImageSrc(img, fallbackPath);
    return Promise.resolve(fallbackPath);
  }
  if (fallbackPath) img.src = fallbackPath;
  return Promise.resolve(fallbackPath || null);
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
  const findGlb = typeof findMetahumanGlb === "function"
    ? findMetahumanGlb
    : () => Promise.resolve(null);

  return findGlb(model).then((glbUrl) => {
    if (!glbUrl) return _keepStill(img, fallbackPath);
    const gen = Number(img.dataset.mhGen || 0) + 1;
    img.dataset.mhGen = String(gen);
    return bakeMetahumanPlate(dna, vw).then((url) => {
      if (img.dataset.mhGen !== String(gen)) return url;
      img.src = url;
      img.dataset.mhBaked = "1";
      img.dataset.mhMesh = "glb";
      return url;
    }).catch((err) => {
      console.warn("[cae-metahuman] blender bake failed", err);
      if (img.dataset) img.dataset.mhError = String(err && err.message ? err.message : err);
      return _keepStill(img, fallbackPath);
    });
  }).catch(() => _keepStill(img, fallbackPath));
}

function refreshMetahumanFigure() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".cae-anatomy-image").forEach((img) => {
    const path = img.dataset.plateSrc;
    applyMetahumanEnginePlate(img, path, img.dataset.mhModel, img.dataset.mhView);
  });
}

global.bakeMetahumanPlate = bakeMetahumanPlate;
global.applyMetahumanEnginePlate = applyMetahumanEnginePlate;
global.refreshMetahumanFigure = refreshMetahumanFigure;
global.currentEngineDna = currentEngineDna;
})(typeof window !== "undefined" ? window : globalThis);
