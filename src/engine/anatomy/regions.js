/**
 * Anatomical region map — normalized polygon coordinates (0–1) on the
 * current adult plates (full-body front / back / left / right).
 *
 * Front view uses anatomical convention: viewer-left is the patient's RIGHT.
 * Back view keeps viewer-left as the patient's left.
 * A point outside every polygon stays unmapped and asks the patient to confirm.
 */

const UNMAPPED_REGION_LABEL = "Unmapped – please confirm";

function box(x1, y1, x2, y2) {
  return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
}

function region(id, patientLabel, physicianLabel, layer, polygon, side) {
  return {
    id,
    label: patientLabel,
    patientLabel,
    physicianLabel,
    layer,
    side,
    polygon
  };
}

/** Patient-right parts sit on the viewer's left (smaller x) on the front plate. */
const FRONT_REGIONS = [
  region("front-r-hand", "Right hand", "Right wrist and hand", "skin", box(0.262, 0.500, 0.345, 0.585), "right"),
  region("front-l-hand", "Left hand", "Left wrist and hand", "skin", box(0.655, 0.500, 0.735, 0.585), "left"),
  region("front-r-elbow", "Right elbow", "Right elbow", "muscle", box(0.268, 0.355, 0.360, 0.445), "right"),
  region("front-l-elbow", "Left elbow", "Left elbow", "muscle", box(0.640, 0.355, 0.732, 0.445), "left"),
  region("front-r-forearm", "Right forearm", "Right forearm", "muscle", box(0.268, 0.430, 0.350, 0.520), "right"),
  region("front-l-forearm", "Left forearm", "Left forearm", "muscle", box(0.650, 0.430, 0.732, 0.520), "left"),
  region("front-r-ankle", "Right ankle", "Right ankle", "skin", box(0.345, 0.875, 0.430, 0.935), "right"),
  region("front-l-ankle", "Left ankle", "Left ankle", "skin", box(0.565, 0.875, 0.650, 0.935), "left"),
  region("front-r-foot", "Right foot", "Right foot", "skin", box(0.315, 0.925, 0.425, 0.982), "right"),
  region("front-l-foot", "Left foot", "Left foot", "skin", box(0.575, 0.925, 0.680, 0.982), "left"),
  region("front-r-knee", "Right knee", "Right knee", "muscle", box(0.345, 0.695, 0.465, 0.785), "right"),
  region("front-l-knee", "Left knee", "Left knee", "muscle", box(0.535, 0.695, 0.655, 0.785), "left"),
  region("front-r-shoulder", "Right shoulder", "Right shoulder / deltoid", "muscle", box(0.305, 0.175, 0.430, 0.275), "right"),
  region("front-l-shoulder", "Left shoulder", "Left shoulder / deltoid", "muscle", box(0.570, 0.175, 0.700, 0.275), "left"),
  region("front-r-arm", "Right upper arm", "Right upper arm", "muscle", box(0.275, 0.250, 0.370, 0.370), "right"),
  region("front-l-arm", "Left upper arm", "Left upper arm", "muscle", box(0.630, 0.250, 0.725, 0.370), "left"),
  region("front-face", "Face", "Face", "skin", box(0.430, 0.085, 0.570, 0.150), "midline"),
  region("front-head", "Head", "Head", "skin", box(0.420, 0.028, 0.580, 0.095), "midline"),
  region("front-neck", "Neck", "Neck", "muscle", box(0.440, 0.145, 0.560, 0.180), "midline"),
  region("front-r-groin", "Right groin", "Right inguinal region", "muscle", box(0.400, 0.530, 0.495, 0.605), "right"),
  region("front-l-groin", "Left groin", "Left inguinal region", "muscle", box(0.505, 0.530, 0.600, 0.605), "left"),
  region("front-chest", "Chest", "Chest", "muscle", box(0.380, 0.175, 0.620, 0.360), "midline"),
  region("front-upper-abdomen", "Upper abdomen", "Upper abdomen", "muscle", box(0.360, 0.355, 0.640, 0.460), "midline"),
  region("front-lower-abdomen", "Lower abdomen", "Lower abdomen", "muscle", box(0.350, 0.455, 0.650, 0.545), "midline"),
  region("front-r-hip", "Right hip", "Right hip", "skeleton", box(0.335, 0.520, 0.490, 0.600), "right"),
  region("front-l-hip", "Left hip", "Left hip", "skeleton", box(0.510, 0.520, 0.665, 0.600), "left"),
  region("front-r-thigh", "Right thigh", "Right thigh", "muscle", box(0.335, 0.590, 0.495, 0.710), "right"),
  region("front-l-thigh", "Left thigh", "Left thigh", "muscle", box(0.505, 0.590, 0.665, 0.710), "left"),
  region("front-r-shin", "Right shin", "Right shin", "muscle", box(0.350, 0.770, 0.445, 0.890), "right"),
  region("front-l-shin", "Left shin", "Left shin", "muscle", box(0.555, 0.770, 0.650, 0.890), "left")
];

