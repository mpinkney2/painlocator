/**
 * Spatial-primary locate chrome.
 *
 * Product rule: interactive locate is the rotatable 3D body (snap views + tap to mark).
 * The CAE 2D plate image must NOT appear as the default locate surface.
 * Plate is only for explicit opt-in (?plate=1) or the "Use 2D diagram" control,
 * plus off-stage report/PDF compositing.
 */
(function (global) {
  function readParams() {
    try {
      return new URLSearchParams(global.location?.search || "");
    } catch (_) {
      return new URLSearchParams();
    }
  }

  function isTruthyFlag(value) {
    if (value == null || value === "") return false;
    const v = String(value).trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes" || v === "on";
  }

  function wantsPlateOptIn() {
    const params = readParams();
    return params.get("displayMode") === "plate" || isTruthyFlag(params.get("plate"));
  }

  function allowPlateToggle() {
    const params = readParams();
    return (
      isTruthyFlag(params.get("displayToggle")) ||
      isTruthyFlag(params.get("dev")) ||
      wantsPlateOptIn()
    );
  }

  function setActiveToolButton(tool) {
    document.querySelectorAll(".capture-tools .region-tool[data-tool]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tool === tool);
    });
  }

  function humanReason(reason) {
    const r = String(reason || "");
    if (/SpatialThreeLoader failed to load|Can't find variable: SpatialThreeLoader|SpatialThreeLoader is not defined/i.test(r)) {
      return "A 3D boot script did not load. Hard-refresh (Cmd+Shift+R), then Retry 3D.";
    }
    if (/^WebGL unavailable$/i.test(r) || /webgl unavailable/i.test(r)) {
      return "WebGL 3D is blocked in this preview. Open http://localhost:5500 in system Chrome or Edge (not the Cursor preview panel), then Retry.";
    }
    if (/WebGLRenderer failed|Error creating WebGL context/i.test(r)) {
      return "WebGL context could not start. Close other 3D tabs, then open localhost:5500 in system Chrome/Edge and Retry.";
    }
    if (/WebGLRenderer|Three\.js module loaded without/i.test(r)) {
      return "The 3D library failed to initialize. Hard-refresh the page, then Retry.";
    }
    if (/timed out|timeout/i.test(r)) {
      return "3D loading took too long and was stopped. Check your network, then Retry.";
    }
    if (/three|import/i.test(r)) return "The 3D library failed to load.";
    if (/glb|manifest|exterior|fetch|network/i.test(r)) return "The 3D body model failed to load.";
    if (/mount|unavailable|exception/i.test(r)) return "The 3D body could not start in this session.";
    return "The 3D body is not available in this preview yet.";
  }

  /**
   * Replace stage contents with a Spatial status panel (never the plate PNG).
   * @param {HTMLElement|null} stage
   * @param {"loading"|"unavailable"} kind
   * @param {string} [reason]
   * @param {string} [loadingTitle]
   */
  function renderStageStatus(stage, kind, reason, loadingTitle) {
    if (!stage) stage = document.getElementById("avatarStage");
    const host =
      stage?.querySelector?.(".cae-stage") ||
      stage ||
      document.getElementById("avatarStage");
    if (!host) return;

    // Prefer writing into .cae-stage when present so engine.stage stays valid.
    const target =
      host.classList?.contains("cae-stage")
        ? host
        : host.querySelector?.(".cae-stage") || host;

    const detail = humanReason(reason);
    const loading = kind === "loading";
    target.classList.remove("cae-plate-active", "cae-spatial-active");
    target.classList.add("cae-spatial-staging");

    // Keep an existing Spatial viewport (hidden while loading); replace only status UI.
    let status = target.querySelector(".cae-spatial-status");
    if (!status) {
      status = document.createElement("div");
      status.className = "cae-spatial-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      target.appendChild(status);
    }
    status.style.position = "absolute";
    status.style.inset = "0";
    status.style.zIndex = "5";

    status.innerHTML =
      '<div class="cae-spatial-status-card">' +
      (loading
        ? '<p class="cae-spatial-status-title">' +
          (loadingTitle || "Loading 3D body…") +
          "</p>" +
          '<p class="cae-spatial-status-copy">Preparing the rotatable model for pain locate.</p>' +
          '<div class="cae-spatial-status-spinner" aria-hidden="true"></div>'
        : '<p class="cae-spatial-status-title">3D body unavailable</p>' +
          '<p class="cae-spatial-status-copy">' +
          detail +
          "</p>" +
          '<div class="cae-spatial-status-actions">' +
          '<button type="button" class="btn btn-primary" id="btnRetrySpatial">Retry 3D</button>' +
          '<button type="button" class="btn btn-ghost" id="btnUsePlateFallback">Use 2D diagram</button>' +
          "</div>" +
          (reason
            ? '<p class="cae-spatial-status-tech">' +
              String(reason).replace(/[<>&]/g, "") +
              "</p>"
            : "")) +
      "</div>";

    if (!loading) {
      status.querySelector("#btnRetrySpatial")?.addEventListener("click", () => {
        const engine = global.state?.engine;
        renderStageStatus(stage, "loading", null, "Retrying 3D body…");
        engine?.setDisplayMode?.("spatial")?.then((ok) => {
          if (!ok) {
            const why = engine?.lastSpatialFailure || "spatial-mount-failed";
            renderStageStatus(stage, "unavailable", why);
            applySpatialPrimaryChrome(false, { keepSpatialPrimary: true });
          } else {
            applySpatialPrimaryChrome(true);
          }
        });
      });
      status.querySelector("#btnUsePlateFallback")?.addEventListener("click", () => {
        global.state?.engine?.setDisplayMode?.("plate");
        applySpatialPrimaryChrome(false, { keepSpatialPrimary: false });
      });
    }
  }

  /**
   * @param {boolean} isSpatial
   * @param {{ keepSpatialPrimary?: boolean }} [opts]
   */
  function applySpatialPrimaryChrome(isSpatial, opts = {}) {
    const body = document.body;
    if (!body) return;

    const spatialPrimaryShell = opts.keepSpatialPrimary || !!isSpatial || !wantsPlateOptIn();
    body.classList.toggle("spatial-primary", spatialPrimaryShell);
    body.classList.toggle("allow-plate-toggle", allowPlateToggle());
    body.classList.toggle("spatial-ready", !!isSpatial);

    const dock = document.getElementById("displayModeToggle");
    if (dock) {
      const showToggle = allowPlateToggle();
      dock.hidden = !showToggle;
      dock.setAttribute("aria-hidden", showToggle ? "false" : "true");
    }

    const enlarge = document.getElementById("btnEnlargeAnatomy");
    if (enlarge) {
      const hidePlateTools = spatialPrimaryShell && !wantsPlateOptIn();
      enlarge.hidden = hidePlateTools || !!isSpatial;
      enlarge.disabled = !!isSpatial || hidePlateTools;
    }

    document
      .querySelectorAll(
        '.capture-tools .region-tool[data-tool="circle"], .capture-tools .region-tool[data-tool="polygon"]'
      )
      .forEach((btn) => {
        const hide = (spatialPrimaryShell && !wantsPlateOptIn()) || !!isSpatial;
        btn.hidden = hide;
        if (hide) btn.classList.remove("active");
      });

    const hint = document.getElementById("avatarHint");
    const locatePrompt = document.querySelector("#patientLocateCta .patient-locate-prompt");

    if (isSpatial) {
      const store =
        typeof entryStore !== "undefined"
          ? entryStore
          : global.entryStore || global.state?.engine?.markerStore;
      const current = store?.activeTool || "point";
      const next =
        current === "select" || current === "eraser" || current === "point" ? current : "point";
      if (store?.setTool) store.setTool(next);
      setActiveToolButton(next);

      const spatialHint =
        "Drag to rotate · Front / Back / Left / Right snap · Tap the body to mark pain";
      if (hint) {
        hint.textContent = spatialHint;
        hint.classList.remove("hidden");
      }
      if (locatePrompt) {
        locatePrompt.textContent = "Where does it hurt? Rotate and tap the body to mark pain.";
      }
      document
        .getElementById("avatarStage")
        ?.setAttribute(
          "aria-label",
          "3D anatomy — drag to rotate, tap to mark pain at snap views"
        );
    } else if (spatialPrimaryShell && !wantsPlateOptIn()) {
      if (hint) {
        hint.textContent = "Waiting for the 3D body — rotate and tap once it loads.";
        hint.classList.remove("hidden");
      }
    }

    document.getElementById("avatarWrap")?.classList.toggle("display-spatial", !!isSpatial);
    document.getElementById("avatarStage")?.classList.toggle("cae-spatial-host", !!isSpatial);
  }

  global.SpatialPrimaryChrome = {
    allowPlateToggle,
    wantsPlateOptIn,
    applySpatialPrimaryChrome,
    renderStageStatus,
    humanReason
  };
})(typeof window !== "undefined" ? window : globalThis);
