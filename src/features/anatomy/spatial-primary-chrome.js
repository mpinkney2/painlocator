/**
 * Spatial-primary locate chrome.
 *
 * Product rule: interactive locate is the rotatable 3D body (snap views + tap to mark).
 * The CAE 2D plate image is not shown alongside Spatial — it remains only as
 * silent fallback (no WebGL) and off-stage report/PDF compositing.
 *
 * Show the 2D/Spatial toggle only with ?displayToggle=1 | ?dev=1 | ?plate=1.
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

  function allowPlateToggle() {
    const params = readParams();
    return (
      isTruthyFlag(params.get("displayToggle")) ||
      isTruthyFlag(params.get("dev")) ||
      params.get("displayMode") === "plate" ||
      isTruthyFlag(params.get("plate"))
    );
  }

  function setActiveToolButton(tool) {
    document.querySelectorAll(".capture-tools .region-tool[data-tool]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tool === tool);
    });
  }

  /**
   * Apply locate chrome for Spatial-primary vs plate-fallback.
   * @param {boolean} isSpatial
   */
  function applySpatialPrimaryChrome(isSpatial) {
    const body = document.body;
    if (!body) return;

    body.classList.toggle("spatial-primary", !!isSpatial);
    body.classList.toggle("allow-plate-toggle", allowPlateToggle());

    const dock = document.getElementById("displayModeToggle");
    if (dock) {
      const showToggle = allowPlateToggle();
      dock.hidden = !showToggle;
      dock.setAttribute("aria-hidden", showToggle ? "false" : "true");
    }

    const enlarge = document.getElementById("btnEnlargeAnatomy");
    if (enlarge) {
      enlarge.hidden = !!isSpatial;
      enlarge.disabled = !!isSpatial;
    }

    // Plate-only drawing tools conflict with Spatial tap-to-mark.
    document
      .querySelectorAll(
        '.capture-tools .region-tool[data-tool="circle"], .capture-tools .region-tool[data-tool="polygon"]'
      )
      .forEach((btn) => {
        btn.hidden = !!isSpatial;
        if (isSpatial) btn.classList.remove("active");
      });

    const hint = document.getElementById("avatarHint");
    const locatePrompt = document.querySelector("#patientLocateCta .patient-locate-prompt");

    if (isSpatial) {
      const store =
        typeof entryStore !== "undefined"
          ? entryStore
          : global.entryStore || global.state?.engine?.markerStore;
      const current = store?.activeTool || "point";
      // Spatial marks via raycast tap — plate circle/polygon tools do not apply.
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
      const stage = document.getElementById("avatarStage");
      if (stage) {
        stage.setAttribute(
          "aria-label",
          "3D anatomy — drag to rotate, tap to mark pain at snap views"
        );
      }
    } else {
      if (enlarge) enlarge.hidden = false;
      document
        .querySelectorAll(
          '.capture-tools .region-tool[data-tool="circle"], .capture-tools .region-tool[data-tool="polygon"]'
        )
        .forEach((btn) => {
          btn.hidden = false;
        });
      if (hint && hint.textContent.includes("Drag to rotate")) {
        hint.textContent =
          "Choose a tool, mark where you feel pain, then describe intensity and symptoms";
      }
      if (locatePrompt) {
        locatePrompt.textContent = "Where does it hurt? Tap the body to mark pain.";
      }
    }

    document.getElementById("avatarWrap")?.classList.toggle("display-spatial", !!isSpatial);
    document.getElementById("avatarStage")?.classList.toggle("cae-spatial-host", !!isSpatial);
  }

  global.SpatialPrimaryChrome = {
    allowPlateToggle,
    applySpatialPrimaryChrome
  };
})(typeof window !== "undefined" ? window : globalThis);
