/**
 * Canonical body feature flag (Phase 2 Slice 5).
 *
 * Development-only opt-in. Default OFF — production Spatial behavior unchanged.
 * Not a patient-facing setting.
 *
 * Enable with:
 *   ?canonicalBodyMode=true | ?canonicalBodyMode=1
 *   ?canonicalFrame=1          (alias from architecture §O)
 * Optional global override (tests / tooling):
 *   window.PAINLOCATOR_CANONICAL_BODY_MODE = true|false
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

  /**
   * @param {{ search?: string, location?: { search?: string }, override?: boolean|null }} [options]
   */
  function resolveCanonicalBodyMode(options = {}) {
    if (typeof options.override === "boolean") return options.override;
    if (typeof global.PAINLOCATOR_CANONICAL_BODY_MODE === "boolean") {
      return global.PAINLOCATOR_CANONICAL_BODY_MODE;
    }
    try {
      const search =
        options.search ??
        options.location?.search ??
        (typeof global.location !== "undefined" ? global.location.search : "") ??
        "";
      const params = new URLSearchParams(search || "");
      if (truthyParam(params.get("canonicalBodyMode"))) return true;
      if (truthyParam(params.get("canonicalFrame"))) return true;
      return false;
    } catch (_) {
      return false;
    }
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
    return canonicalMode
      ? IDENTITY_SHOULDER_REGISTRATION_URL
      : LEGACY_SHOULDER_REGISTRATION_URL;
  }

  global.CanonicalBodyFlag = {
    resolveCanonicalBodyMode,
    resolveCanonicalAlignmentValidation,
    getCanonicalFrameConstants,
    shoulderRegistrationUrlForMode,
    COORDINATE_FRAME_VERSION,
    CANONICAL_MODEL_ID,
    CANONICAL_MODEL_VERSION,
    EXTERIOR_CONFORMER_VERSION,
    IDENTITY_SHOULDER_REGISTRATION_URL,
    LEGACY_SHOULDER_REGISTRATION_URL,
    EXTERIOR_CONFORMER_URL,
    CANONICAL_MANIFEST_URL,
    CANONICAL_BODY_URL,
    CANONICAL_BODY_LOD1_URL
  };
})(typeof window !== "undefined" ? window : globalThis);
