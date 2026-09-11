/**
 * Clinical Anatomy Engine — Blender / glTF body drop-in.
 *
 * Loads a standing figure exported from Blender and applies Body DNA through
 * shapekeys (Stature, Shoulders, Waist, Hips, LegBuild, ArmBuild), rig bones,
 * and skin — not a photo tint.
 *
 * Drop order (first file that exists wins):
 *   /anatomy/metahuman/{profile}/body.glb
 *   /anatomy/metahuman/{profile}/figure.glb
 *   /anatomy/metahuman/{profile}/body.gltf
 *   /anatomy/metahuman/body.glb
 *
 * Shipped mesh: public/anatomy/metahuman/body.glb (New-avatar-stand, meshopt).
 */

(function (global) {
const probeHits = new Map();
const templateCache = new Map();
const templateInflight = new Map();

const PART_FACE = /head|skull|face|cranium|cranio/i;
const PART_JAW = /jaw|mandible|chin/i;
const PART_NOSE = /nose|nasal/i;
const PART_CLOTH = /cloth|shirt|tee|tank|short|pant|fabric|denim|cotton|outfit|garment/i;
const PART_HAIR = /hair|brow|lash|beard/i;
const PART_SKIN = /clinical|porcelain|anatomy|skin|body/i;

function metahumanGlbCandidates(modelType) {
  if (typeof getMetahumanGlbCandidates === "function") {
    return getMetahumanGlbCandidates(modelType);
  }
  const folder = typeof metahumanAnatomyFolder === "function"
    ? metahumanAnatomyFolder(modelType)
    : "adult-male";
  return [
    `/anatomy/metahuman/${folder}/body.glb`,
    `/anatomy/metahuman/${folder}/figure.glb`,
    `/anatomy/metahuman/${folder}/body.gltf`,
    "/anatomy/metahuman/body.glb"
  ];
}

function metahumanGlbScale(dna) {
  const d = typeof normalizeBodyDna === "function"
    ? normalizeBodyDna(dna)
    : { height: "average", weight: "average", ancestry: "neutral" };
  const bone = (typeof HEIGHT_BONE !== "undefined" && HEIGHT_BONE[d.height]) || 1;
  const soft = (typeof BUILD_SOFT !== "undefined" && BUILD_SOFT[d.weight]) || 1;
  const anc = (typeof ANCESTRY_MORPH !== "undefined" && ANCESTRY_MORPH[d.ancestry])
    || { hip: 1, limb: 1, faceW: 1, midface: 1, jaw: 1, nose: 1 };
  return {
    x: soft * (anc.hip || 1),
    y: bone,
    z: soft * (anc.limb || 1)
  };
}

function metahumanPartScale(name, dna) {
  const p = typeof resolveBodyProportions === "function"
    ? resolveBodyProportions(dna)
    : null;
  if (!p || !name) return null;
  if (PART_FACE.test(name)) return { x: p.faceW, y: 1, z: p.midface };
  if (PART_JAW.test(name)) return { x: p.jaw, y: 0.92 + 0.08 * p.jaw, z: 0.96 };
  if (PART_NOSE.test(name)) return { x: p.nose, y: p.nose, z: p.nose };
  return null;
}

function metahumanMorphWeights(dna) {
  const d = typeof normalizeBodyDna === "function"
    ? normalizeBodyDna(dna)
    : { height: "average", weight: "average", sex: "male", stage: "adult" };
  const heavy = d.weight === "heavy";
  const slim = d.weight === "slim";
  const female = d.sex === "female";
  return {
    Stature: d.height === "tall" ? 0.9 : 0,
    Shoulders: heavy ? (female ? 0.45 : 0.72) : 0,
    Waist: heavy ? 0.88 : slim ? 0 : 0,
    Hips: heavy ? (female ? 1 : 0.72) : (female && !slim ? 0.28 : 0),
    LegBuild: heavy ? 0.78 : 0,
    ArmBuild: heavy ? 0.7 : 0
  };
}

function metahumanRigBoneScale(name, dna) {
  const p = typeof resolveBodyProportions === "function"
    ? resolveBodyProportions(dna)
    : null;
  if (!p || !name) return null;
  const d = p.dna || {};
  const n = String(name).toLowerCase();
  const bone = (typeof HEIGHT_BONE !== "undefined" && HEIGHT_BONE[d.height]) || 1;
  const soft = (typeof BUILD_SOFT !== "undefined" && BUILD_SOFT[d.weight]) || 1;
  if (n === "head") return { x: p.faceW, y: 1, z: p.midface };
  if (n === "neck_01" || n === "neck") {
    return { x: (p.faceW + 1) / 2, y: 1, z: (p.midface + 1) / 2 };
  }
  if (n === "pelvis") {
    const hip = (typeof ANCESTRY_MORPH !== "undefined"
      && ANCESTRY_MORPH[d.ancestry]
      && ANCESTRY_MORPH[d.ancestry].hip) || 1;
    return { x: soft * hip, y: 1, z: soft };
  }
  if (n === "spine_01") return { x: soft, y: bone, z: soft };
  if (n.startsWith("spine")) return { x: soft, y: 1, z: soft };
  if (n.startsWith("thigh") || n.startsWith("calf")) return { x: soft, y: bone, z: soft };
  if (n.includes("upperarm") || n.includes("lowerarm") || n.startsWith("clavicle")) {
    return { x: soft, y: p.limb, z: soft };
  }
  return null;
}

function _probeUrl(url) {
  if (!url) return Promise.resolve(null);
  if (probeHits.has(url)) return Promise.resolve(probeHits.get(url) ? url : null);
  if (typeof fetch !== "function") return Promise.resolve(null);
  return fetch(url, { method: "HEAD", cache: "force-cache" }).then((res) => {
    if (res.ok) {
      probeHits.set(url, true);
      return url;
    }
    if (res.status === 405 || res.status === 501) {
      return fetch(url, { method: "GET", cache: "force-cache" }).then((getRes) => {
        probeHits.set(url, !!getRes.ok);
        return getRes.ok ? url : null;
      });
    }
    probeHits.set(url, false);
    return null;
  }).catch(() => {
    probeHits.set(url, false);
    return null;
  });
}

function findMetahumanGlb(modelType) {
  if (global.CAE_METAHUMAN_GLB_URL) {
    return Promise.resolve(String(global.CAE_METAHUMAN_GLB_URL));
  }
  const list = metahumanGlbCandidates(modelType);
  return list.reduce(
    (prev, url) => prev.then((hit) => hit || _probeUrl(url)),
    Promise.resolve(null)
  );
}

function _importVendor(path) {
  if (typeof SpatialThreeLoader !== "undefined" && SpatialThreeLoader.importVendor) {
    return SpatialThreeLoader.importVendor(path);
  }
  const boot = global.SpatialBootUtils
    || (typeof globalThis !== "undefined" ? globalThis.SpatialBootUtils : null);
  if (boot && typeof boot.importVendorModule === "function") {
    return boot.importVendorModule(path);
  }
  return Promise.reject(new Error("GLTFLoader vendor import unavailable"));
}

function _getGltfLoader() {
  return _importVendor("/vendor/GLTFLoader.js").then((mod) => {
    const Loader = mod.GLTFLoader || (mod.default && mod.default.GLTFLoader);
    if (!Loader) throw new Error("GLTFLoader export missing");
    const loader = new Loader();
    return _importVendor("/vendor/meshopt_decoder.module.js").then((meshMod) => {
      const decoder = meshMod.MeshoptDecoder
        || (meshMod.default && meshMod.default.MeshoptDecoder)
        || meshMod.default;
      if (decoder && typeof loader.setMeshoptDecoder === "function") {
        return Promise.resolve(decoder.ready || Promise.resolve()).then(() => {
          loader.setMeshoptDecoder(decoder);
          return loader;
        });
      }
      return loader;
    }).catch(() => loader);
  });
}

function loadMetahumanGlbTemplate(url) {
  if (!url) return Promise.reject(new Error("GLB url required"));
  if (templateCache.has(url)) return Promise.resolve(templateCache.get(url));
  if (templateInflight.has(url)) return templateInflight.get(url);
  const work = _getGltfLoader().then((loader) => loader.loadAsync(url)).then((gltf) => {
    const scene = gltf.scene || (gltf.scenes && gltf.scenes[0]);
    if (!scene) throw new Error("GLB has no scene");
    const packed = { scene, gltf };
    templateCache.set(url, packed);
    return packed;
  }).finally(() => {
    templateInflight.delete(url);
  });
  templateInflight.set(url, work);
  return work;
}

function _detachMaterials(root) {
  const seen = new Map();
  root.traverse((obj) => {
    if (!obj.material) return;
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    const next = list.map((mat) => {
      if (!mat || typeof mat.clone !== "function") return mat;
      if (seen.has(mat)) return seen.get(mat);
      const cloned = mat.clone();
      seen.set(mat, cloned);
      return cloned;
    });
    obj.material = Array.isArray(obj.material) ? next : next[0];
  });
}

function _cloneSkinnedGraph(THREE, source) {
  const root = source.clone(true);
  const named = new Map();
  root.traverse((obj) => {
    if (obj.name) named.set(obj.name, obj);
  });
  root.traverse((obj) => {
    if (!obj.isSkinnedMesh || !obj.skeleton) return;
    const bones = obj.skeleton.bones.map((bone) => named.get(bone.name) || bone);
    const inverses = obj.skeleton.boneInverses.map((m) => m.clone());
    obj.bind(new THREE.Skeleton(bones, inverses), obj.bindMatrix.clone());
    obj.frustumCulled = false;
    if (obj.morphTargetInfluences) {
      obj.morphTargetInfluences = obj.morphTargetInfluences.slice();
    }
  });
  return root;
}

function _isClothingMaterial(obj, mat) {
  const name = `${obj && obj.name ? obj.name : ""} ${mat && mat.name ? mat.name : ""}`;
  if (PART_SKIN.test(name)) return false;
  if (PART_CLOTH.test(name) || PART_HAIR.test(name)) return true;
  const color = mat && mat.color;
  if (!color) return false;
  const r = color.r;
  const g = color.g;
  const b = color.b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (max - min) < 0.06 && lum > 0.22 && lum < 0.86;
}

function _tintSkin(root, dna) {
  const p = typeof resolveBodyProportions === "function"
    ? resolveBodyProportions(dna)
    : null;
  if (!p || !p.skinRgb) return;
  const d = p.dna || {};
  if (d.skin === "natural") return;
  const tr = p.skinRgb[0] / 255;
  const tg = p.skinRgb[1] / 255;
  const tb = p.skinRgb[2] / 255;
  root.traverse((obj) => {
    if (!obj.material) return;
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    list.forEach((mat) => {
      if (!mat || !mat.color || _isClothingMaterial(obj, mat)) return;
      mat.color.setRGB(
        mat.color.r * 0.42 + tr * 0.58,
        mat.color.g * 0.42 + tg * 0.58,
        mat.color.b * 0.42 + tb * 0.58
      );
    });
  });
}

function _applyMorphs(root, dna) {
  const weights = metahumanMorphWeights(dna);
  root.traverse((obj) => {
    if (!obj.morphTargetInfluences) return;
    const dict = obj.morphTargetDictionary || {};
    Object.keys(weights).forEach((key) => {
      const idx = dict[key];
      if (idx == null) return;
      obj.morphTargetInfluences[idx] = weights[key];
    });
  });
}

function _hasClinicalRig(root) {
  let found = false;
  root.traverse((obj) => {
    const n = String(obj.name || "").toLowerCase();
    if (n === "pelvis" || n === "head" || n === "thigh_l") found = true;
  });
  return found;
}

function _applyRigBones(root, dna) {
  root.traverse((obj) => {
    const scale = metahumanRigBoneScale(obj.name, dna);
    if (!scale || !obj.scale) return;
    obj.scale.x *= scale.x;
    obj.scale.y *= scale.y;
    obj.scale.z *= scale.z;
  });
}

function _applyNamedParts(root, dna) {
  root.traverse((obj) => {
    if (!obj.isMesh && !obj.isGroup) return;
    const scale = metahumanPartScale(obj.name, dna);
    if (!scale || !obj.scale) return;
    obj.scale.x *= scale.x;
    obj.scale.y *= scale.y;
    obj.scale.z *= scale.z;
  });
}

function _standUpright(THREE, root) {
  root.updateMatrixWorld(true);
  const box = metahumanBodyBox(THREE, root);
  const size = box.getSize(new THREE.Vector3());
  if (size.y + 1e-6 < size.z * 0.88) {
    root.rotation.x -= Math.PI / 2;
    root.updateMatrixWorld(true);
  }
}

function _stageUniform(dna) {
  const d = typeof normalizeBodyDna === "function" ? normalizeBodyDna(dna) : {};
  const table = typeof STAGE_STATURE !== "undefined" ? STAGE_STATURE : null;
  if (!table || !table.adult) return 1;
  const sex = d.sex === "female" ? "female" : "male";
  const stage = table[d.stage] || table.adult;
  const adult = table.adult[sex] || 1.76;
  const now = stage[sex] || adult;
  const sexMul = sex === "female" ? 0.97 : 1;
  return (now / adult) * sexMul;
}

function applyDnaToGlbRoot(THREE, root, dna) {
  if (!THREE || !root) return root;
  const d = typeof normalizeBodyDna === "function" ? normalizeBodyDna(dna) : {};
  const hasMorphs = (() => {
    let hit = false;
    root.traverse((obj) => {
      if (obj.morphTargetDictionary && obj.morphTargetDictionary.Stature != null) hit = true;
    });
    return hit;
  })();
  const hasRig = _hasClinicalRig(root);
  root.scale.multiplyScalar(_stageUniform(dna));
  if (hasMorphs) {
    _applyMorphs(root, dna);
    if (d.height === "short") {
      root.scale.y *= (typeof HEIGHT_BONE !== "undefined" ? HEIGHT_BONE.short : 0.92);
    }
  }
  if (hasRig) {
    const rigDna = hasMorphs
      ? { ...d, height: "average", weight: "average" }
      : d;
    _applyRigBones(root, rigDna);
  } else if (!hasMorphs) {
    const scale = metahumanGlbScale(dna);
    root.scale.x *= scale.x;
    root.scale.y *= scale.y;
    root.scale.z *= scale.z;
    _applyNamedParts(root, dna);
  }
  _tintSkin(root, dna);
  _standUpright(THREE, root);
  root.userData.caeSource = "blender-glb";
  return root;
}

function metahumanBodyBox(THREE, root) {
  const box = new THREE.Box3();
  let skinned = false;
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!obj.isSkinnedMesh) return;
    skinned = true;
    if (obj.skeleton && obj.skeleton.update) obj.skeleton.update();
    if (typeof obj.computeBoundingBox === "function") obj.computeBoundingBox();
    if (obj.boundingBox && !obj.boundingBox.isEmpty()) {
      box.union(obj.boundingBox.clone().applyMatrix4(obj.matrixWorld));
    }
  });
  if (!skinned || box.isEmpty()) box.setFromObject(root);
  return box;
}

function cloneMetahumanGlbBody(THREE, dna, url) {
  return loadMetahumanGlbTemplate(url).then((packed) => {
    const root = _cloneSkinnedGraph(THREE, packed.scene);
    root.name = root.name || "caeBlenderBody";
    _detachMaterials(root);
    applyDnaToGlbRoot(THREE, root, dna);
    return root;
  });
}

function clearMetahumanGlbCache() {
  probeHits.clear();
  templateCache.clear();
  templateInflight.clear();
}

global.metahumanGlbCandidates = metahumanGlbCandidates;
global.metahumanGlbScale = metahumanGlbScale;
global.metahumanPartScale = metahumanPartScale;
global.metahumanMorphWeights = metahumanMorphWeights;
global.metahumanRigBoneScale = metahumanRigBoneScale;
global.findMetahumanGlb = findMetahumanGlb;
global.cloneMetahumanGlbBody = cloneMetahumanGlbBody;
global.applyDnaToGlbRoot = applyDnaToGlbRoot;
global.metahumanBodyBox = metahumanBodyBox;
global.clearMetahumanGlbCache = clearMetahumanGlbCache;
})(typeof window !== "undefined" ? window : globalThis);
