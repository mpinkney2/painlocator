/**
 * Likeness Builder — MetaHuman gallery + body/facial customization.
 * App-layer UX on top of CAE plate packs. Assistive only — not diagnostic.
 */

(function initLikenessBuilderModule() {
  const store = () => window.LikenessStore;

  function facialFilter(presetId) {
    return store().FACIAL_PRESETS.find((p) => p.id === presetId)?.filter || "none";
  }

  function buildScale(presetId) {
    return store().BUILD_PRESETS.find((p) => p.id === presetId)?.scaleX || 1;
  }

  function announce(msg) {
    const live = document.getElementById("likenessLive");
    if (live) live.textContent = msg;
  }

  function labelFor(modelValue) {
    return store().BODY_TYPES.find((b) => b.model === modelValue)?.label || modelValue;
  }

  function applyAppearanceToStage(prefs) {
    const img = document.querySelector(".cae-anatomy-image");
    if (img) {
      img.style.filter = facialFilter(prefs.facialPreset);
      img.style.transform = `scaleX(${buildScale(prefs.buildPreset)})`;
      img.style.transformOrigin = "center center";
    }

    const chip = document.getElementById("likenessPhotoChip");
    if (chip) {
      if (prefs.likenessPhotoDataUrl) {
        chip.hidden = false;
        const photo = chip.querySelector("img");
        if (photo) photo.src = prefs.likenessPhotoDataUrl;
        const name = chip.querySelector(".likeness-photo-name");
        if (name) name.textContent = prefs.likenessPhotoName || "Your photo";
      } else {
        chip.hidden = true;
      }
    }
  }

  function renderGallerySelection(bodyType) {
    document.querySelectorAll(".likeness-body-card").forEach((card) => {
      const on = card.dataset.body === bodyType;
      card.classList.toggle("is-selected", on);
      card.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function setPack(packId) {
    const pack = typeof setAnatomyPack === "function" ? setAnatomyPack(packId) : packId;
    const prefs = store().saveLikeness({ pack });
    document.querySelectorAll('input[name="anatomy_pack"]').forEach((el) => {
      el.checked = el.value === pack;
    });
    document.body.dataset.anatomyPack = pack;
    // Lifelike gallery is plate-backed today — ensure 2D stage is visible.
    if (pack === "metahuman" && typeof state !== "undefined" && state?.engine?.enablePlateMode) {
      state.engine.enablePlateMode("likeness-pack");
    }
    if (typeof state !== "undefined" && state?.engine) {
      state.engine.update({ modelType: state.modelType });
    }
    applyAppearanceToStage(prefs);
    announce(pack === "metahuman" ? "Lifelike body gallery" : "Classic clinical atlas");
    return prefs;
  }

  function selectBodyType(modelValue, { syncRadio = true } = {}) {
    const prefs = store().saveLikeness({ bodyType: modelValue, pack: "metahuman" });
    if (typeof setAnatomyPack === "function") setAnatomyPack("metahuman");
    if (typeof state !== "undefined" && state?.engine?.enablePlateMode) {
      state.engine.enablePlateMode("likeness-body");
    }

    if (syncRadio) {
      const radio = document.querySelector(`input[name="patient_model"][value="${modelValue}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    if (typeof state !== "undefined" && state) {
      state.modelType = modelValue;
      state.engine?.update({ modelType: modelValue });
    }

    renderGallerySelection(prefs.bodyType);
    applyAppearanceToStage(prefs);
    announce(`Body type: ${labelFor(modelValue)}`);
    return prefs;
  }

  function setFacialPreset(id) {
    const prefs = store().saveLikeness({ facialPreset: id });
    applyAppearanceToStage(prefs);
    return prefs;
  }

  function setBuildPreset(id) {
    const prefs = store().saveLikeness({ buildPreset: id });
    applyAppearanceToStage(prefs);
    return prefs;
  }

  function readPhotoFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("Choose an image file"));
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        reject(new Error("Photo must be under 4 MB"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read photo"));
      reader.readAsDataURL(file);
    });
  }

  async function onLikenessPhotoSelected(file) {
    try {
      const dataUrl = await readPhotoFile(file);
      const prefs = store().saveLikeness({
        likenessPhotoDataUrl: dataUrl,
        likenessPhotoName: file.name
      });
      applyAppearanceToStage(prefs);
      announce("Likeness photo saved on this device");
    } catch (err) {
      announce(err.message || "Photo upload failed");
    }
  }

  function requestBodyScan() {
    const prefs = store().saveLikeness({ scanStatus: "coming_soon" });
    const panel = document.getElementById("likenessScanStatus");
    if (panel) {
      panel.hidden = false;
      panel.textContent =
        "Full-body scan is on the roadmap. Pick a body type and optional photo likeness now — marks stay on the clinical coordinate plate.";
    }
    announce("Body scan coming soon");
    return prefs;
  }

  function buildGalleryHtml() {
    return store()
      .BODY_TYPES.map((b) => {
        const thumb =
          typeof getAnatomyThumbPath === "function"
            ? getAnatomyThumbPath(b.folder, "metahuman")
            : `/anatomy/metahuman/thumbs/${b.folder}.png`;
        return `<button type="button" class="likeness-body-card" data-body="${b.model}" aria-pressed="false">
          <span class="likeness-body-thumb"><img src="${thumb}" alt="" width="72" height="144" /></span>
          <span class="likeness-body-label">${b.label}</span>
        </button>`;
      })
      .join("");
  }

  function hydrate() {
    const prefs = store().loadLikeness();
    if (typeof setAnatomyPack === "function") setAnatomyPack(prefs.pack || "metahuman");
    document.body.dataset.anatomyPack = prefs.pack || "metahuman";

    document.querySelectorAll('input[name="anatomy_pack"]').forEach((el) => {
      el.checked = el.value === (prefs.pack || "metahuman");
    });

    renderGallerySelection(prefs.bodyType);
    document.querySelectorAll("#likenessFacialRow .likeness-chip").forEach((c) => {
      c.classList.toggle("is-selected", c.dataset.facial === prefs.facialPreset);
    });
    document.querySelectorAll("#likenessBuildRow .likeness-chip").forEach((c) => {
      c.classList.toggle("is-selected", c.dataset.build === prefs.buildPreset);
    });

    const radio = document.querySelector(`input[name="patient_model"][value="${prefs.bodyType}"]`);
    if (radio && !radio.checked) radio.checked = true;

    if (typeof state !== "undefined" && state) {
      state.modelType = prefs.bodyType || state.modelType;
      state.engine?.update({ modelType: state.modelType });
    }

    applyAppearanceToStage(prefs);

    if (prefs.scanStatus === "coming_soon") {
      const panel = document.getElementById("likenessScanStatus");
      if (panel) {
        panel.hidden = false;
        panel.textContent =
          "Full-body scan is on the roadmap. Body type + photo likeness are available now.";
      }
    }
  }

  function mount() {
    const host = document.getElementById("likenessBuilder");
    if (!host || host.dataset.mounted === "1") return;
    host.dataset.mounted = "1";

    host.innerHTML = `
      <div class="likeness-pack-toggle" role="radiogroup" aria-label="Anatomy style">
        <label class="likeness-pack-option">
          <input type="radio" name="anatomy_pack" value="metahuman" />
          <span>Lifelike body</span>
        </label>
        <label class="likeness-pack-option">
          <input type="radio" name="anatomy_pack" value="classic" />
          <span>Classic atlas</span>
        </label>
      </div>

      <p class="likeness-hint">Choose a body type close to you. Customize facial tone and build, or add a photo likeness. Full-body scan comes later.</p>

      <div class="likeness-gallery" id="likenessGallery" role="group" aria-label="Body types">
        ${buildGalleryHtml()}
      </div>

      <details class="likeness-customize" id="likenessCustomize">
        <summary>Customize likeness</summary>
        <div class="likeness-customize-body">
          <fieldset class="likeness-fieldset">
            <legend>Facial features</legend>
            <div class="likeness-chip-row" id="likenessFacialRow"></div>
          </fieldset>
          <fieldset class="likeness-fieldset">
            <legend>Body build</legend>
            <div class="likeness-chip-row" id="likenessBuildRow"></div>
          </fieldset>
          <fieldset class="likeness-fieldset">
            <legend>Your photo likeness</legend>
            <p class="likeness-micro">Optional reference kept on this device only. Not sent to a server.</p>
            <div class="likeness-photo-row">
              <label class="btn btn-secondary likeness-upload-btn">
                Upload photo
                <input type="file" id="likenessPhotoInput" accept="image/*" hidden />
              </label>
              <button type="button" class="btn btn-ghost" id="likenessPhotoClear">Remove</button>
            </div>
            <div class="likeness-photo-chip" id="likenessPhotoChip" hidden>
              <img alt="Uploaded likeness reference" />
              <span class="likeness-photo-name"></span>
            </div>
          </fieldset>
          <fieldset class="likeness-fieldset">
            <legend>Full-body scan</legend>
            <p class="likeness-micro">Phone or clinic scan → personal mesh registered to CAE coordinates.</p>
            <button type="button" class="btn btn-secondary" id="likenessScanBtn">Notify me — coming soon</button>
            <p class="likeness-scan-status" id="likenessScanStatus" hidden></p>
          </fieldset>
        </div>
      </details>
      <div class="sr-only" id="likenessLive" aria-live="polite"></div>
    `;

    const facialRow = host.querySelector("#likenessFacialRow");
    store().FACIAL_PRESETS.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "likeness-chip";
      btn.dataset.facial = p.id;
      btn.textContent = p.label;
      btn.addEventListener("click", () => {
        setFacialPreset(p.id);
        facialRow.querySelectorAll(".likeness-chip").forEach((c) =>
          c.classList.toggle("is-selected", c.dataset.facial === p.id)
        );
      });
      facialRow.appendChild(btn);
    });

    const buildRow = host.querySelector("#likenessBuildRow");
    store().BUILD_PRESETS.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "likeness-chip";
      btn.dataset.build = p.id;
      btn.textContent = p.label;
      btn.addEventListener("click", () => {
        setBuildPreset(p.id);
        buildRow.querySelectorAll(".likeness-chip").forEach((c) =>
          c.classList.toggle("is-selected", c.dataset.build === p.id)
        );
      });
      buildRow.appendChild(btn);
    });

    host.querySelector("#likenessGallery")?.addEventListener("click", (e) => {
      const card = e.target.closest(".likeness-body-card");
      if (card) selectBodyType(card.dataset.body);
    });

    host.querySelectorAll('input[name="anatomy_pack"]').forEach((el) => {
      el.addEventListener("change", () => {
        if (el.checked) setPack(el.value);
      });
    });

    host.querySelector("#likenessPhotoInput")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) onLikenessPhotoSelected(file);
      e.target.value = "";
    });

    host.querySelector("#likenessPhotoClear")?.addEventListener("click", () => {
      const prefs = store().clearLikenessPhoto();
      applyAppearanceToStage(prefs);
      announce("Photo likeness removed");
    });

    host.querySelector("#likenessScanBtn")?.addEventListener("click", requestBodyScan);

    const stage = document.getElementById("avatarStage");
    if (stage && !stage._likenessObserver) {
      const obs = new MutationObserver(() => {
        applyAppearanceToStage(store().loadLikeness());
      });
      obs.observe(stage, { childList: true, subtree: true });
      stage._likenessObserver = obs;
    }

    hydrate();
  }

  function initLikenessBuilder() {
    mount();
    document.querySelectorAll('input[name="patient_model"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        store().saveLikeness({ bodyType: e.target.value });
        renderGallerySelection(e.target.value);
        applyAppearanceToStage(store().loadLikeness());
      });
    });
  }

  window.LikenessBuilder = {
    init: initLikenessBuilder,
    selectBodyType,
    setPack,
    setFacialPreset,
    setBuildPreset,
    applyAppearanceToStage,
    hydrate
  };
})();
