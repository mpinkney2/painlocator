/**
 * AnatomyVendorTypes — vendor-neutral geometry contract (CAE).
 *
 * Durable clinical identity is ALWAYS FMA + canonical frame.
 * Vendor IDs are adapters only — never session schema / never durable truth.
 *
 * Evaluation-only until a licensed visual master is approved.
 */
(function (global) {
  const MAPPING_CONFIDENCE = Object.freeze({
    EXACT: "EXACT",
    HIGH_CONFIDENCE: "HIGH_CONFIDENCE",
    MANUAL_REVIEW: "MANUAL_REVIEW",
    NO_MATCH: "NO_MATCH"
  });

  const LAYERS = Object.freeze([
    "surface",
    "muscle",
    "skeletal",
    "nervous",
    "organ",
    "other"
  ]);

  const LATERALITIES = Object.freeze(["left", "right", "midline"]);

  const CANONICAL_FRAME = "painlocator-bp3d-canonical-v1";

  const REQUIRED_LANDMARK_IDS = Object.freeze([
    "vertex",
    "shoulderL",
    "shoulderR",
    "humeralHeadL",
    "humeralHeadR",
    "elbowL",
    "elbowR",
    "hipL",
    "hipR",
    "kneeL",
    "kneeR",
    "ankleL",
    "ankleR",
    "bodyCenter"
  ]);

  /**
   * @typedef {object} AnatomyVendorStructure
   * @property {string} anatomyVendor
   * @property {string} vendorModelVersion
   * @property {string|null} vendorStructureId
   * @property {string|null} vendorStructureName
   * @property {string} fmaStructureId
   * @property {string} clinicalName
   * @property {"left"|"right"|"midline"} laterality
   * @property {string} region
   * @property {string} layer
   * @property {string|null} sourceCoordinateSystem
   * @property {string} canonicalRegistrationVersion
   * @property {string} meshId
   * @property {string|null} runtimeAssetRef
   * @property {string} [mappingConfidence]
   */

  function isFmaStructureId(id) {
    return typeof id === "string" && /^FMA:\d+$/.test(id);
  }

  function emptyVendorStructure(partial = {}) {
    return {
      anatomyVendor: partial.anatomyVendor || "",
      vendorModelVersion: partial.vendorModelVersion || "",
      vendorStructureId: partial.vendorStructureId ?? null,
      vendorStructureName: partial.vendorStructureName ?? null,
      fmaStructureId: partial.fmaStructureId || "",
      clinicalName: partial.clinicalName || "",
      laterality: partial.laterality || "midline",
      region: partial.region || "",
      layer: partial.layer || "other",
      sourceCoordinateSystem: partial.sourceCoordinateSystem ?? null,
      canonicalRegistrationVersion:
        partial.canonicalRegistrationVersion || CANONICAL_FRAME,
      meshId: partial.meshId || "",
      runtimeAssetRef: partial.runtimeAssetRef ?? null,
      mappingConfidence: partial.mappingConfidence || MAPPING_CONFIDENCE.MANUAL_REVIEW
    };
  }

  global.AnatomyVendorTypes = {
    MAPPING_CONFIDENCE,
    LAYERS,
    LATERALITIES,
    CANONICAL_FRAME,
    REQUIRED_LANDMARK_IDS,
    isFmaStructureId,
    emptyVendorStructure
  };
})(typeof window !== "undefined" ? window : globalThis);
