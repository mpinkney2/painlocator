/**
 * Schematic overlay datasets for CAE reference + assistive layers.
 * These are educational schematic regions (not diagnostic anatomy atlases).
 */

function polyFromRegion(region) {
  return (region.polygon || []).map(([x, y]) => ({ x, y }));
}

function regionsByLayer(view, layer) {
  return (ANATOMY_REGIONS[view] || [])
    .filter(r => !layer || r.layer === layer)
    .map(r => ({
      id: r.id,
      label: r.physicianLabel || r.patientLabel || r.label,
      layer: r.layer,
      points: polyFromRegion(r)
    }));
}

/** Dermatome-style schematic bands (front/back only; lateral uses torso strip). */
const DERMATOME_BANDS = {
  front: [
    { id: "c2-c4", label: "C2–C4", color: "rgba(56,189,248,0.28)", points: [{x:0.34,y:0.02},{x:0.66,y:0.02},{x:0.66,y:0.18},{x:0.34,y:0.18}] },
    { id: "c5-t1", label: "C5–T1", color: "rgba(34,211,238,0.24)", points: [{x:0.12,y:0.18},{x:0.88,y:0.18},{x:0.88,y:0.36},{x:0.12,y:0.36}] },
    { id: "t2-t8", label: "T2–T8", color: "rgba(125,211,252,0.22)", points: [{x:0.28,y:0.32},{x:0.72,y:0.32},{x:0.72,y:0.48},{x:0.28,y:0.48}] },
    { id: "t9-l1", label: "T9–L1", color: "rgba(165,180,252,0.22)", points: [{x:0.32,y:0.46},{x:0.68,y:0.46},{x:0.68,y:0.60},{x:0.32,y:0.60}] },
    { id: "l2-s1", label: "L2–S1", color: "rgba(196,181,253,0.22)", points: [{x:0.30,y:0.58},{x:0.70,y:0.58},{x:0.70,y:0.96},{x:0.30,y:0.96}] }
  ],
  back: [
    { id: "c2-c4", label: "C2–C4", color: "rgba(56,189,248,0.28)", points: [{x:0.34,y:0.02},{x:0.66,y:0.02},{x:0.66,y:0.18},{x:0.34,y:0.18}] },
    { id: "c5-t1", label: "C5–T1", color: "rgba(34,211,238,0.24)", points: [{x:0.24,y:0.18},{x:0.76,y:0.18},{x:0.76,y:0.34},{x:0.24,y:0.34}] },
    { id: "t2-t8", label: "T2–T8", color: "rgba(125,211,252,0.22)", points: [{x:0.28,y:0.30},{x:0.72,y:0.30},{x:0.72,y:0.46},{x:0.28,y:0.46}] },
    { id: "t9-l1", label: "T9–L1", color: "rgba(165,180,252,0.22)", points: [{x:0.32,y:0.44},{x:0.68,y:0.44},{x:0.68,y:0.58},{x:0.32,y:0.58}] },
    { id: "l2-s1", label: "L2–S1", color: "rgba(196,181,253,0.22)", points: [{x:0.30,y:0.56},{x:0.70,y:0.56},{x:0.70,y:0.96},{x:0.30,y:0.96}] }
  ],
  left: [
    { id: "lat-upper", label: "Cervical–thoracic", color: "rgba(56,189,248,0.24)", points: [{x:0.28,y:0.04},{x:0.72,y:0.04},{x:0.72,y:0.40},{x:0.28,y:0.40}] },
    { id: "lat-lower", label: "Lumbar–sacral", color: "rgba(196,181,253,0.22)", points: [{x:0.32,y:0.40},{x:0.68,y:0.40},{x:0.68,y:0.96},{x:0.32,y:0.96}] }
  ],
  right: [
    { id: "lat-upper", label: "Cervical–thoracic", color: "rgba(56,189,248,0.24)", points: [{x:0.28,y:0.04},{x:0.72,y:0.04},{x:0.72,y:0.40},{x:0.28,y:0.40}] },
    { id: "lat-lower", label: "Lumbar–sacral", color: "rgba(196,181,253,0.22)", points: [{x:0.32,y:0.40},{x:0.68,y:0.40},{x:0.68,y:0.96},{x:0.32,y:0.96}] }
  ]
};

const REFERENCE_VECTOR_COLORS = {
  muscle: "rgba(248,113,113,0.22)",
  skeleton: "rgba(226,232,240,0.28)",
  nerve: "rgba(250,204,21,0.24)",
  organ: "rgba(52,211,153,0.22)"
};

function getReferenceOverlayShapes(overlayId, view) {
  const layerMap = { muscle: "muscle", skeleton: "skeleton", nerve: "nerve", organ: "organ" };
  const layer = layerMap[overlayId];
  if (!layer) return [];
  return regionsByLayer(view, layer).map(r => ({
    ...r,
    color: REFERENCE_VECTOR_COLORS[overlayId] || "rgba(34,211,238,0.2)"
  }));
}

function getDermatomeShapes(view) {
  return DERMATOME_BANDS[view] || DERMATOME_BANDS.front;
}

function getMyotomeShapes(view) {
  return regionsByLayer(view, "muscle").map(r => ({
    ...r,
    color: "rgba(251,146,60,0.22)"
  }));
}

function getSuggestedShapes(view, store, modelType) {
  const model = normalizeModelType(modelType);
  const counts = {};
  (store?.entries || []).forEach(entry => {
    if (normalizeModelType(entry.patientModel) !== model) return;
    (entry.regions || []).forEach(region => {
      if (region.view !== view) return;
      const key = region.regionId || region.patientLabel || "unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
  return (ANATOMY_REGIONS[view] || [])
    .filter(r => top.includes(r.id) || top.includes(r.patientLabel))
    .map(r => ({
      id: r.id,
      label: r.patientLabel || r.label,
      points: polyFromRegion(r),
      color: "rgba(34,211,238,0.28)"
    }));
}

function getReferredShapes(view, store, modelType) {
  const model = normalizeModelType(modelType);
  const shapes = [];
  (store?.entries || []).forEach(entry => {
    if (normalizeModelType(entry.patientModel) !== model) return;
    (entry.regions || []).forEach(region => {
      if (region.view !== view) return;
      const c = getRegionCenter(region);
      const { rx, ry } = getRegionRadii(region, entry.intensity ?? 5);
      shapes.push({
        id: `ref-${region.id}`,
        label: "Referred field",
        kind: "ellipse",
        cx: clamp01(c.x + (c.x < 0.5 ? 0.08 : -0.08)),
        cy: clamp01(c.y + 0.06),
        rx: Math.max(0.04, rx * 1.6),
        ry: Math.max(0.04, ry * 1.8),
        color: "rgba(244,114,182,0.2)"
      });
    });
  });
  return shapes;
}

window.getReferenceOverlayShapes = getReferenceOverlayShapes;
window.getDermatomeShapes = getDermatomeShapes;
window.getMyotomeShapes = getMyotomeShapes;
window.getSuggestedShapes = getSuggestedShapes;
window.getReferredShapes = getReferredShapes;
window.REFERENCE_VECTOR_COLORS = REFERENCE_VECTOR_COLORS;
