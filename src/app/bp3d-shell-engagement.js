/**
 * Engage BP3D-aligned Spatial as the primary locate surface across shells.
 *
 * Product default:
 * - Patient + Clinician: rotatable 3D body (snap views + tap to mark)
 * - CAE 2D plate image is NOT shown on failure (status panel + Retry instead)
 * - Opt in to plate: ?displayMode=plate | ?plate=1 | "Use 2D diagram"
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

  function configureCanonicalEngagement() {
    const params = readParams();
    const raw =
      params.get("canonicalBodyMode") ?? params.get("canonicalFrame") ?? "";
    if (isFalsyFlag(raw)) {
      global.PAINLOCATOR_CANONICAL_BODY_MODE = false;
      return false;
    }
    if (isTruthyFlag(raw) || raw === "") {
      global.PAINLOCATOR_CANONICAL_BODY_MODE = true;
      return true;
    }
    global.PAINLOCATOR_CANONICAL_BODY_MODE = true;
    return true;
  }

  /**
   * Prefer Spatial unless the user explicitly opted into plate.
   * Do NOT gate on the WebGL probe — probes are flaky in embedded previews;
   * always attempt the real mount and surface failure in the status panel.
   */
  function shouldPreferSpatial() {
    const params = readParams();
    if (params.get("displayMode") === "plate" || isTruthyFlag(params.get("plate"))) {
      return false;
    }
    return true;
  }

  function syncSpatialChrome(isSpatial) {
    if (typeof global.SpatialPrimaryChrome?.applySpatialPrimaryChrome === "function") {
      global.SpatialPrimaryChrome.applySpatialPrimaryChrome(!!isSpatial, {
        keepSpatialPrimary: shouldPreferSpatial()
      });
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

  async function preferSpatialAcrossShells(engine) {
    if (!engine || typeof engine.setDisplayMode !== "function") return false;
    if (!shouldPreferSpatial()) {
      syncSpatialChrome(false);
      return false;
    }
    engine.spatialPrimaryNoPlate = true;
    try {
      const ok = await engine.setDisplayMode("spatial");
      syncSpatialChrome(!!ok);
      if (!ok && engine.displayMode === "plate") {
        // Belt-and-suspenders: never leave the plate PNG as Spatial-primary UI.
        engine.showSpatialUnavailable?.(
          engine.lastSpatialFailure || "spatial-mount-failed"
        );
      }
      return !!ok;
    } catch (err) {
      console.warn("[PainLocator] Spatial primary failed", err);
      engine.showSpatialUnavailable?.(err?.message || "spatial-exception");
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

  async function engageBp3dAcrossShells(engine) {
    const canonicalOn = configureCanonicalEngagement();
    bindPresentationShellRefresh(engine);
    const spatialOn = await preferSpatialAcrossShells(engine);
    if (typeof console !== "undefined" && console.info) {
      console.info("[PainLocator] Spatial-primary locate engagement", {
        canonicalBodyMode: canonicalOn,
        spatialPrimary: spatialOn,
        plateFallback: engine?.displayMode === "plate",
        spatialStatus: engine?.displayMode,
        lastSpatialFailure: engine?.lastSpatialFailure || null,
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
