/**
 * Engage BP3D-aligned Spatial across Patient portal and Clinician console.
 *
 * Recommendation B:
 * - Patient: Spatial stylized exterior in the shared BP3D canonical frame (body hidden)
 * - Clinician: same frame + Surface / Muscle / Skeletal BP3D packs
 * - Opt out: ?canonicalBodyMode=0 | ?displayMode=plate | ?plate=1
 */
(function (global) {
  function isFalsyFlag(value) {
    if (value == null || value === "") return false;
    const v = String(value).trim().toLowerCase();
    return v === "0" || v === "false" || v === "no" || v === "off";
  }

  function isTruthyFlag(value) {
    if (value == null || value === "") return false;
    const v = String(value).trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes" || v === "on";
  }

  function readParams() {
    try {
      return new URLSearchParams(global.location?.search || "");
    } catch (_) {
      return new URLSearchParams();
    }
  }

  /**
   * Configure canonical-frame engagement before Spatial mounts.
   * Does not itself load GLBs — only sets the runtime flag.
   */
  function configureCanonicalEngagement() {
    const params = readParams();
    const raw =
      params.get("canonicalBodyMode") ?? params.get("canonicalFrame") ?? "";
    if (isFalsyFlag(raw)) {
      global.PAINLOCATOR_CANONICAL_BODY_MODE = false;
      return false;
    }
    if (isTruthyFlag(raw) || raw === "") {
      // Product default: engage BP3D canonical frame for Spatial in both shells.
      global.PAINLOCATOR_CANONICAL_BODY_MODE = true;
      return true;
    }
    global.PAINLOCATOR_CANONICAL_BODY_MODE = true;
    return true;
  }

  function shouldPreferSpatial() {
    const params = readParams();
    if (params.get("displayMode") === "plate" || isTruthyFlag(params.get("plate"))) {
      return false;
    }
    if (params.get("displayMode") === "spatial" || isTruthyFlag(params.get("spatial"))) {
      return true;
    }
    try {
      if (typeof SpatialThreeLoader !== "undefined" && SpatialThreeLoader.isWebGLAvailable) {
        return !!SpatialThreeLoader.isWebGLAvailable();
      }
    } catch (_) {
      /* ignore */
    }
    return false;
  }

  /**
   * Prefer Spatial for Patient Locate + Clinician console when WebGL works.
   * Falls back to plate silently if Spatial cannot mount.
   */
  async function preferSpatialAcrossShells(engine) {
    if (!engine || typeof engine.setDisplayMode !== "function") return false;
    if (!shouldPreferSpatial()) return false;
    try {
      const ok = await engine.setDisplayMode("spatial");
      const sync =
        typeof global.syncDisplayModeButtons === "function"
          ? global.syncDisplayModeButtons
          : typeof syncDisplayModeButtons === "function"
            ? syncDisplayModeButtons
            : null;
      if (ok && sync) sync("spatial");
      return !!ok;
    } catch (err) {
      console.warn("[PainLocator] Spatial preference failed — staying on plate", err);
      return false;
    }
  }

  function bindPresentationShellRefresh(engine) {
    if (global.__bp3dPresentationBound) return;
    global.__bp3dPresentationBound = true;
    document.addEventListener("presentationchange", () => {
      const spatial = engine?.spatialRenderer;
      if (!spatial?.ready) return;
      try {
        spatial.refreshPresentationShell?.();
      } catch (err) {
        console.warn("[PainLocator] presentation shell refresh failed", err);
      }
    });
  }

  /**
   * @param {object} engine ClinicalAnatomyEngine
   */
  async function engageBp3dAcrossShells(engine) {
    const canonicalOn = configureCanonicalEngagement();
    bindPresentationShellRefresh(engine);
    const spatialOn = await preferSpatialAcrossShells(engine);
    if (typeof console !== "undefined" && console.info) {
      console.info("[PainLocator] BP3D shell engagement", {
        canonicalBodyMode: canonicalOn,
        spatialPreferred: spatialOn,
        presentationMode:
          typeof state !== "undefined" ? state.presentationMode : null
      });
    }
    return { canonicalOn, spatialOn };
  }

  global.Bp3dShellEngagement = {
    configureCanonicalEngagement,
    shouldPreferSpatial,
    preferSpatialAcrossShells,
    bindPresentationShellRefresh,
    engageBp3dAcrossShells,
    isFalsyFlag,
    isTruthyFlag
  };
})(typeof window !== "undefined" ? window : globalThis);
