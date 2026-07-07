/**
 * Anatomical region map — normalized polygon coordinates (0–1).
 * Architecture supports refinement without changing the marker model.
 */

const ANATOMY_REGIONS = {
  front: [
    { id: "front-head", label: "Head", patientLabel: "Head", physicianLabel: "Cranium & facial structures", layer: "skin", polygon: [[0.38,0.02],[0.62,0.02],[0.62,0.14],[0.38,0.14]] },
    { id: "front-neck", label: "Neck", patientLabel: "Neck", physicianLabel: "Cervical spine", layer: "muscle", polygon: [[0.42,0.14],[0.58,0.14],[0.58,0.20],[0.42,0.20]] },
    { id: "front-chest", label: "Chest", patientLabel: "Chest", physicianLabel: "Pectoralis / sternum", layer: "muscle", polygon: [[0.30,0.20],[0.70,0.20],[0.70,0.38],[0.30,0.38]] },
    { id: "front-abdomen", label: "Abdomen", patientLabel: "Abdomen", physicianLabel: "Rectus abdominis / epigastrium", layer: "muscle", polygon: [[0.34,0.38],[0.66,0.38],[0.66,0.52],[0.34,0.52]] },
    { id: "front-lumbar", label: "Lower abdomen / lumbar referral", patientLabel: "Lower abdomen", physicianLabel: "Lumbar / pelvic referral", layer: "muscle", polygon: [[0.36,0.48],[0.64,0.48],[0.64,0.58],[0.36,0.58]] },
    { id: "front-pelvis", label: "Pelvis", patientLabel: "Hips", physicianLabel: "Sacroiliac / pelvic girdle", layer: "skeleton", polygon: [[0.32,0.52],[0.68,0.52],[0.68,0.62],[0.32,0.62]] },
    { id: "front-suprapubic", label: "Suprapubic pelvis", patientLabel: "Suprapubic pelvis", physicianLabel: "Suprapubic / pubic symphysis", layer: "organ", polygon: [[0.40,0.52],[0.60,0.52],[0.60,0.60],[0.40,0.60]], bounds: { x1: 0.40, y1: 0.52, x2: 0.60, y2: 0.60 } },
    { id: "front-l-inguinal", label: "Left groin", patientLabel: "Left groin", physicianLabel: "Left inguinal region", layer: "muscle", polygon: [[0.38,0.58],[0.48,0.58],[0.48,0.68],[0.38,0.68]], bounds: { x1: 0.38, y1: 0.58, x2: 0.48, y2: 0.68 } },
    { id: "front-r-inguinal", label: "Right groin", patientLabel: "Right groin", physicianLabel: "Right inguinal region", layer: "muscle", polygon: [[0.52,0.58],[0.62,0.58],[0.62,0.68],[0.52,0.68]], bounds: { x1: 0.52, y1: 0.58, x2: 0.62, y2: 0.68 } },
    { id: "front-l-hip-flexor", label: "Left hip flexor", patientLabel: "Left hip flexor", physicianLabel: "L-iliopsoas / hip flexor", layer: "muscle", polygon: [[0.34,0.54],[0.46,0.54],[0.46,0.66],[0.34,0.66]], bounds: { x1: 0.34, y1: 0.54, x2: 0.46, y2: 0.66 } },
    { id: "front-r-hip-flexor", label: "Right hip flexor", patientLabel: "Right hip flexor", physicianLabel: "R-iliopsoas / hip flexor", layer: "muscle", polygon: [[0.54,0.54],[0.66,0.54],[0.66,0.66],[0.54,0.66]], bounds: { x1: 0.54, y1: 0.54, x2: 0.66, y2: 0.66 } },
    { id: "front-l-shoulder", label: "Left shoulder", patientLabel: "Left shoulder", physicianLabel: "L-acromion", layer: "muscle", polygon: [[0.18,0.20],[0.32,0.20],[0.32,0.32],[0.18,0.32]] },
    { id: "front-r-shoulder", label: "Right shoulder", patientLabel: "Right shoulder", physicianLabel: "R-acromion", layer: "muscle", polygon: [[0.68,0.20],[0.82,0.20],[0.82,0.32],[0.68,0.32]] },
    { id: "front-l-arm", label: "Left arm", patientLabel: "Left arm", physicianLabel: "L-humerus / biceps", layer: "muscle", polygon: [[0.08,0.28],[0.22,0.28],[0.22,0.48],[0.08,0.48]] },
    { id: "front-r-arm", label: "Right arm", patientLabel: "Right arm", physicianLabel: "R-humerus / biceps", layer: "muscle", polygon: [[0.78,0.28],[0.92,0.28],[0.92,0.48],[0.78,0.48]] },
    { id: "front-l-hand", label: "Left hand", patientLabel: "Left hand", physicianLabel: "L-carpi / metacarpals", layer: "skin", polygon: [[0.04,0.46],[0.14,0.46],[0.14,0.56],[0.04,0.56]] },
    { id: "front-r-hand", label: "Right hand", patientLabel: "Right hand", physicianLabel: "R-carpi / metacarpals", layer: "skin", polygon: [[0.86,0.46],[0.96,0.46],[0.96,0.56],[0.86,0.56]] },
    { id: "front-l-leg", label: "Left leg", patientLabel: "Left leg", physicianLabel: "L-femur / quadriceps", layer: "muscle", polygon: [[0.34,0.60],[0.48,0.60],[0.48,0.88],[0.34,0.88]] },
    { id: "front-r-leg", label: "Right leg", patientLabel: "Right leg", physicianLabel: "R-femur / quadriceps", layer: "muscle", polygon: [[0.52,0.60],[0.66,0.60],[0.66,0.88],[0.52,0.88]] },
    { id: "front-l-foot", label: "Left foot", patientLabel: "Left foot", physicianLabel: "L-tarsals / calcaneus", layer: "skin", polygon: [[0.32,0.86],[0.48,0.86],[0.48,0.98],[0.32,0.98]] },
    { id: "front-r-foot", label: "Right foot", patientLabel: "Right foot", physicianLabel: "R-tarsals / calcaneus", layer: "skin", polygon: [[0.52,0.86],[0.68,0.86],[0.68,0.98],[0.52,0.98]] }
  ],
  back: [
    { id: "back-head", label: "Head", patientLabel: "Head", physicianLabel: "Occipital / cranium", layer: "skin", polygon: [[0.38,0.02],[0.62,0.02],[0.62,0.14],[0.38,0.14]] },
    { id: "back-neck", label: "Neck", patientLabel: "Neck", physicianLabel: "Cervical spine", layer: "skeleton", polygon: [[0.42,0.14],[0.58,0.14],[0.58,0.20],[0.42,0.20]] },
    { id: "back-upper", label: "Upper back", patientLabel: "Upper back", physicianLabel: "Thoracic spine", layer: "skeleton", polygon: [[0.30,0.20],[0.70,0.20],[0.70,0.38],[0.30,0.38]] },
    { id: "back-lumbar", label: "Lower back", patientLabel: "Lower back", physicianLabel: "Lumbar spine", layer: "skeleton", polygon: [[0.34,0.38],[0.66,0.38],[0.66,0.54],[0.34,0.54]] },
    { id: "back-pelvis", label: "Pelvis", patientLabel: "Hips", physicianLabel: "Sacroiliac", layer: "skeleton", polygon: [[0.32,0.52],[0.68,0.52],[0.68,0.62],[0.32,0.62]] },
    { id: "back-l-leg", label: "Left leg", patientLabel: "Left leg", physicianLabel: "L-hamstring / gluteal", layer: "muscle", polygon: [[0.34,0.60],[0.48,0.60],[0.48,0.88],[0.34,0.88]] },
    { id: "back-r-leg", label: "Right leg", patientLabel: "Right leg", physicianLabel: "R-hamstring / gluteal", layer: "muscle", polygon: [[0.52,0.60],[0.66,0.60],[0.66,0.88],[0.52,0.88]] }
  ],
  left: [
    { id: "left-head", label: "Head", patientLabel: "Head", physicianLabel: "Cranium (lateral)", layer: "skin", polygon: [[0.38,0.02],[0.62,0.02],[0.62,0.14],[0.38,0.14]] },
    { id: "left-torso", label: "Torso", patientLabel: "Side torso", physicianLabel: "Lateral thoracoabdominal", layer: "muscle", polygon: [[0.32,0.18],[0.68,0.18],[0.68,0.58],[0.32,0.58]] },
    { id: "left-arm", label: "Arm", patientLabel: "Left arm", physicianLabel: "L-upper extremity", layer: "muscle", polygon: [[0.20,0.22],[0.42,0.22],[0.42,0.52],[0.20,0.52]] },
    { id: "left-leg", label: "Leg", patientLabel: "Left leg", physicianLabel: "L-lower extremity", layer: "muscle", polygon: [[0.36,0.56],[0.58,0.56],[0.58,0.92],[0.36,0.92]] }
  ],
  right: [
    { id: "right-head", label: "Head", patientLabel: "Head", physicianLabel: "Cranium (lateral)", layer: "skin", polygon: [[0.38,0.02],[0.62,0.02],[0.62,0.14],[0.38,0.14]] },
    { id: "right-torso", label: "Torso", patientLabel: "Side torso", physicianLabel: "R-lateral thoracoabdominal", layer: "muscle", polygon: [[0.32,0.18],[0.68,0.18],[0.68,0.58],[0.32,0.58]] },
    { id: "right-arm", label: "Arm", patientLabel: "Right arm", physicianLabel: "R-upper extremity", layer: "muscle", polygon: [[0.58,0.22],[0.80,0.22],[0.80,0.52],[0.58,0.52]] },
    { id: "right-leg", label: "Leg", patientLabel: "Right leg", physicianLabel: "R-lower extremity", layer: "muscle", polygon: [[0.42,0.56],[0.64,0.56],[0.64,0.92],[0.42,0.92]] }
  ]
};

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonCentroid(polygon) {
  let x = 0, y = 0;
  polygon.forEach(p => { x += p[0]; y += p[1]; });
  return { x: x / polygon.length, y: y / polygon.length };
}

