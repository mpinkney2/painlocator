/**
 * Canonical body feature flag (Phase 2 Slice 5+).
 *
 * Product engagement (Bp3dShellEngagement) sets
 * `window.PAINLOCATOR_CANONICAL_BODY_MODE = true` at boot so Patient + Clinician
 * Spatial share the BP3D canonical frame. Isolated unit tests still see default
 * OFF unless that global (or a query param) is set.
 *
 * Explicit opt-out: ?canonicalBodyMode=0 | false
 * Explicit opt-in:  ?canonicalBodyMode=true | ?canonicalFrame=1
 */
(function (global) {
  const COORDINATE_FRAME_VERSION = "painlocator-bp3d-canonical-v1";
  const CANONICAL_MODEL_ID = "bp3d-canonical-body";
  const CANONICAL_MODEL_VERSION = "bp3d-fullbody-skin-canonical-v0";
  const EXTERIOR_CONFORMER_VERSION = "exterior-to-canonical-v1";
  const IDENTITY_SHOULDER_REGISTRATION_URL =
    "/anatomy/spatial/registration/bp3d-shoulder-canonical-identity.json";
  const LEGACY_SHOULDER_REGISTRATION_URL =
    "/anatomy/spatial/registration/bp3d-shoulder-adult-male.json";
  const FULLBODY_IDENTITY_REGISTRATION_URL =
    "/anatomy/spatial/registration/bp3d-fullbody-canonical-identity.json";
  const FULLBODY_INDEX_URL =
    "/anatomy/spatial/prototype-bp3d-fullbody-msk/index.json";
  const EXTERIOR_CONFORMER_URL =
    "/anatomy/spatial/registration/exterior-to-canonical-v1.json";
  const CANONICAL_MANIFEST_URL =
    "/anatomy/spatial/prototype-bp3d-fullbody/manifest.json";
  const CANONICAL_BODY_URL =
    "/anatomy/spatial/prototype-bp3d-fullbody/canonical-body.glb";
  const CANONICAL_BODY_LOD1_URL =
    "/anatomy/spatial/prototype-bp3d-fullbody/canonical-body-lod1.glb";

  function truthyParam(value) {
    if (value == null) return false;
    const v = String(value).trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes" || v === "on";
  }

  function falsyParam(value) {
    if (value == null) return false;
    const v = String(value).trim().toLowerCase();
    return v === "0" || v === "false" || v === "no" || v === "off";
  }

  function readSearch(options = {}) {
    try {
      return (
        options.search ??
        options.location?.search ??
        (typeof global.location !== "undefined" ? global.location.search : "") ??
        ""
      );
    } catch (_) {
      return "";
    }
  }

  /**
   * Development flag: clinician full-body BP3D MSK packs.
   * ?fullBodyAnatomy=1 | window.PAINLOCATOR_FULL_BODY_ANATOMY = true
   */
  function resolveFullBodyAnatomy(options = {}) {
    if (typeof options.override === "boolean") return options.override;
    try {
      const params = new URLSearchParams(readSearch(options) || "");
      const raw = params.get("fullBodyAnatomy") ?? params.get("fullBody");
      if (raw != null && String(raw).trim() !== "") {
        if (falsyParam(raw)) return false;
        if (truthyParam(raw)) return true;
      }
    } catch (_) {
      /* fall through */
    }
    if (typeof global.PAINLOCATOR_FULL_BODY_ANATOMY === "boolean") {
      return global.PAINLOCATOR_FULL_BODY_ANATOMY;
    }
    return false;
  }

  /**
   * @param {{ search?: string, location?: { search?: string }, override?: boolean|null }} [options]
   */
  function resolveCanonicalBodyMode(options = {}) {
    if (typeof options.override === "boolean") return options.override;
    try {
      const search =
        options.search ??
        options.location?.search ??
        (typeof global.location !== "undefined" ? global.location.search : "") ??
        "";
      const params = new URLSearchParams(search || "");
      const raw = params.get("canonicalBodyMode") ?? params.get("canonicalFrame");
      if (raw != null && String(raw).trim() !== "") {
        if (falsyParam(raw)) return false;
        if (truthyParam(raw)) return true;
      }
    } catch (_) {
      /* fall through */
    }
    if (typeof global.PAINLOCATOR_CANONICAL_BODY_MODE === "boolean") {
      return global.PAINLOCATOR_CANONICAL_BODY_MODE;
    }
    return false;
  }

  /**
   * Dev validation overlay (?canonicalAlignmentValidation=1) — clinician/dev only.
   */
  function resolveCanonicalAlignmentValidation(options = {}) {
    try {
      const search =
        options.search ??
        options.location?.search ??
        (typeof global.location !== "undefined" ? global.location.search : "") ??
        "";
      const params = new URLSearchParams(search || "");
      return truthyParam(params.get("canonicalAlignmentValidation"));
    } catch (_) {
      return false;
    }
  }

  function getCanonicalFrameConstants() {
    return Object.freeze({
      coordinateFrameVersion: COORDINATE_FRAME_VERSION,
      canonicalModelId: CANONICAL_MODEL_ID,
      canonicalModelVersion: CANONICAL_MODEL_VERSION,
      registrationVersion: EXTERIOR_CONFORMER_VERSION,
      exteriorConformerUrl: EXTERIOR_CONFORMER_URL,
      identityShoulderRegistrationUrl: IDENTITY_SHOULDER_REGISTRATION_URL,
      legacyShoulderRegistrationUrl: LEGACY_SHOULDER_REGISTRATION_URL,
      canonicalManifestUrl: CANONICAL_MANIFEST_URL,
      canonicalBodyUrl: CANONICAL_BODY_URL,
      canonicalBodyLod1Url: CANONICAL_BODY_LOD1_URL
    });
  }

  function shoulderRegistrationUrlForMode(canonicalMode) {
    if (resolveFullBodyAnatomy()) {
      return FULLBODY_IDENTITY_REGISTRATION_URL;
    }
    return canonicalMode
      ? IDENTITY_SHOULDER_REGISTRATION_URL
      : LEGACY_SHOULDER_REGISTRATION_URL;
  }

  global.CanonicalBodyFlag = {
    resolveCanonicalBodyMode,
    resolveCanonicalAlignmentValidation,
    resolveFullBodyAnatomy,
    getCanonicalFrameConstants,
    shoulderRegistrationUrlForMode,
    COORDINATE_FRAME_VERSION,
    CANONICAL_MODEL_ID,
    CANONICAL_MODEL_VERSION,
    EXTERIOR_CONFORMER_VERSION,
    IDENTITY_SHOULDER_REGISTRATION_URL,
    LEGACY_SHOULDER_REGISTRATION_URL,
    FULLBODY_IDENTITY_REGISTRATION_URL,
    FULLBODY_INDEX_URL,
    EXTERIOR_CONFORMER_URL,
    CANONICAL_MANIFEST_URL,
    CANONICAL_BODY_URL,
    CANONICAL_BODY_LOD1_URL
  };
})(typeof window !== "undefined" ? window : globalThis);
