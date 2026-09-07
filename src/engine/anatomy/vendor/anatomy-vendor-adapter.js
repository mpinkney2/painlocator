/**
 * AnatomyVendorAdapter — normalize vendor meshes into FMA/canonical identity.
 *
 * Does not load proprietary assets. Does not write session schema.
 * Patient mode must never resolve clinician vendor packs.
 */
(function (global) {
  const Types = global.AnatomyVendorTypes;

  function die(code, message, extra) {
    const err = new Error(message);
    err.code = code;
    if (extra) Object.assign(err, extra);
    throw err;
  }

  function assertClinicianPresentation(presentationMode) {
    const mode = String(presentationMode || "").toLowerCase();
    if (mode === "patient") {
      die(
        "VENDOR_PATIENT_ISOLATION",
        "Vendor clinician anatomy must not load in Patient mode"
      );
    }
  }

  /**
   * Validate a vendor→FMA mapping document (template or filled).
   * @param {object} doc
   */
  function validateMappingDocument(doc) {
    if (!doc || typeof doc !== "object") die("VENDOR_MAP_INVALID", "Mapping document missing");
    if (!doc.anatomyVendor) die("VENDOR_MAP_INVALID", "anatomyVendor required");
    if (!doc.vendorModelVersion) die("VENDOR_MAP_INVALID", "vendorModelVersion required");
    if (doc.canonicalRegistrationVersion !== Types.CANONICAL_FRAME) {
      die(
        "VENDOR_MAP_FRAME",
        `canonicalRegistrationVersion must be ${Types.CANONICAL_FRAME}`
      );
    }
    if (!Array.isArray(doc.structures) || !doc.structures.length) {
      die("VENDOR_MAP_INVALID", "structures[] required");
    }

    const fmaSeen = new Map();
    const vendorSeen = new Map();
    const confidences = Types.MAPPING_CONFIDENCE;

    for (const row of doc.structures) {
      if (!Types.isFmaStructureId(row.fmaStructureId)) {
        die("VENDOR_MAP_FMA", `Invalid fmaStructureId: ${row.fmaStructureId}`);
      }
      if (!Types.LATERALITIES.includes(row.laterality)) {
        die("VENDOR_MAP_LATERALITY", `Invalid laterality: ${row.laterality}`);
      }
      if (!Types.LAYERS.includes(row.layer)) {
        die("VENDOR_MAP_LAYER", `Invalid layer: ${row.layer}`);
      }
      if (!Object.values(confidences).includes(row.mappingConfidence)) {
        die(
          "VENDOR_MAP_CONFIDENCE",
          `Invalid mappingConfidence: ${row.mappingConfidence}`
        );
      }
      if (fmaSeen.has(row.fmaStructureId)) {
        die("VENDOR_MAP_DUPLICATE_FMA", `Duplicate FMA mapping: ${row.fmaStructureId}`, {
          previous: fmaSeen.get(row.fmaStructureId),
          current: row
        });
      }
      fmaSeen.set(row.fmaStructureId, row);

      if (row.vendorStructureId) {
        if (vendorSeen.has(row.vendorStructureId)) {
          die(
            "VENDOR_MAP_DUPLICATE_VENDOR",
            `Duplicate vendorStructureId: ${row.vendorStructureId}`
          );
        }
        vendorSeen.set(row.vendorStructureId, row);
      }
    }

    return {
      ok: true,
      structureCount: doc.structures.length,
      filledVendorIds: [...vendorSeen.keys()].length,
      missingVendorIds: doc.structures.filter((s) => !s.vendorStructureId).length
    };
  }

  /**
   * Normalize a mapping row into AnatomyVendorStructure.
   */
  function toVendorStructure(doc, row) {
    if (!row) die("VENDOR_STRUCTURE_MISSING", "structure row required");
    return Types.emptyVendorStructure({
      anatomyVendor: doc.anatomyVendor,
      vendorModelVersion: doc.vendorModelVersion,
      vendorStructureId: row.vendorStructureId ?? null,
      vendorStructureName: row.vendorStructureName ?? null,
      fmaStructureId: row.fmaStructureId,
      clinicalName: row.clinicalName,
      laterality: row.laterality,
      region: row.region,
      layer: row.layer,
      sourceCoordinateSystem: doc.sourceCoordinateSystem || null,
      canonicalRegistrationVersion: doc.canonicalRegistrationVersion,
      meshId: row.meshId || `fma.${row.fmaStructureId.replace(":", ".").toLowerCase()}`,
      runtimeAssetRef: row.runtimeAssetRef ?? null,
      mappingConfidence: row.mappingConfidence
    });
  }

  /**
   * Resolve a mesh pick: vendor id → PainLocator clinical identity.
   */
  function resolveSelection(doc, { vendorStructureId, presentationMode } = {}) {
    assertClinicianPresentation(presentationMode);
    validateMappingDocument(doc);
    if (!vendorStructureId) {
      die("VENDOR_SELECTION_MISSING_ID", "vendorStructureId required for selection");
    }
    const row = doc.structures.find((s) => s.vendorStructureId === vendorStructureId);
    if (!row) {
      die("VENDOR_SELECTION_UNKNOWN", `Unknown vendorStructureId: ${vendorStructureId}`);
    }
    if (row.mappingConfidence === Types.MAPPING_CONFIDENCE.NO_MATCH) {
      die("VENDOR_SELECTION_NO_MATCH", `Structure marked NO_MATCH: ${vendorStructureId}`);
    }
    if (!row.vendorStructureId) {
      die("VENDOR_SELECTION_PLACEHOLDER", "vendorStructureId still placeholder");
    }
    const structure = toVendorStructure(doc, row);
    return {
      vendorStructureId: structure.vendorStructureId,
      fmaStructureId: structure.fmaStructureId,
      clinicalName: structure.clinicalName,
      laterality: structure.laterality,
      region: structure.region,
      layer: structure.layer,
      mappingConfidence: structure.mappingConfidence,
      meshId: structure.meshId,
      disclaimer: "Anatomical context only — not a diagnosis."
    };
  }

  function listUnresolved(doc) {
    validateMappingDocument(doc);
    return doc.structures.filter(
      (s) =>
        !s.vendorStructureId ||
        s.mappingConfidence === Types.MAPPING_CONFIDENCE.MANUAL_REVIEW ||
        s.mappingConfidence === Types.MAPPING_CONFIDENCE.NO_MATCH
    );
  }

  /**
   * Evaluation asset roots — never under public/ for proprietary samples.
   */
  const EVAL_ASSET_ROOTS = Object.freeze([
    "data/vendor-eval/",
    "data/vendor-eval/sciepro/",
    "data/vendor-eval/zygote/"
  ]);

  const FORBIDDEN_PUBLIC_PATTERNS = Object.freeze([
    /(?:^|\/)vendor-eval(?:\/|$)/i,
    /(?:^|\/)sciepro[^/]*\.(?:obj|fbx|gltf|glb|bin|zip)$/i,
    /(?:^|\/)zygote[^/]*\.(?:obj|fbx|gltf|glb|bin|zip)$/i
  ]);

  function isForbiddenPublicPath(relPath) {
    const p = String(relPath || "").replace(/\\/g, "/");
    return FORBIDDEN_PUBLIC_PATTERNS.some((re) => re.test(p));
  }

  global.AnatomyVendorAdapter = {
    assertClinicianPresentation,
    validateMappingDocument,
    toVendorStructure,
    resolveSelection,
    listUnresolved,
    EVAL_ASSET_ROOTS,
    FORBIDDEN_PUBLIC_PATTERNS,
    isForbiddenPublicPath
  };
})(typeof window !== "undefined" ? window : globalThis);