/** Back view: viewer-left is the patient's left. */
const BACK_REGIONS = [
  region("back-l-hand", "Left hand", "Left wrist and hand", "skin", box(0.262, 0.500, 0.345, 0.585), "left"),
  region("back-r-hand", "Right hand", "Right wrist and hand", "skin", box(0.655, 0.500, 0.735, 0.585), "right"),
  region("back-l-elbow", "Left elbow", "Left elbow", "muscle", box(0.268, 0.355, 0.360, 0.445), "left"),
  region("back-r-elbow", "Right elbow", "Right elbow", "muscle", box(0.640, 0.355, 0.732, 0.445), "right"),
  region("back-l-forearm", "Left forearm", "Left forearm", "muscle", box(0.268, 0.430, 0.350, 0.520), "left"),
  region("back-r-forearm", "Right forearm", "Right forearm", "muscle", box(0.650, 0.430, 0.732, 0.520), "right"),
  region("back-l-ankle", "Left ankle", "Left ankle", "skin", box(0.345, 0.875, 0.430, 0.935), "left"),
  region("back-r-ankle", "Right ankle", "Right ankle", "skin", box(0.565, 0.875, 0.650, 0.935), "right"),
  region("back-l-foot", "Left foot", "Left foot", "skin", box(0.345, 0.925, 0.425, 0.982), "left"),
  region("back-r-foot", "Right foot", "Right foot", "skin", box(0.575, 0.925, 0.655, 0.982), "right"),
  region("back-l-knee", "Left knee", "Left knee", "muscle", box(0.345, 0.695, 0.465, 0.785), "left"),
  region("back-r-knee", "Right knee", "Right knee", "muscle", box(0.535, 0.695, 0.655, 0.785), "right"),
  region("back-l-shoulder", "Left shoulder", "Left shoulder / scapular region", "muscle", box(0.305, 0.175, 0.430, 0.275), "left"),
  region("back-r-shoulder", "Right shoulder", "Right shoulder / scapular region", "muscle", box(0.570, 0.175, 0.700, 0.275), "right"),
  region("back-l-arm", "Left upper arm", "Left upper arm", "muscle", box(0.275, 0.250, 0.370, 0.370), "left"),
  region("back-r-arm", "Right upper arm", "Right upper arm", "muscle", box(0.630, 0.250, 0.725, 0.370), "right"),
  region("back-head", "Head", "Back of head", "skin", box(0.420, 0.028, 0.580, 0.145), "midline"),
  region("back-neck", "Neck", "Neck", "skeleton", box(0.440, 0.140, 0.560, 0.180), "midline"),
  region("back-upper", "Upper back", "Upper back", "skeleton", box(0.380, 0.175, 0.620, 0.320), "midline"),
  region("back-mid", "Mid back", "Mid back", "skeleton", box(0.360, 0.315, 0.640, 0.430), "midline"),
  region("back-lower", "Lower back", "Lower back", "skeleton", box(0.350, 0.425, 0.650, 0.530), "midline"),
  region("back-l-buttock", "Left buttock", "Left buttock", "muscle", box(0.335, 0.515, 0.495, 0.605), "left"),
  region("back-r-buttock", "Right buttock", "Right buttock", "muscle", box(0.505, 0.515, 0.665, 0.605), "right"),
  region("back-l-hip", "Left hip", "Left hip", "skeleton", box(0.335, 0.500, 0.420, 0.560), "left"),
  region("back-r-hip", "Right hip", "Right hip", "skeleton", box(0.580, 0.500, 0.665, 0.560), "right"),
  region("back-l-thigh", "Left thigh", "Left thigh", "muscle", box(0.335, 0.590, 0.495, 0.710), "left"),
  region("back-r-thigh", "Right thigh", "Right thigh", "muscle", box(0.505, 0.590, 0.665, 0.710), "right"),
  region("back-l-calf", "Left calf", "Left calf", "muscle", box(0.345, 0.770, 0.445, 0.890), "left"),
  region("back-r-calf", "Right calf", "Right calf", "muscle", box(0.555, 0.770, 0.650, 0.890), "right")
];

