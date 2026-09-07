/**
 * Engage BP3D-aligned Spatial as the primary locate surface across shells.
 *
 * Product default:
 * - Patient + Clinician: rotatable 3D body (snap views + tap to mark)
 * - CAE 2D plate image is NOT shown alongside Spatial (fallback only)
 * - Opt out to plate: ?displayMode=plate | ?plate=1
 * - Show 2D/Spatial toggle: ?displayToggle=1 | ?dev=1
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
    // Soft default: prefer Spatial even before Three loader probes, when not opted out.
    return true;
  }

  function syncSpatialChrome(isSpatial) {
    if (typeof global.SpatialPrimaryChrome?.applySpatialPrimaryChrome === "function") {
      global.SpatialPrimaryChrome.applySpatialPrimaryChrome(!!isSpatial);
      return;
    }
    const sync =
      typeof global.syncDisplayModeButtons === "function"
        ? global.syncDisplayModeButtons
        : typeof syncDisplayModeButtons === "function"
          ? syncDisplayModeButtons
          : null;
    if (sync) sync(isSpatial ? "spatial" : "plate");
  }

  /**
   * Mount Spatial as the sole interactive locate surface when possible.
   * Falls back to plate only when Spatial cannot mount (kept off-stage otherwise).
   */
  async function preferSpatialAcrossShells(engine) {
    if (!engine || typeof engine.setDisplayMode !== "function") return false;
    if (!shouldPreferSpatial()) {
      syncSpatialChrome(false);
      return false;
    }
    try {
      const ok = await engine.setDisplayMode("spatial");
      syncSpatialChrome(!!ok);
      return !!ok;
    } catch (err) {
      console.warn("[PainLocator] Spatial primary failed — plate fallback", err);
      syncSpatialChrome(false);
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
        syncSpatialChrome(true);
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
      console.info("[PainLocator] Spatial-primary locate engagement", {
        canonicalBodyMode: canonicalOn,
        spatialPrimary: spatialOn,
        plateFallback: !spatialOn,
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
    syncSpatialChrome,
    isFalsyFlag,
    isTruthyFlag
  };
})(typeof window !== "undefined" ? window : globalThis);
