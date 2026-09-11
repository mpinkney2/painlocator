/**
 * Clinical Anatomy Engine — parametric MetaHuman mesh.
 *
 * Builds a clothed standing figure from resolveBodyProportions(). Soft tissue,
 * bone lengths, and craniofacial scales are independent. Requires a Three.js
 * module (passed in) — CAE does not import Three at the top level.
 */

function _rgb(THREE, rgb, extras) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255),
    roughness: 0.62,
    metalness: 0.02,
    ...(extras || {})
  });
  return mat;
}

function _mesh(THREE, geo, mat, name, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = false;
  m.receiveShadow = false;
  m.position.set(x, y, z);
  if (sx != null) m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
  return m;
}

function buildParametricBody(THREE, dna) {
  const p = typeof resolveBodyProportions === "function"
    ? resolveBodyProportions(dna)
    : null;
  if (!THREE || !p) return null;

  const skin = _rgb(THREE, p.skinRgb, { roughness: 0.55 });
  const cloth = _rgb(THREE, p.clothingRgb, { roughness: 0.86 });
  const hair = _rgb(THREE, p.hairRgb, { roughness: 0.78 });
  const root = new THREE.Group();
  root.name = "caeMetahumanBody";

  const footH = p.footLen * 0.28;
  const shinY = footH + p.shinLen * 0.5;
  const kneeY = footH + p.shinLen;
  const thighY = kneeY + p.thighLen * 0.5;
  const hipY = kneeY + p.thighLen;
  const pelvisY = hipY + p.pelvisH * 0.35;
  const waistY = hipY + p.pelvisH + p.torsoLen * 0.28;
  const chestY = hipY + p.pelvisH + p.torsoLen * 0.68;
  const shoulderY = hipY + p.pelvisH + p.torsoLen;
  const neckY = shoulderY + p.neckLen * 0.5;
  const headY = shoulderY + p.neckLen + p.headR * 0.92;
  const lean = p.kyphosis;

  const hipSpread = p.hipW * 0.28;
  const shoulderSpread = p.shoulderW * 0.5;

  root.add(_mesh(THREE, new THREE.SphereGeometry(p.headR, 28, 20), skin, "head",
    0, headY, lean * 0.4, p.headW, 1, p.midface));
  root.add(_mesh(THREE, new THREE.SphereGeometry(p.headR * 0.42, 16, 12), skin, "jaw",
    0, headY - p.headR * 0.55, p.headR * 0.18, p.jaw, 0.7, 0.85));
  root.add(_mesh(THREE, new THREE.SphereGeometry(p.headR * 0.16 * p.nose, 10, 8), skin, "nose",
    0, headY - p.headR * 0.08, p.headR * 0.82 * p.midface));
  root.add(_mesh(THREE, new THREE.SphereGeometry(p.headR * 1.02, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hair, "hair", 0, headY + p.headR * 0.12, lean * 0.3, p.headW, 0.7, 1));

  root.add(_mesh(THREE, new THREE.CylinderGeometry(p.neckR * 0.85, p.neckR, p.neckLen, 16),
    skin, "neck", 0, neckY, lean * 0.2));

  root.add(_mesh(THREE, new THREE.CapsuleGeometry(p.chestW * 0.38, p.torsoLen * 0.42, 8, 18),
    cloth, "torso", 0, chestY, lean + p.chestD * 0.08, 1, 1, p.chestD / (p.chestW * 0.7)));
  root.add(_mesh(THREE, new THREE.SphereGeometry(p.waistW * 0.42, 20, 14),
    cloth, "waist", 0, waistY, lean * 0.5, 1, 0.7, 0.85));
  root.add(_mesh(THREE, new THREE.SphereGeometry(p.hipW * 0.42, 22, 16),
    cloth, "shorts", 0, pelvisY, 0, 1.05, 0.72, 0.9));

  ["L", "R"].forEach((side) => {
    const s = side === "L" ? -1 : 1;
    root.add(_mesh(THREE, new THREE.SphereGeometry(p.armGirth * 1.35, 12, 10),
      skin, "shoulder" + side, s * shoulderSpread, shoulderY - p.armGirth, lean * 0.3));
    root.add(_mesh(THREE, new THREE.CapsuleGeometry(p.armGirth, p.upperArmLen * 0.72, 6, 12),
      skin, "upperArm" + side, s * (shoulderSpread + p.armGirth * 0.4),
      shoulderY - p.upperArmLen * 0.55, lean * 0.15));
    root.add(_mesh(THREE, new THREE.CapsuleGeometry(p.armGirth * 0.85, p.forearmLen * 0.7, 6, 12),
      skin, "forearm" + side, s * (shoulderSpread + p.armGirth * 0.55),
      shoulderY - p.upperArmLen - p.forearmLen * 0.4, 0.01));
    root.add(_mesh(THREE, new THREE.SphereGeometry(p.armGirth * 1.15, 10, 8),
      skin, "hand" + side, s * (shoulderSpread + p.armGirth * 0.55),
      shoulderY - p.upperArmLen - p.forearmLen * 0.85, 0.03));

    root.add(_mesh(THREE, new THREE.CapsuleGeometry(p.thighGirth, p.thighLen * 0.62, 6, 14),
      cloth, "thighShort" + side, s * hipSpread, thighY + p.thighLen * 0.12, 0));
    root.add(_mesh(THREE, new THREE.CapsuleGeometry(p.thighGirth * 0.95, p.thighLen * 0.45, 6, 14),
      skin, "thigh" + side, s * hipSpread, thighY - p.thighLen * 0.12, 0));
    root.add(_mesh(THREE, new THREE.CapsuleGeometry(p.shinGirth, p.shinLen * 0.7, 6, 12),
      skin, "shin" + side, s * hipSpread, shinY, 0));
    root.add(_mesh(THREE, new THREE.BoxGeometry(p.footLen * 0.42, footH, p.footLen),
      skin, "foot" + side, s * hipSpread, footH * 0.5, p.footLen * 0.18));
  });

  root.userData.stature = p.stature;
  root.userData.proportions = p;
  return root;
}

window.buildParametricBody = buildParametricBody;