/** Left side plate: the figure faces image-left, so smaller x is anterior. */
const LEFT_REGIONS = [
  region("left-hand", "Left hand", "Left wrist and hand", "skin", box(0.395, 0.515, 0.485, 0.605), "left"),
  region("left-elbow", "Left elbow", "Left elbow", "muscle", box(0.395, 0.360, 0.485, 0.455), "left"),
  region("left-forearm", "Left forearm", "Left forearm", "muscle", box(0.395, 0.440, 0.485, 0.530), "left"),
  region("left-ankle", "Left ankle", "Left ankle", "skin", box(0.470, 0.875, 0.590, 0.940), "left"),
  region("left-foot", "Left foot", "Left foot", "skin", box(0.375, 0.920, 0.590, 0.982), "left"),
  region("left-knee", "Left knee", "Left knee", "muscle", box(0.455, 0.690, 0.595, 0.785), "left"),
  region("left-face", "Face", "Face", "skin", box(0.400, 0.060, 0.500, 0.150), "left"),
  region("left-head", "Head", "Head", "skin", box(0.410, 0.028, 0.585, 0.145), "left"),
  region("left-neck", "Neck", "Neck", "muscle", box(0.450, 0.140, 0.575, 0.185), "left"),
  region("left-shoulder", "Left shoulder", "Left shoulder", "muscle", box(0.455, 0.170, 0.625, 0.255), "left"),
  region("left-arm", "Left upper arm", "Left upper arm", "muscle", box(0.395, 0.240, 0.490, 0.380), "left"),
  region("left-groin", "Left groin", "Left inguinal region", "muscle", box(0.410, 0.535, 0.520, 0.610), "left"),
  region("left-chest", "Chest", "Chest", "muscle", box(0.400, 0.210, 0.540, 0.380), "left"),
  region("left-upper-abdomen", "Upper abdomen", "Upper abdomen", "muscle", box(0.410, 0.360, 0.610, 0.460), "left"),
  region("left-lower-abdomen", "Lower abdomen", "Lower abdomen", "muscle", box(0.410, 0.450, 0.600, 0.545), "left"),
  region("left-buttock", "Left buttock", "Left buttock", "muscle", box(0.520, 0.515, 0.625, 0.620), "left"),
  region("left-hip", "Left hip", "Left hip", "skeleton", box(0.415, 0.520, 0.555, 0.620), "left"),
  region("left-thigh", "Left thigh", "Left thigh", "muscle", box(0.420, 0.600, 0.590, 0.720), "left"),
  region("left-shin", "Left shin", "Left shin", "muscle", box(0.470, 0.770, 0.545, 0.890), "left"),
  region("left-calf", "Left calf", "Left calf", "muscle", box(0.530, 0.770, 0.600, 0.890), "left")
];

function mirrorPolygonX(polygon) {
  return polygon.map(([x, y]) => [Math.round((1 - x) * 10000) / 10000, y]);
}

function swapSideWords(text) {
  return String(text)
    .replace(/\bLeft\b/g, "§R§")
    .replace(/\bRight\b/g, "Left")
    .replace(/§R§/g, "Right");
}

function mirrorToRight(source) {
  return source.map((item) => ({
    id: item.id.replace(/^left-/, "right-"),
    label: swapSideWords(item.label),
    patientLabel: swapSideWords(item.patientLabel),
    physicianLabel: swapSideWords(item.physicianLabel),
    layer: item.layer,
    side: "right",
    polygon: mirrorPolygonX(item.polygon)
  }));
}

const ANATOMY_REGIONS = {
  front: FRONT_REGIONS,
  back: BACK_REGIONS,
  left: LEFT_REGIONS,
  right: mirrorToRight(LEFT_REGIONS)
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

function findRegionAt(view, x, y, layer) {
  const regions = ANATOMY_REGIONS[view] || [];
  const hits = regions.filter((item) => pointInPolygon(x, y, item.polygon));
  if (!hits.length) return null;
  if (layer) {
    const layered = hits.find((item) => item.layer === layer);
    if (layered) return layered;
  }
  return hits[0];
}

function getRegionLabel(region, physicianMode) {
  if (!region) return UNMAPPED_REGION_LABEL;
  return physicianMode ? (region.physicianLabel || region.label) : (region.patientLabel || region.label);
}

function mirrorRegionId(regionId) {
  if (!regionId) return null;
  const pairs = [
    ["front-l-", "front-r-"],
    ["back-l-", "back-r-"],
    ["left-", "right-"],
    ["right-", "left-"]
  ];
  for (const [a, b] of pairs) {
    if (regionId.startsWith(a)) return b + regionId.slice(a.length);
    if (regionId.startsWith(b)) return a + regionId.slice(b.length);
  }
  return regionId;
}

function getRegionDisplayLabel(region, physicianMode) {
  if (!region) return UNMAPPED_REGION_LABEL;
  if (region.patientLabel || region.physicianLabel) {
    return physicianMode ? (region.physicianLabel || region.patientLabel) : (region.patientLabel || region.physicianLabel);
  }
  return getRegionLabel(region, physicianMode);
}

function mapAnatomyAt(view, x, y, layer) {
  const hit = findRegionAt(view, x, y, layer);
  if (!hit) {
    return {
      regionId: null,
      patientLabel: UNMAPPED_REGION_LABEL,
      physicianLabel: UNMAPPED_REGION_LABEL,
      anatomyLayer: layer || "skin",
      unmapped: true,
      side: null
    };
  }
  return {
    regionId: hit.id,
    patientLabel: hit.patientLabel || hit.label,
    physicianLabel: hit.physicianLabel || hit.label,
    anatomyLayer: hit.layer || layer || "skin",
    unmapped: false,
    side: hit.side || null
  };
}

window.UNMAPPED_REGION_LABEL = UNMAPPED_REGION_LABEL;
window.ANATOMY_REGIONS = ANATOMY_REGIONS;
window.findRegionAt = findRegionAt;
window.getRegionLabel = getRegionLabel;
window.mirrorRegionId = mirrorRegionId;
window.getRegionDisplayLabel = getRegionDisplayLabel;
window.mapAnatomyAt = mapAnatomyAt;
