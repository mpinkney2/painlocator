/**
 * Development-only Spatial / BP3D diagnostics panel.
 * Enable with ?spatialDiagnostics=1 (or ?dev=1 on non-production).
 * Never shows patient identifiers or pain-entry payloads.
 */
(function (global) {
  let panelEl = null;
  let bound = false;

  function utils() {
    return global.SpatialBootUtils || null;
  }

  function enabled() {
    const u = utils();
    return !!(u && u.wantsSpatialDiagnostics && u.wantsSpatialDiagnostics());
  }

  function escapeText(value) {
    return String(value == null ? "" : value).replace(/[<>&]/g, "");
  }

  function row(label, value) {
    return (
      '<div class="cae-spatial-diag-row"><span class="cae-spatial-diag-k">' +
      escapeText(label) +
      '</span><span class="cae-spatial-diag-v">' +
      escapeText(value) +
      "</span></div>"
    );
  }

  function section(title, bodyHtml) {
    return (
      '<section class="cae-spatial-diag-section"><h3>' +
      escapeText(title) +
      "</h3>" +
      bodyHtml +
      "</section>"
    );
  }

  function engine() {
    return global.state && global.state.engine ? global.state.engine : null;
  }

  function buildHtml(snap) {
    const s = snap || {};
    return (
      '<div class="cae-spatial-diag-card">' +
      '<header class="cae-spatial-diag-header"><strong>SPATIAL STATUS</strong>' +
      '<button type="button" class="cae-spatial-diag-close" id="caeSpatialDiagClose" aria-label="Close diagnostics">×</button></header>' +
      section(
        "Renderer",
        row("health", s.health) +
          row("displayMode", s.displayMode) +
          row("bootState", s.bootState) +
          row("WebGL", s.webglAvailable) +
          row("Three REVISION", s.threeRevision) +
          row("runtime", s.runtimeVersion)
      ) +
      section(
        "Exterior",
        row("modelId", s.exteriorModelId || "—") +
          row("loaded", s.exteriorLoaded) +
          row("meshCount", s.meshCount != null ? s.meshCount : "—")
      ) +
      section(
        "Canonical",
        row("expected", s.canonicalExpected) +
          row("ready", s.canonicalReady) +
          row("degraded", s.canonicalDegraded) +
          row("fromCache", s.canonicalFromCache)
      ) +
      section(
        "BP3D Layers",
        row("depth", s.layerDepth) +
          row("muscleLoaded", s.muscleLoaded) +
          row("skeletalLoaded", s.skeletalLoaded) +
          row("patientIsolation", s.patientLayerIsolation)
      ) +
      section(
        "Presentation",
        row("mode", s.presentationMode || "—")
      ) +
      section("Last error", row("message", s.lastFailure || "none")) +
      '<div class="cae-spatial-diag-actions">' +
      '<button type="button" class="btn btn-primary" id="caeDiagRetrySpatial">Retry Spatial</button>' +
      '<button type="button" class="btn btn-ghost" id="caeDiagRetryCanonical">Retry Canonical</button>' +
      '<button type="button" class="btn btn-ghost" id="caeDiagClearCache">Clear Spatial Cache</button>' +
      '<button type="button" class="btn btn-ghost" id="caeDiagCopy">Copy Diagnostics JSON</button>' +
      "</div></div>"
    );
  }

  function refresh() {
    if (!panelEl || !enabled()) return;
    const u = utils();
    const snap = u && u.collectDiagnostics ? u.collectDiagnostics(engine()) : {};
    const body = panelEl.querySelector(".cae-spatial-diag-inner");
    if (body) body.innerHTML = buildHtml(snap);
    bindActions();
  }

  function bindActions() {
    if (!panelEl) return;
    panelEl.querySelector("#caeSpatialDiagClose")?.addEventListener("click", () => {
      panelEl.hidden = true;
    });
    panelEl.querySelector("#caeDiagRetrySpatial")?.addEventListener("click", async () => {
      const eng = engine();
      const three = global.SpatialThreeLoader;
      three?.clearThreeCache?.();
      const u = utils();
      u?.resetDiagnosticsLogFlag?.();
      if (eng?.setDisplayMode) {
        await eng.setDisplayMode("spatial");
        u?.logDiagnosticsOnce?.(eng, { force: true });
        refresh();
      }
    });
    panelEl.querySelector("#caeDiagRetryCanonical")?.addEventListener("click", async () => {
      const eng = engine();
      const renderer = eng?.spatialRenderer;
      const loader = global.CanonicalBodyLoader;
      loader?.clearCache?.();
      if (renderer && typeof renderer._initCanonicalFrameIfEnabled === "function") {
        try {
          await renderer._initCanonicalFrameIfEnabled();
        } catch (err) {
          console.warn("[Spatial Diagnostics] canonical retry failed", err);
        }
      }
      refresh();
    });
    panelEl.querySelector("#caeDiagClearCache")?.addEventListener("click", () => {
      global.SpatialThreeLoader?.clearThreeCache?.();
      global.CanonicalBodyLoader?.clearCache?.();
      global.SpatialLayerLoader?.clearPackCache?.();
      global.SpatialLayerLoader?.clearRegistrationCache?.();
      refresh();
    });
    panelEl.querySelector("#caeDiagCopy")?.addEventListener("click", async () => {
      const u = utils();
      const snap = u?.collectDiagnostics?.(engine()) || {};
      const text = JSON.stringify(snap, null, 2);
      try {
        await navigator.clipboard.writeText(text);
      } catch (_) {
        console.info("[PainLocator Spatial Diagnostics JSON]", snap);
      }
    });
  }

  function ensurePanel() {
    if (!enabled()) return null;
    if (panelEl) return panelEl;
    panelEl = document.createElement("aside");
    panelEl.id = "caeSpatialDiagnostics";
    panelEl.className = "cae-spatial-diagnostics";
    panelEl.setAttribute("aria-label", "Spatial diagnostics");
    panelEl.innerHTML = '<div class="cae-spatial-diag-inner"></div>';
    document.body.appendChild(panelEl);
    return panelEl;
  }

  function mount() {
    if (!enabled()) return;
    ensurePanel();
    refresh();
    if (!bound) {
      bound = true;
      const eng = engine();
      eng?.on?.("spatialbootstate", () => refresh());
      eng?.on?.("displaymodechanged", () => {
        setTimeout(refresh, 50);
      });
      setInterval(() => {
        if (panelEl && !panelEl.hidden) refresh();
      }, 4000);
    }
  }

  function init() {
    if (!enabled()) return;
    const start = () => mount();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
    // Late bind after bootstrap creates engine.
    setTimeout(start, 800);
    setTimeout(start, 2500);
  }

  global.SpatialDiagnostics = {
    enabled,
    mount,
    refresh,
    init
  };

  init();
})(typeof window !== "undefined" ? window : globalThis);