function findRegionAt(view, x, y, layer) {
  const regions = ANATOMY_REGIONS[view] || [];
  let hit = regions.find(r => pointInPolygon(x, y, r.polygon));
  if (!hit && layer) {
    hit = regions.find(r => r.layer === layer && pointInPolygon(x, y, r.polygon));
  }
  if (!hit) {
    let best = null, bestDist = Infinity;
    regions.forEach(r => {
      const c = polygonCentroid(r.polygon);
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bestDist) { bestDist = d; best = r; }
    });
    hit = best;
  }
  return hit;
}

function getRegionLabel(region, physicianMode) {
  if (!region) return "Unspecified region";
  return physicianMode ? (region.physicianLabel || region.label) : (region.patientLabel || region.label);
}

function mirrorRegionId(regionId, view) {
  if (!regionId) return null;
  const pairs = [
    ["front-l-", "front-r-"], ["back-l-", "back-r-"],
    ["left-", "right-"], ["right-", "left-"]
  ];
  for (const [a, b] of pairs) {
    if (regionId.startsWith(a)) return b + regionId.slice(a.length);
    if (regionId.startsWith(b)) return a + regionId.slice(b.length);
  }
  return regionId;
}

function getRegionDisplayLabel(region, physicianMode) {
  if (!region) return "Unspecified region";
  if (region.patientLabel || region.physicianLabel) {
    return physicianMode ? (region.physicianLabel || region.patientLabel) : (region.patientLabel || region.physicianLabel);
  }
  return getRegionLabel(region, physicianMode);
}

function mapAnatomyAt(view, x, y, layer, physicianMode) {
  const hit = findRegionAt(view, x, y, layer);
  if (!hit) return { regionId: null, patientLabel: "Unspecified", physicianLabel: "Unspecified region", anatomyLayer: layer || "skin" };
  return {
    regionId: hit.id,
    patientLabel: hit.patientLabel || hit.label,
    physicianLabel: hit.physicianLabel || hit.label,
    anatomyLayer: hit.layer || layer || "skin"
  };
}

window.ANATOMY_REGIONS = ANATOMY_REGIONS;
window.findRegionAt = findRegionAt;
window.getRegionLabel = getRegionLabel;
window.mirrorRegionId = mirrorRegionId;
window.getRegionDisplayLabel = getRegionDisplayLabel;
window.mapAnatomyAt = mapAnatomyAt;
