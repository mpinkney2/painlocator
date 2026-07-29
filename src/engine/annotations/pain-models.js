/**
 * Pain Markup System — PainEntry + PainRegion, coordinate mapping, undo/redo.
 */

const ENTRY_STORAGE_KEY = "painlocator_pain_entries";
const MARKER_STORAGE_KEY = "painlocator_markers";
const LAYOUT_STORAGE_KEY = "painlocator_layout";
const LEGACY_STORAGE_KEY = "painlocator_entries";
const DRAFT_KEY = "__draft__";

const REGION_TOOLS = ["select", "point", "circle", "polygon", "brush", "lasso", "eraser"];

function normalizeModelType(modelType) {
  const map = { male: "adult-male", female: "adult-female", child: "child", teen: "teen", senior: "senior" };
  return map[modelType] || modelType || "adult-male";
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createPainRegion(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: partial.id || `pr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    entryId: partial.entryId || null,
    view: partial.view || "front",
    regionId: partial.regionId || null,
    patientLabel: partial.patientLabel || null,
    physicianLabel: partial.physicianLabel || null,
    anatomyLayer: partial.anatomyLayer || "skin",
    structureId: partial.structureId || null,
    structureLabel: partial.structureLabel || null,
    shape: partial.shape || "circle",
    anchors: (partial.anchors || [{ x: 0.5, y: 0.5 }]).map(a => ({ x: clamp01(a.x), y: clamp01(a.y) })),
    radius: typeof partial.radius === "number" ? partial.radius : 0.02,
    radiusY: typeof partial.radiusY === "number" ? partial.radiusY : null,
    opacity: typeof partial.opacity === "number" ? partial.opacity : null,
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now
  };
}

function createPainEntry(partial = {}) {
  const now = new Date().toISOString();
  const entryId = partial.id || `pe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const regions = (partial.regions || partial.markers || []).map(r => {
    if (r.anchors) return createPainRegion({ ...r, entryId });
    return migrateMarkerToRegion(r, entryId);
  });
  return {
    id: entryId,
    title: partial.title || null,
    patientModel: partial.patientModel || "adult-male",
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now,
    intensity: typeof partial.intensity === "number" ? partial.intensity : 5,
    quality: partial.quality || [],
    triggers: partial.triggers || [],
    easesAfter: partial.easesAfter || [],
    duration: partial.duration || "",
    whenOccurring: partial.whenOccurring || "",
    note: partial.note || "",
    regions
  };
}

function regionLabel(entryNum, regionIndex) {
  return `${entryNum}${String.fromCharCode(65 + regionIndex)}`;
}

function getRegionCenter(region) {
  if (region.shape === "polygon" && region.anchors.length > 1) {
    const n = region.anchors.length;
    const sx = region.anchors.reduce((s, a) => s + a.x, 0);
    const sy = region.anchors.reduce((s, a) => s + a.y, 0);
    return { x: sx / n, y: sy / n };
  }
  return region.anchors[0] || { x: 0.5, y: 0.5 };
}

function getRegionRadii(region, intensity = 5) {
  const base = region.radius || 0.018;
  const scale = 0.75 + intensity * 0.05;
  const rx = base * scale;
  const ry = (region.radiusY || base) * scale;
  return { rx, ry };
}

function getRegionOpacity(region, intensity = 5) {
  if (region.opacity != null) return region.opacity;
  // Strong clinical visibility: ~0.62 (mild) → ~0.96 (extreme)
  return Math.min(0.96, 0.62 + intensity * 0.034);
}

function migrateMarkerToRegion(marker, entryId) {
  const x = marker.x ?? marker.anchors?.[0]?.x ?? 0.5;
  const y = marker.y ?? marker.anchors?.[0]?.y ?? 0.5;
  return createPainRegion({
    id: marker.id,
    entryId,
    view: marker.view || "front",
    regionId: marker.regionId,
    patientLabel: marker.patientLabel || marker.regionLabel,
    physicianLabel: marker.physicianLabel || marker.regionLabel,
    anatomyLayer: marker.anatomyLayer,
    structureId: marker.structureId,
    structureLabel: marker.structureLabel,
    shape: "circle",
    anchors: [{ x, y }],
    radius: 0.018,
    createdAt: marker.createdAt,
    updatedAt: marker.updatedAt
  });
}

function migrateLegacyMarkerToEntry(marker) {
  return createPainEntry({
    patientModel: marker.patientModel || "adult-male",
    intensity: marker.intensity ?? 5,
    quality: marker.quality || [],
    triggers: marker.triggers || [],
    easesAfter: marker.easesAfter || [],
    duration: marker.duration || "",
    whenOccurring: marker.whenOccurring || "",
    note: marker.note || "",
    createdAt: marker.createdAt,
    updatedAt: marker.updatedAt,
    regions: [migrateMarkerToRegion(marker)]
  });
}

function migrateLegacyFlatEntry(entry) {
  const x = typeof entry.x === "number" ? (entry.x > 1 ? entry.x / 100 : entry.x) : 0.5;
  const y = typeof entry.y === "number" ? (entry.y > 1 ? entry.y / 100 : entry.y) : 0.5;
  return createPainEntry({
    id: entry.id,
    patientModel: normalizeModelType(entry.patientModel || entry.modelType),
    intensity: entry.intensity ?? 5,
    quality: entry.qualities || entry.quality || [],
    triggers: entry.triggers || [],
    easesAfter: entry.easeAfter || entry.easesAfter || [],
    duration: entry.duration || "",
    whenOccurring: entry.occurrence || entry.whenOccurring || "",
    note: entry.notes || entry.note || "",
    createdAt: entry.timestamp || entry.createdAt,
    updatedAt: entry.updatedAt || entry.timestamp,
    regions: [createPainRegion({ view: entry.view || "front", anchors: [{ x, y }], patientLabel: entry.region || entry.regionLabel })]
  });
}
