// ==========================================================================
// ENTRY CRUD
// ==========================================================================
function getFormValues() {
  return {
    intensity: parseInt(document.getElementById('intensitySlider').value, 10),
    quality: getActivePills('qualityPills'),
    triggers: getActivePills('triggerPills'),
    easesAfter: getActivePills('easePills'),
    note: document.getElementById('notesInput').value.trim(),
    duration: document.getElementById('durationSelect').value,
    whenOccurring: document.getElementById('occurrenceSelect').value
  };
}

function populateFormFromEntry(entry) {
  if (!entry) return;
  document.getElementById('intensitySlider').value = entry.intensity;
  updateIntensityUI(entry.intensity, true);
  setActivePills('qualityPills', entry.quality || []);
  setActivePills('triggerPills', entry.triggers || []);
  setActivePills('easePills', entry.easesAfter || []);
  document.getElementById('notesInput').value = entry.note || '';
  document.getElementById('durationSelect').value = entry.duration || '';
  document.getElementById('occurrenceSelect').value = entry.whenOccurring || '';
  document.getElementById('avatarHint')?.classList.add('hidden');
  hideAnatomyTip?.();
  updateEntryButtons();
  updateRegionEditor();
}

function updateRegionEditor() {
  const panel = document.getElementById('regionEditor');
  const sel = entryStore.selectedRegionIds.length === 1 ? entryStore.findRegion(entryStore.selectedRegionIds[0]) : null;
  if (!panel) return;
  if (!sel) {
    panel.classList.remove('visible');
    return;
  }
  panel.classList.add('visible');
  const r = sel.region;
  document.getElementById('regionLabelInput').value = getRegionDisplay(r);
  document.getElementById('regionLayerSelect').value = r.anatomyLayer || 'skin';
  document.getElementById('regionShapeSelect').value =
    r.shape === 'ellipse' ? 'ellipse'
    : r.shape === 'polygon' ? 'polygon'
    : r.shape === 'circle' && (r.radius || 0) < 0.012 ? 'point'
    : 'circle';
  const meta = document.getElementById('regionMetaPanel');
  if (meta && useClinicalLabels()) {
    const anchors = (r.anchors || []).map(a => `(${a.x.toFixed(3)}, ${a.y.toFixed(3)})`).join(' · ');
    meta.innerHTML = `
      <div class="region-meta-row"><span>Region ID</span><code>${escapeHtml(r.regionId || '—')}</code></div>
      <div class="region-meta-row"><span>Structure</span><code>${escapeHtml(r.structureId || r.structureLabel || '—')}</code></div>
      <div class="region-meta-row"><span>Layer</span><code>${escapeHtml(r.anatomyLayer || 'skin')}</code></div>
      <div class="region-meta-row"><span>Shape</span><code>${escapeHtml(r.shape)}</code></div>
      <div class="region-meta-row"><span>View</span><code>${escapeHtml(r.view)}</code></div>
      <div class="region-meta-row"><span>Anchors</span><code>${escapeHtml(anchors || '—')}</code></div>`;
  } else if (meta) {
    meta.innerHTML = '';
  }
}

function syncRegionEditorToStore() {
  const id = entryStore.selectedRegionIds[0];
  if (!id) return;
  const label = document.getElementById('regionLabelInput').value.trim();
  const layer = document.getElementById('regionLayerSelect').value;
  const shape = document.getElementById('regionShapeSelect').value;
  const patch = { anatomyLayer: layer, shape: shape === 'point' ? 'circle' : shape };
  if (useClinicalLabels()) patch.physicianLabel = label;
  else patch.patientLabel = label;
  if (shape === 'point') patch.radius = 0.008 + (entryStore.getActiveEntry()?.intensity ?? 5) * 0.0015;
  entryStore.updateRegion(id, patch);
}

function entryHasSaveableContent(entry) {
  if (!entry) return false;
  if (entry.regions?.length) return true;
  if ((entry.intensity ?? 5) === 0) return true;
  if ((entry.quality || []).length || (entry.triggers || []).length) return true;
  if (String(entry.note || '').trim()) return true;
  return false;
}

