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
  document.getElementById('avatarHint').classList.add('hidden');
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
      <div class="region-meta-row"><span>Region ID</span><code>${r.regionId || '—'}</code></div>
      <div class="region-meta-row"><span>Structure</span><code>${r.structureId || r.structureLabel || '—'}</code></div>
      <div class="region-meta-row"><span>Layer</span><code>${r.anatomyLayer || 'skin'}</code></div>
      <div class="region-meta-row"><span>Shape</span><code>${r.shape}</code></div>
      <div class="region-meta-row"><span>View</span><code>${r.view}</code></div>
      <div class="region-meta-row"><span>Anchors</span><code>${anchors || '—'}</code></div>`;
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

function updateEntryButtons() {
  const entry = entryStore.getActiveEntry();
  const hasRegions = entry && entry.regions.length > 0;
  const isSaved = entry && entryStore.isEntrySaved(entry);
  const btnLog = document.getElementById('btnLog');
  const btnDelete = document.getElementById('btnDeleteEntry');
  const btnRemove = document.getElementById('btnRemoveMarker');
  btnLog.disabled = !hasRegions;
  btnLog.textContent = isSaved ? 'Update Pain Entry' : 'Save Pain Entry';
  if (btnDelete) btnDelete.disabled = !entry;
  if (btnRemove) btnRemove.disabled = !entryStore.selectedRegionIds.length;
}

function syncFormToActiveEntry() {
  const entry = entryStore.getActiveEntry();
  if (!entry) return;
  entryStore.updateActiveEntry(getFormValues());
}

function saveCurrentEntry() {
  syncFormToActiveEntry();
  const saved = entryStore.saveActiveEntry();
  if (saved) {
    entryStore.newEntry(normalizeModelType(state.modelType));
    resetFormFields();
    document.getElementById('avatarHint').classList.remove('hidden');
  }
  refreshUI();
  return saved;
}

function startNewEntry() {
  entryStore.newEntry(normalizeModelType(state.modelType));
  populateFormFromEntry(entryStore.getActiveEntry());
  resetFormFields();
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
  if (!confirm(`Remove ${entryStore.selectedRegionIds.length} selected region(s)?`)) return;
  entryStore.deleteSelectedRegions();
  populateFormFromEntry(entryStore.getActiveEntry());
  refreshUI();
}

function deleteActiveEntry() {
  const entry = entryStore.getActiveEntry();
  if (!entry) return;
  const num = entryStore.getEntryNumber(entry);
  if (!confirm(`Delete Pain Entry #${num} and all its regions?`)) return;
  const id = entryStore.isDraftActive() ? DRAFT_KEY : entry.id;
  entryStore.deleteEntry(id);
  resetFormFields();
  document.getElementById('avatarHint').classList.remove('hidden');
  refreshUI();
}

function clearAllEntries() {
  if (!confirm('Clear all pain entries? This is permanent.')) return;
  entryStore.clearAll();
  startNewEntry();
  document.getElementById('avatarHint').classList.remove('hidden');
}

// ==========================================================================
// CHART & INSIGHTS
