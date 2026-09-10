function restoreSavedBodyType() {
  try {
    const storedBody = localStorage.getItem('painlocator_body_type');
    if (!storedBody) return;
    const storedRadio = document.querySelector(`#modelSelector input[name="patient_model"][value="${storedBody}"]`);
    if (!storedRadio) return;
    state.modelType = storedBody;
    storedRadio.checked = true;
  } catch (_) { /* ignore */ }
}

function init() {
  restoreSavedTheme();
  restoreSavedBodyType();

  // Demo mode may remap storage key before load
  demoMode?.initControls?.();
  entryStore.load();

  initPanelResizers();
  initMarkerContextMenu();
  initKeyboardShortcuts();
  initVisualization();
  initRegionTools();
  initReviewTools();

  entryStore.onChange(() => {
    updateUndoRedoButtons?.();
    refreshUI();
  });

  const stageEl = document.getElementById('avatarStage');
  const preferSpatial =
    typeof Bp3dShellEngagement !== 'undefined' &&
    Bp3dShellEngagement.shouldPreferSpatial();

  if (preferSpatial) {
    document.body?.classList.add('spatial-primary');
  }

  state.engine = new ClinicalAnatomyEngine(stageEl, {
    modelType: state.modelType,
    viewType: state.view,
    painStyle: 'heatmap',
    physicianMode: state.physicianMode,
    rendererMode: 'clinical',
    markerStore: entryStore,
    activeLayers: { skin: true, muscle: false, skeletal: false, nerve: false, organ: false, vessel: false, lymphatic: false },
    // Do not flash the 2D plate PNG while Spatial boots.
    deferPlateRender: preferSpatial,
    spatialPrimaryNoPlate: preferSpatial
  });

  state.vizController.attachEngine(state.engine);
  state.vizController.refreshAvailability(state.modelType, state.view);
  initAnatomyZoom();
  initDisplayModeToggle();

  // Spatial-primary locate: rotatable 3D across Patient + Clinician (plate = explicit only).
  if (typeof Bp3dShellEngagement !== "undefined") {
    Bp3dShellEngagement.engageBp3dAcrossShells(state.engine).catch((err) => {
      console.warn("[PainLocator] Spatial-primary engagement failed", err);
      state.engine?.showSpatialUnavailable?.(err?.message || "engagement-failed");
    });
  }

  const onRegionUpdate = ({ entry } = {}) => {
    if (!entryStore.getActiveEntry() && entry) entryStore.activeEntryId = DRAFT_KEY;
    if (entry) populateFormFromEntry(entry);
    document.getElementById('avatarHint')?.classList.add('hidden');
    hideAnatomyTip?.();
    refreshUI();
  };

  state.engine.on('regionplaced', onRegionUpdate);
  state.engine.on('regionselected', onRegionUpdate);
  state.engine.on('regionchanged', () => {
    entryStore.commitGeometry?.();
    refreshUI();
  });
  state.engine.on('markerplaced', onRegionUpdate);
  state.engine.on('markerselected', onRegionUpdate);
  state.engine.on('markermoved', () => {
    entryStore.commitGeometry?.();
    refreshUI();
  });

  // Do NOT auto-create a blank draft on load — only restore existing draft or stay empty
  if (entryStore.draftEntry && entryStore.draftEntry.regions?.length) {
    entryStore.activeEntryId = DRAFT_KEY;
    populateFormFromEntry(entryStore.draftEntry);
  } else if (entryStore.activeEntryId && entryStore.getActiveEntry()) {
    populateFormFromEntry(entryStore.getActiveEntry());
  } else {
    entryStore.draftEntry = null;
    entryStore.activeEntryId = null;
  }

  ['accPainStyle', 'accAccessibility'].forEach(id => {
    document.getElementById(id)?.classList.add('collapsed');
  });
  document.getElementById('accDetail')?.classList.add('collapsed');
  document.getElementById('accAIOverlays')?.classList.add('collapsed');

  applyWorkflowMode(demoMode?.isActive?.() ? 'review' : 'capture');

  document.querySelectorAll('input[name="patient_model"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.modelType = e.target.value;
      try { localStorage.setItem('painlocator_body_type', state.modelType); } catch (_) { /* ignore */ }
      const active = entryStore.getActiveEntry();
      if (active && entryStore.isDraftActive()) {
        entryStore.updateActiveEntry({ patientModel: normalizeModelType(state.modelType) });
      }
      state.engine.update({ modelType: state.modelType });
      state.vizController?.refreshAvailability(state.modelType, state.view);
      syncBodyTypeGallery(state.modelType);
      refreshUI();
    });
  });

  initBodyTypeGallery();
  syncBodyTypeGallery(state.modelType);

  document.querySelectorAll('#viewSelector .view-btn, #quickViewBar .view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setBodyView(btn.dataset.view);
    });
  });

  const bodySettings = document.getElementById('bodySettings');
  if (bodySettings && window.matchMedia('(max-width: 900px)').matches) {
    bodySettings.open = false;
  }
  window.matchMedia('(max-width: 900px)').addEventListener('change', (e) => {
    const el = document.getElementById('bodySettings');
    if (!el) return;
    el.open = !e.matches;
  });

  document.querySelectorAll('input[name="body_detail"]').forEach(radio => {
    radio.addEventListener('change', (e) => state.engine.update({ detailLevel: e.target.value }));
  });

  document.querySelectorAll('input[name="pain_style"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.engine.update({ painStyle: e.target.value });
      if (state.vizController?.baseMode !== 'heatmap') {
        document.querySelector('input[name="viz_mode"][value="standard"]').checked = true;
      }
    });
  });

  document.getElementById('checkContrast')?.addEventListener('change', (e) => {
    document.body.classList.toggle('high-contrast-active', e.target.checked);
    state.engine.update({ accessibility: { contrast: e.target.checked } });
  });
  document.getElementById('checkColorblind')?.addEventListener('change', (e) => {
    document.body.classList.toggle('colorblind-active', e.target.checked);
    state.engine.update({ accessibility: { colorblind: e.target.checked } });
  });
  document.getElementById('checkTargets')?.addEventListener('change', (e) => {
    document.body.classList.toggle('large-targets-active', e.target.checked);
    state.engine.update({ accessibility: { targets: e.target.checked } });
  });

  // Reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.body.classList.add('reduced-motion-active');
  }

  const slider = document.getElementById('intensitySlider');
  slider.addEventListener('input', () => {
    updateIntensityUI(slider.value);
    if (!entryStore.getActiveEntry()) {
      entryStore.ensureActiveEntry(normalizeModelType(state.modelType));
    }
    syncFormToActiveEntry();
  });
  updateIntensityUI(slider.value, true);

  ['notesInput', 'durationSelect', 'occurrenceSelect'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => syncFormToActiveEntry());
    document.getElementById(id)?.addEventListener('input', () => syncFormToActiveEntry());
  });

  setupPillToggles('qualityPills');
  setupPillToggles('triggerPills');
  setupPillToggles('easePills', false);

  document.getElementById('btnLog').addEventListener('click', () => saveCurrentEntry());
  document.getElementById('btnNewEntry').addEventListener('click', startNewEntry);
  document.getElementById('btnRemoveMarker').addEventListener('click', removeSelectedRegions);
  document.getElementById('btnDeleteEntry').addEventListener('click', deleteActiveEntry);
  document.getElementById('btnUndo')?.addEventListener('click', performUndo);
  document.getElementById('btnRedo')?.addEventListener('click', performRedo);
  document.getElementById('btnPeekUndo')?.addEventListener('click', (e) => {
    e.stopPropagation();
    performUndo();
  });
  document.getElementById('btnPeekRedo')?.addEventListener('click', (e) => {
    e.stopPropagation();
    performRedo();
  });
  document.getElementById('btnDupRegion')?.addEventListener('click', () => {
    const id = entryStore.selectedRegionIds[0];
    if (id) { entryStore.duplicateRegion(id); refreshUI(); }
  });
  document.getElementById('btnMirrorRegion')?.addEventListener('click', () => {
    const id = entryStore.selectedRegionIds[0];
    if (id) { entryStore.mirrorRegion(id, useClinicalLabels()); refreshUI(); }
  });
  document.getElementById('btnDeleteRegion')?.addEventListener('click', () => {
    const id = entryStore.selectedRegionIds[0];
    if (id && confirm('Delete this pain region?')) {
      entryStore.selectRegion(id);
      removeSelectedRegions();
    }
  });
  ['regionLabelInput', 'regionLayerSelect', 'regionShapeSelect'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => { syncRegionEditorToStore(); refreshUI(); });
    document.getElementById(id)?.addEventListener('input', () => syncRegionEditorToStore());
  });
  document.getElementById('btnClear').addEventListener('click', clearAllEntries);
  document.getElementById('btnMic').addEventListener('click', toggleMic);
  document.getElementById('btnFeedback')?.addEventListener('click', () => openFeedbackForm());
  document.getElementById('btnHelpMenu')?.addEventListener('click', () => {
    document.getElementById('helpModal')?.showModal();
  });
  document.getElementById('btnRestartWalkthrough')?.addEventListener('click', () => {
    document.getElementById('helpModal')?.close();
    walkthrough?.restart();
  });

  document.getElementById('btnExport').addEventListener('click', () => {
    openExportModal();
    trackEvent?.('report_opened');
  });
  ['btnExportPdf', 'btnExportPdfModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', async () => {
      setSaveStatus?.('report', 'Preparing report…');
      await printClinicalReport();
      setSaveStatus?.('report', 'Report ready');
      trackEvent?.('report_exported', { format: 'pdf' });
      document.getElementById('exportModal')?.close();
    });
  });
  ['btnExportJson', 'btnExportJsonModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      exportSessionJson();
      setSaveStatus?.('exported');
      showToast?.('Session JSON exported.', { type: 'success' });
      trackEvent?.('report_exported', { format: 'json' });
      document.getElementById('exportModal')?.close();
    });
  });
  ['btnExportPng', 'btnExportPngModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', async () => {
      await captureClinicalSnapshot();
      setSaveStatus?.('exported');
      showToast?.('Anatomy snapshot saved.', { type: 'success' });
      trackEvent?.('report_exported', { format: 'png' });
      document.getElementById('exportModal')?.close();
    });
  });
  ['btnImport', 'btnImportSidebar'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', openImportSessionPicker);
  });
  document.getElementById('importSessionInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (entryStore.entries.length && !confirm('Import replaces the current session. Continue?')) {
        e.target.value = '';
        return;
      }
      await importSessionFromFile(file);
      setSaveStatus?.('imported');
      showToast?.('Session imported successfully.', { type: 'success' });
      dismissWelcome?.();
    } catch (err) {
      showToast?.(err.message || 'Could not import session.', { type: 'error', assertive: true });
    }
    e.target.value = '';
  });

  document.getElementById('btnInsights').addEventListener('click', () => {
    document.getElementById('insightsModalBody').innerHTML = generateInsights().html;
    document.getElementById('insightsModal').showModal();
  });
  document.getElementById('btnCopyShare').addEventListener('click', () => {
    navigator.clipboard.writeText(buildSharePayload()).then(() => {
      showToast?.('JSON snapshot copied.', { type: 'success' });
    });
  });
  document.getElementById('btnDownloadShare').addEventListener('click', () => {
    const blob = new Blob([buildSharePayload()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `painlocator-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast?.('Download started.', { type: 'success' });
  });
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('dialog')?.close());
  });

  initSpeech();
  initChart();
  updateChartTheme();
  syncThemeToggleLabel();

  if (typeof initPresentationMode === 'function') initPresentationMode();
  else if (typeof window.initPresentationMode === 'function') window.initPresentationMode();
  if (typeof initPatientFlow === 'function') initPatientFlow();
  else if (typeof window.initPatientFlow === 'function') window.initPatientFlow();

  refreshUI();
  maybeShowWelcome?.();
  if (!demoMode?.isActive?.() && !entryStore.entries.length) showAnatomyTip?.();
  if (window.lucide) lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', init);

function setBodyView(view) {
  if (!view) return;
  document.querySelectorAll('#viewSelector .view-btn, #quickViewBar .view-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
    b.setAttribute('aria-pressed', b.dataset.view === view ? 'true' : 'false');
  });
  document.querySelectorAll('#simpleViewBar [data-view], #simpleViewCompass [data-view]').forEach((b) => {
    const on = b.getAttribute('data-view') === view;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  state.view = view;
  state.engine?.update({ viewType: state.view });
  state.vizController?.refreshAvailability(state.modelType, state.view);
  refreshUI();
}

function syncThemeToggleLabel() {
  const themeBtn = document.getElementById('btnThemeToggle');
  if (!themeBtn) return;
  const isDark = document.body.classList.contains('theme-dark');
  themeBtn.innerHTML = isDark
    ? '<i data-lucide="sun"></i><span class="btn-label desktop-only"> Light Mode</span>'
    : '<i data-lucide="moon"></i><span class="btn-label desktop-only"> Dark Mode</span>';
  themeBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  if (window.lucide) lucide.createIcons();
}

function toggleTheme() {
  applyTheme(document.body.classList.contains('theme-dark') ? 'light' : 'dark');
  syncThemeToggleLabel();
}
window.toggleTheme = toggleTheme;
window.setBodyView = setBodyView;

/** Sync body-profile gallery with #modelSelector radios (male/female/teen/child/senior). */
function syncBodyTypeGallery(model) {
  const value = model || 'male';
  document.querySelectorAll('#bodyTypeGallery .body-type-option').forEach((btn) => {
    const on = btn.dataset.model === value;
    btn.classList.toggle('is-selected', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  const radio = document.querySelector(`#modelSelector input[name="patient_model"][value="${value}"]`);
  if (radio && !radio.checked) radio.checked = true;
}

function initBodyTypeGallery() {
  const gallery = document.getElementById('bodyTypeGallery');
  if (!gallery || gallery.dataset.bound === '1') return;
  gallery.dataset.bound = '1';
  gallery.querySelectorAll('.body-type-option').forEach((btn) => {
    btn.setAttribute('role', 'radio');
    btn.addEventListener('click', () => {
      const model = btn.dataset.model;
      if (!model) return;
      const radio = document.querySelector(`#modelSelector input[name="patient_model"][value="${model}"]`);
      if (radio) {
        if (!radio.checked) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          syncBodyTypeGallery(model);
        }
      } else {
        state.modelType = model;
        try { localStorage.setItem('painlocator_body_type', model); } catch (_) { /* ignore */ }
        state.engine?.update({ modelType: model });
        syncBodyTypeGallery(model);
        refreshUI();
      }
    });
  });
}

window.syncBodyTypeGallery = syncBodyTypeGallery;