function updateEntryButtons() {
  const entry = entryStore.getActiveEntry();
  const hasContent = entryHasSaveableContent(entry);
  const hasRegions = entry && entry.regions.length > 0;
  const isSaved = entry && entryStore.isEntrySaved(entry);
  const btnLog = document.getElementById('btnLog');
  const btnDelete = document.getElementById('btnDeleteEntry');
  const btnRemove = document.getElementById('btnRemoveMarker');
  const saveHint = document.getElementById('saveValidationHint');
  const emptyButIntentional = entry && !hasRegions && (
    entry.intensity === 0 ||
    (entry.quality || []).length ||
    (entry.triggers || []).length ||
    String(entry.note || '').trim()
  );

  if (btnLog) {
    btnLog.disabled = !entry || (!hasRegions && !emptyButIntentional);
    btnLog.textContent = isSaved ? 'Update Pain Entry' : 'Save Pain Entry';
    btnLog.classList.toggle('btn-log-ready', Boolean(hasRegions || emptyButIntentional));
    if (!entry) {
      btnLog.title = 'Start a new entry or mark the anatomy first';
    } else if (!hasRegions && !emptyButIntentional) {
      btnLog.title = 'Mark at least one location, or set intensity to 0 / add symptoms for a symptom-free day';
    } else if (!hasRegions && emptyButIntentional) {
      btnLog.title = 'Save a symptom-free or zero-pain day (confirmation required)';
    } else {
      btnLog.title = isSaved ? 'Update this pain entry' : 'Save this pain entry';
    }
  }
  if (saveHint) {
    if (!entry) {
      saveHint.textContent = 'Select New Entry or mark the anatomy to begin.';
      saveHint.hidden = false;
    } else if (!hasRegions && !emptyButIntentional) {
      saveHint.textContent = 'Mark where it hurts on the body map, then save.';
      saveHint.hidden = false;
    } else if (!hasRegions && emptyButIntentional) {
      saveHint.textContent = 'No body locations marked — you can still save a zero-pain or symptom-only day.';
      saveHint.hidden = false;
    } else {
      saveHint.textContent = '';
      saveHint.hidden = true;
    }
  }
  if (btnDelete) btnDelete.disabled = !entry;
  if (btnRemove) btnRemove.disabled = !entryStore.selectedRegionIds.length;
  updateUndoRedoButtons();
  syncSaveStatusFromStore();
}

/** Unify New entry / Unsaved changes / Saved — never use this channel for feedback. */
function syncSaveStatusFromStore() {
  const entry = entryStore.getActiveEntry();
  const isSaved = Boolean(entry && entryStore.isEntrySaved(entry));
  if (!entry) {
    // After an explicit save, callers set "Saved" then clear the active entry —
    // leave that status alone. Only clear stale unsaved when the store is clean.
    if (!entryStore.dirty && entryStore.draftEntry == null) return;
    if (entryStore.dirty) setSaveStatus?.('unsaved');
    return;
  }
  if (entryStore.dirty) {
    if (!isSaved && !entryStore.hasUnsavedDraft?.()) setSaveStatus?.('new');
    else setSaveStatus?.('unsaved');
    return;
  }
  if (isSaved) setSaveStatus?.('saved');
  else if (entryStore.hasUnsavedDraft?.()) setSaveStatus?.('unsaved');
  else setSaveStatus?.('new');
}

window.syncSaveStatusFromStore = syncSaveStatusFromStore;

function updateUndoRedoButtons() {
  const undo = document.getElementById('btnUndo');
  const redo = document.getElementById('btnRedo');
  if (undo) undo.disabled = !entryStore.canUndo();
  if (redo) redo.disabled = !entryStore.canRedo();
}

function syncFormToActiveEntry() {
  let entry = entryStore.getActiveEntry();
  if (!entry) {
    entry = entryStore.ensureActiveEntry(normalizeModelType(state.modelType));
  }
  entryStore.updateActiveEntry(getFormValues());
  updateEntryButtons();
}

function confirmEmptyDaySave(entry) {
  const banner = document.getElementById('emptySaveConfirm');
  if (!banner) {
    return window.confirm(
      'No body locations are marked. Save this as a symptom-free or zero-pain day?'
    );
  }
  return new Promise((resolve) => {
    banner.hidden = false;
    const yes = document.getElementById('emptySaveYes');
    const no = document.getElementById('emptySaveNo');
    const cleanup = () => {
      banner.hidden = true;
      yes?.removeEventListener('click', onYes);
      no?.removeEventListener('click', onNo);
    };
    const onYes = () => { cleanup(); resolve(true); };
    const onNo = () => { cleanup(); resolve(false); };
    yes?.addEventListener('click', onYes);
    no?.addEventListener('click', onNo);
  });
}

/**
 * Persist the active entry.
 * @param {{ quiet?: boolean }} [options] - quiet: suppress toasts (caller handles UX)
 * @returns {Promise<object|null>} saved entry or null on cancel/validation/failure
 */
