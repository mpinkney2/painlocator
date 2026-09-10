/**
 * Demo Mode — isolated fictional data namespace.
 * Never merges with or overwrites real user entries.
 */
(function initDemoMode() {
  const DEMO_ACTIVE_KEY = 'painlocator_demo_active';
  const DEMO_SCENARIO_KEY = 'painlocator_demo_scenario';
  const DEMO_STORAGE_KEY = 'painlocator_demo_entries';
  const REAL_STORAGE_KEY = 'painlocator_pain_entries';
  const REAL_BACKUP_KEY = 'painlocator_real_entries_backup';
  const WALKTHROUGH_DONE_KEY = 'painlocator_walkthrough_done';
  const DEMO_WALKTHROUGH_DONE_KEY = 'painlocator_demo_walkthrough_done';

  let active = false;
  let scenarioId = localStorage.getItem(DEMO_SCENARIO_KEY) || 'post-procedure';

  function isActive() {
    return active || localStorage.getItem(DEMO_ACTIVE_KEY) === '1';
  }

  function getScenario() {
    return (window.DEMO_SCENARIOS || []).find(s => s.id === scenarioId) || window.DEMO_SCENARIOS?.[0];
  }

  function updateBadge() {
    const badge = document.getElementById('demoModeBadge');
    const exitBtn = document.getElementById('btnExitDemo');
    const resetBtn = document.getElementById('btnResetDemo');
    const scenarioSel = document.getElementById('demoScenarioSelect');
    document.body.classList.toggle('demo-mode-active', isActive());
    if (badge) badge.hidden = !isActive();
    if (exitBtn) exitBtn.hidden = !isActive();
    if (resetBtn) resetBtn.hidden = !isActive();
    if (scenarioSel) {
      scenarioSel.hidden = !isActive();
      scenarioSel.value = scenarioId;
    }
  }

  function swapStoreKeys(toDemo) {
    // Remap the store's storage key via pain-models constant override
    if (typeof window.setEntryStorageKey === 'function') {
      window.setEntryStorageKey(toDemo ? DEMO_STORAGE_KEY : REAL_STORAGE_KEY);
    }
  }

  function backupRealData() {
    const raw = localStorage.getItem(REAL_STORAGE_KEY);
    if (raw) localStorage.setItem(REAL_BACKUP_KEY, raw);
  }

  function restoreRealData() {
    const backup = localStorage.getItem(REAL_BACKUP_KEY);
    if (backup != null) {
      localStorage.setItem(REAL_STORAGE_KEY, backup);
      localStorage.removeItem(REAL_BACKUP_KEY);
    }
  }

  function seedScenario(id) {
    scenarioId = id || scenarioId;
    localStorage.setItem(DEMO_SCENARIO_KEY, scenarioId);
    const scenario = getScenario();
    const entries = buildScenarioEntries(scenario.id);
    const envelope = {
      schemaVersion: '1.1.0',
      entries,
      draftEntry: null,
      activeEntryId: entries[entries.length - 1]?.id || null,
      selectedRegionIds: [],
      activeTool: 'circle',
      isDemo: true,
      scenarioId: scenario.id,
      fictional: true
    };
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(envelope));
    return scenario;
  }

  function applyScenarioToUI(scenario) {
    if (!scenario) return;
    const model = typeof normalizeModelType === 'function' ? normalizeModelType(scenario.model) : scenario.model;
    const radioValue = typeof clinicianRadioValue === 'function' ? clinicianRadioValue(model) : scenario.model;
    const radio = document.querySelector(`input[name="patient_model"][value="${radioValue}"]`);
    if (radio) radio.checked = true;
    state.modelType = model;
    if (typeof setBodyView === 'function') setBodyView(scenario.defaultView);
    else state.view = scenario.defaultView;
    if (typeof syncBodyTypeGallery === 'function') syncBodyTypeGallery(state.modelType);
    else if (typeof window.syncBodyTypeGallery === 'function') window.syncBodyTypeGallery(state.modelType);
  }

  function enter(options = {}) {
    if (isActive() && !options.force) {
      if (options.scenarioId && options.scenarioId !== scenarioId) {
        selectScenario(options.scenarioId);
      }
      return;
    }
    backupRealData();
    active = true;
    localStorage.setItem(DEMO_ACTIVE_KEY, '1');
    swapStoreKeys(true);
    const scenario = seedScenario(options.scenarioId || scenarioId);
    entryStore.load();
    applyScenarioToUI(scenario);
    if (state.engine) {
      state.engine.update({ modelType: state.modelType, viewType: state.view });
    }
    updateBadge();
    document.getElementById('welcomeOverlay')?.setAttribute('hidden', '');
    showToast('Demo Mode — fictional sample data. Your real entries are unchanged.', { type: 'info', duration: 5000 });
    trackEvent?.('demo_started', { scenario: scenario.id });
    if (options.startWalkthrough && window.walkthrough) {
      walkthrough.start({ demoOnly: true });
    }
    if (typeof applyWorkflowMode === 'function') applyWorkflowMode('capture');
    else if (typeof refreshUI === 'function') refreshUI();
  }

  function exit() {
    if (!isActive()) return;
    active = false;
    localStorage.setItem(DEMO_ACTIVE_KEY, '0');
    swapStoreKeys(false);
    restoreRealData();
    entryStore.load();
    if (!entryStore.entries.length && !entryStore.draftEntry) {
      entryStore.activeEntryId = null;
    }
    updateBadge();
    showToast('Exited Demo Mode. Your own data is restored.', { type: 'success' });
    if (typeof refreshUI === 'function') refreshUI();
    if (typeof maybeShowWelcome === 'function') maybeShowWelcome();
  }

  function reset() {
    if (!isActive()) return;
    seedScenario(scenarioId);
    entryStore.load();
    applyScenarioToUI(getScenario());
    if (state.engine) state.engine.update({ modelType: state.modelType, viewType: state.view });
    localStorage.removeItem(DEMO_WALKTHROUGH_DONE_KEY);
    showToast('Demo data reset.', { type: 'success' });
    trackEvent?.('demo_reset', { scenario: scenarioId });
    if (typeof refreshUI === 'function') refreshUI();
  }

  function selectScenario(id) {
    if (!id) return;
    scenarioId = id;
    localStorage.setItem(DEMO_SCENARIO_KEY, id);
    if (!isActive()) {
      enter({ scenarioId: id });
      return;
    }
    seedScenario(id);
    entryStore.load();
    applyScenarioToUI(getScenario());
    if (state.engine) state.engine.update({ modelType: state.modelType, viewType: state.view });
    trackEvent?.('scenario_selected', { scenario: id });
    showToast(`Loaded demo scenario: ${getScenario()?.title || id}`, { type: 'info' });
    if (typeof refreshUI === 'function') refreshUI();
  }

  function showEndPanel() {
    const panel = document.getElementById('demoEndPanel');
    if (panel) {
      panel.hidden = false;
      panel.showModal?.();
    }
    trackEvent?.('demo_completed', { scenario: scenarioId });
  }

  function initControls() {
    document.getElementById('btnTryDemo')?.addEventListener('click', () => {
      enter({ startWalkthrough: true });
    });
    document.getElementById('btnHeaderDemo')?.addEventListener('click', () => {
      if (isActive()) exit();
      else enter({ startWalkthrough: false });
    });
    document.getElementById('btnExitDemo')?.addEventListener('click', exit);
    document.getElementById('btnResetDemo')?.addEventListener('click', reset);
    document.getElementById('demoScenarioSelect')?.addEventListener('change', (e) => {
      selectScenario(e.target.value);
    });
    document.getElementById('btnDemoEndBlank')?.addEventListener('click', () => {
      document.getElementById('demoEndPanel')?.close?.();
      exit();
      startNewEntry?.();
      applyWorkflowMode?.('capture');
    });
    document.getElementById('btnDemoEndRestart')?.addEventListener('click', () => {
      document.getElementById('demoEndPanel')?.close?.();
      reset();
      walkthrough?.start({ demoOnly: true });
    });
    document.getElementById('btnDemoEndReport')?.addEventListener('click', async () => {
      document.getElementById('demoEndPanel')?.close?.();
      applyWorkflowMode?.('clinical');
      await printClinicalReport?.();
    });
    document.getElementById('btnDemoEndFeedback')?.addEventListener('click', () => {
      document.getElementById('demoEndPanel')?.close?.();
      openFeedbackForm?.({ type: 'demo' });
    });

    // Restore demo session if flagged
    if (localStorage.getItem(DEMO_ACTIVE_KEY) === '1') {
      active = true;
      swapStoreKeys(true);
      if (!localStorage.getItem(DEMO_STORAGE_KEY)) seedScenario(scenarioId);
    }
    updateBadge();
  }

  window.demoMode = {
    isActive,
    enter,
    exit,
    reset,
    selectScenario,
    getScenario,
    showEndPanel,
    initControls,
    DEMO_STORAGE_KEY,
    REAL_STORAGE_KEY,
    WALKTHROUGH_DONE_KEY,
    DEMO_WALKTHROUGH_DONE_KEY
  };
})();
