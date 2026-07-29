function init() {
  restoreSavedTheme();
  entryStore.load();
  initPanelResizers();
  initMarkerContextMenu();
  initKeyboardShortcuts();
  initVisualization();
  initRegionTools();
  initReviewTools();

  entryStore.onChange(() => refreshUI());

  const stageEl = document.getElementById('avatarStage');
  state.engine = new ClinicalAnatomyEngine(stageEl, {
    modelType: state.modelType,
    viewType: state.view,
    painStyle: 'heatmap',
    physicianMode: state.physicianMode,
    rendererMode: 'clinical',
    markerStore: entryStore,
    activeLayers: { skin: true, muscle: false, skeletal: false, nerve: false, organ: false, vessel: false, lymphatic: false }
  });

  state.vizController.attachEngine(state.engine);
  state.vizController.refreshAvailability(state.modelType, state.view);

  const onRegionUpdate = ({ entry } = {}) => {
    if (!entryStore.getActiveEntry() && entry) entryStore.activeEntryId = DRAFT_KEY;
    if (entry) populateFormFromEntry(entry);
    document.getElementById('avatarHint')?.classList.add('hidden');
    refreshUI();
  };

  state.engine.on('regionplaced', onRegionUpdate);
  state.engine.on('regionselected', onRegionUpdate);
  state.engine.on('regionchanged', () => refreshUI());
  state.engine.on('markerplaced', onRegionUpdate);
  state.engine.on('markerselected', onRegionUpdate);
  state.engine.on('markermoved', () => refreshUI());

  entryStore.newEntry(normalizeModelType(state.modelType));

  ['accPainStyle', 'accAccessibility'].forEach(id => {
    document.getElementById(id)?.classList.add('collapsed');
  });
  document.getElementById('accDetail')?.classList.add('collapsed');
  document.getElementById('accAIOverlays')?.classList.add('collapsed');

  applyWorkflowMode('capture');

  document.querySelectorAll('input[name="patient_model"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.modelType = e.target.value;
      state.engine.update({ modelType: state.modelType });
      state.vizController?.refreshAvailability(state.modelType, state.view);
      refreshUI();
    });
  });

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

  const slider = document.getElementById('intensitySlider');
  slider.addEventListener('input', () => updateIntensityUI(slider.value));
  updateIntensityUI(slider.value, true);

  ['notesInput', 'durationSelect', 'occurrenceSelect'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => syncFormToActiveEntry());
    document.getElementById(id)?.addEventListener('input', () => syncFormToActiveEntry());
  });

  setupPillToggles('qualityPills');
  setupPillToggles('triggerPills');
  setupPillToggles('easePills', false);

  document.getElementById('btnLog').addEventListener('click', saveCurrentEntry);
  document.getElementById('btnNewEntry').addEventListener('click', startNewEntry);
  document.getElementById('btnRemoveMarker').addEventListener('click', removeSelectedRegions);
  document.getElementById('btnDeleteEntry').addEventListener('click', deleteActiveEntry);
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
    if (id && confirm('Delete this pain region?')) { entryStore.selectRegion(id); removeSelectedRegions(); }
  });
  ['regionLabelInput', 'regionLayerSelect', 'regionShapeSelect'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => { syncRegionEditorToStore(); refreshUI(); });
    document.getElementById(id)?.addEventListener('input', () => syncRegionEditorToStore());
  });
  document.getElementById('btnClear').addEventListener('click', clearAllEntries);
  document.getElementById('btnMic').addEventListener('click', toggleMic);

  document.getElementById('btnExport').addEventListener('click', openExportModal);
  ['btnExportPdf', 'btnExportPdfModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', async () => {
      await printClinicalReport();
      document.getElementById('exportModal')?.close();
    });
  });
  ['btnExportJson', 'btnExportJsonModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => { exportSessionJson(); document.getElementById('exportModal')?.close(); });
  });
  ['btnExportPng', 'btnExportPngModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', async () => {
      await captureClinicalSnapshot();
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
      await importSessionFromFile(file);
      alert('Session imported successfully.');
    } catch (err) {
      alert(err.message || 'Could not import session.');
    }
  });

  document.getElementById('btnInsights').addEventListener('click', () => {
    document.getElementById('insightsModalBody').innerHTML = generateInsights().html;
    document.getElementById('insightsModal').showModal();
  });
  document.getElementById('btnCopyShare').addEventListener('click', () => {
    navigator.clipboard.writeText(buildSharePayload()).then(() => alert('JSON snapshot copied.'));
  });
  document.getElementById('btnDownloadShare').addEventListener('click', () => {
    const blob = new Blob([buildSharePayload()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `painlocator-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  });

  initSpeech();
  initChart();
  updateChartTheme();
  syncThemeToggleLabel();
  refreshUI();
  if (window.lucide) lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', init);

function setBodyView(view) {
  if (!view) return;
  document.querySelectorAll('#viewSelector .view-btn, #quickViewBar .view-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
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