async function saveCurrentEntry(options = {}) {
  const quiet = Boolean(options && options.quiet);
  recordAppAction?.('save_entry');
  syncFormToActiveEntry();
  const entry = entryStore.getActiveEntry();
  if (!entry) {
    if (!quiet) showToast?.('Nothing to save yet. Mark the anatomy or start a new entry.', { type: 'warning' });
    return null;
  }

  const hasRegions = entry.regions.length > 0;
  let allowEmpty = false;
  if (!hasRegions) {
    const intentional = entry.intensity === 0
      || (entry.quality || []).length
      || (entry.triggers || []).length
      || String(entry.note || '').trim();
    if (!intentional) {
      if (!quiet) {
        showToast?.('Mark at least one location on the body before saving.', { type: 'warning', assertive: true });
        document.getElementById('saveValidationHint')?.focus?.();
      }
      return null;
    }
    allowEmpty = await confirmEmptyDaySave(entry);
    if (!allowEmpty) {
      if (!quiet) showToast?.('Save cancelled. Mark a location or adjust the entry.', { type: 'info' });
      return null;
    }
  }

  setSaveStatus?.('saving');
  const saved = entryStore.saveActiveEntry({ allowEmpty });
  if (saved) {
    const num = entryStore.getEntryNumber(saved);
    if (!quiet) showToast?.(`Pain entry #${num} saved.`, { type: 'success' });
    setSaveStatus?.('saved');
    trackEvent?.('entry_saved');
    entryStore.clearActiveDraft?.();
    entryStore.activeEntryId = null;
    entryStore.draftEntry = null;
    resetFormFields();
    document.getElementById('avatarHint')?.classList.remove('hidden');
    showAnatomyTip?.();
  } else {
    setSaveStatus?.('failed');
    if (!quiet) showToast?.('Could not save entry.', { type: 'error', assertive: true });
  }
  refreshUI();
  return saved;
}

function startNewEntry() {
  recordAppAction?.('new_entry');
  if (entryStore.hasUnsavedDraft?.() && entryStore.isDraftActive()) {
    const proceed = window.confirm('Discard the current unsaved draft and start a new entry?');
    if (!proceed) return;
  }
  entryStore.newEntry(normalizeModelType(state.modelType));
  populateFormFromEntry(entryStore.getActiveEntry());
  resetFormFields();
  document.getElementById('avatarHint')?.classList.add('hidden');
  hideAnatomyTip?.();
  setSaveStatus?.('new');
  showToast?.('New entry started.', { type: 'info', duration: 2500 });
  refreshUI();
}

function resetFormFields() {
  document.getElementById('notesInput').value = '';
  document.getElementById('durationSelect').value = '';
  document.getElementById('occurrenceSelect').value = '';
  ['qualityPills', 'triggerPills', 'easePills'].forEach(id => {
    document.querySelectorAll(`#${id} .pill`).forEach(b => b.classList.remove('active'));
  });
  document.getElementById('intensitySlider').value = 5;
  updateIntensityUI(5, true);
}

function selectEntry(entryId) {
  entryStore.selectEntry(entryId);
  populateFormFromEntry(entryStore.getActiveEntry());
  refreshUI();
}

function selectRegionOnly(regionId) {
  entryStore.selectRegion(regionId, false);
  populateFormFromEntry(entryStore.getActiveEntry());
  refreshUI();
}

function removeSelectedRegions() {
  if (!entryStore.selectedRegionIds.length) return;
  const count = entryStore.selectedRegionIds.length;
  if (!confirm(`Remove ${count} selected region(s)?`)) return;
  entryStore.deleteSelectedRegions();
  populateFormFromEntry(entryStore.getActiveEntry());
  showToast?.(`Removed ${count} region(s).`, {
    type: 'info',
    actionLabel: 'Undo',
    onAction: () => { entryStore.undo(); refreshUI(); }
  });
  refreshUI();
}

function deleteActiveEntry() {
  const entry = entryStore.getActiveEntry();
  if (!entry) return;
  const num = entryStore.getEntryNumber(entry);
  if (!confirm(`Delete Pain Entry #${num} and all its regions?`)) return;
  const id = entryStore.isDraftActive() ? DRAFT_KEY : entry.id;
  const result = entryStore.deleteEntry(id);
  resetFormFields();
  document.getElementById('avatarHint')?.classList.remove('hidden');
  showToast?.(`Entry #${num} deleted.`, {
    type: 'warning',
    duration: 8000,
    actionLabel: 'Undo',
    onAction: () => {
      result?.restore?.();
      refreshUI();
      showToast?.('Entry restored.', { type: 'success' });
    }
  });
  refreshUI();
}

function clearAllEntries() {
  if (!confirm('Clear all pain entries? You can undo for a few seconds.')) return;
  const result = entryStore.clearAll();
  entryStore.activeEntryId = null;
  entryStore.draftEntry = null;
  resetFormFields();
  document.getElementById('avatarHint')?.classList.remove('hidden');
  showToast?.('All entries cleared.', {
    type: 'warning',
    duration: 8000,
    actionLabel: 'Undo',
    onAction: () => {
      result?.restore?.();
      refreshUI();
      showToast?.('Entries restored.', { type: 'success' });
    }
  });
  maybeShowWelcome?.();
  refreshUI();
}

function performUndo() {
  if (entryStore.undo()) {
    populateFormFromEntry(entryStore.getActiveEntry());
    showToast?.('Undo', { type: 'info', duration: 1800 });
    refreshUI();
  }
}

function performRedo() {
  if (entryStore.redo()) {
    populateFormFromEntry(entryStore.getActiveEntry());
    showToast?.('Redo', { type: 'info', duration: 1800 });
    refreshUI();
  }
}

window.performUndo = performUndo;
window.performRedo = performRedo;
window.saveCurrentEntry = saveCurrentEntry;
window.startNewEntry = startNewEntry;

// ==========================================================================
// CHART & INSIGHTS
