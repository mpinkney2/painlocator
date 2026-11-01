/**
 * Engage anatomy display across Patient + Clinician shells.
 *
 * Product default (UX proposal):
 * - Reliable 2D body map is the foundation for both roles
 * - Optional 3D (Spatial) loads only when requested (?spatial=1 | ?displayMode=spatial | UI toggle)
 * - A 3D failure must leave a usable 2D map and preserve entries
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
   * Prefer Spatial only when explicitly requested.
   * Default is the reliable 2D plate for both patient and clinician.
   */
  function shouldPreferSpatial() {
    const params = readParams();
    if (params.get("displayMode") === "plate" || isTruthyFlag(params.get("plate"))) {
      return false;
    }
    if (params.get("displayMode") === "spatial" || isTruthyFlag(params.get("spatial"))) {
      return true;
    }
    return false;
  }

  function syncSpatialChrome(isSpatial) {
    if (typeof global.SpatialPrimaryChrome?.applySpatialPrimaryChrome === "function") {
      global.SpatialPrimaryChrome.applySpatialPrimaryChrome(!!isSpatial, {
        keepSpatialPrimary: shouldPreferSpatial(),
        forcePlate: !shouldPreferSpatial() && !isSpatial
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
      // 2D default: ensure plate is active and Spatial-primary chrome is off.
      try {
        engine.spatialPrimaryNoPlate = false;
        if (typeof engine.enablePlateMode === "function") engine.enablePlateMode();
        else await engine.setDisplayMode("plate");
      } catch (err) {
        console.warn("[PainLocator] Plate default failed", err);
      }
      syncSpatialChrome(false);
      return false;
    }
    engine.spatialPrimaryNoPlate = true;
    try {
      const ok = await engine.setDisplayMode("spatial");
      syncSpatialChrome(!!ok);
      if (!ok) {
        // Failure must recover to usable 2D — do not leave an empty Spatial-primary stage.
        engine.spatialPrimaryNoPlate = false;
        try {
          if (typeof engine.enablePlateMode === "function") {
            engine.enablePlateMode(engine.lastSpatialFailure || "spatial-mount-failed");
          } else {
            await engine.setDisplayMode("plate");
          }
        } catch (_) { /* ignore */ }
        syncSpatialChrome(false);
        if (typeof global.showToast === "function") {
          global.showToast("3D body unavailable — showing 2D diagram.", { type: "warning" });
        }
      }
      return !!ok;
    } catch (err) {
      console.warn("[PainLocator] Spatial primary failed", err);
      engine.spatialPrimaryNoPlate = false;
      try {
        if (typeof engine.enablePlateMode === "function") {
          engine.enablePlateMode(err?.message || "spatial-exception");
        }
      } catch (_) { /* ignore */ }
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
