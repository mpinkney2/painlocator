function filterEntriesForReview(entries, filterOverride) {
  const filter = filterOverride != null
    ? filterOverride
    : (state.workflowMode === 'review' ? state.entryFilter : 'all');
  if (filter === 'all') return entries;
  const now = Date.now();
  if (filter === 'week') {
    const week = 7 * 24 * 60 * 60 * 1000;
    return entries.filter(e => now - new Date(e.createdAt).getTime() <= week);
  }
  if (filter === 'severe') return entries.filter(e => e.intensity >= 7);
  return entries;
}

function formatEntryDate(entry) {
  try {
    return new Date(entry.createdAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function formatEntrySymptoms(entry) {
  const parts = [];
  if (entry.quality?.length) parts.push(entry.quality.slice(0, 3).join(', '));
  const note = String(entry.note || '').trim();
  if (note) parts.push(note.length > 80 ? `${note.slice(0, 77)}…` : note);
  return parts.join(' · ') || 'No symptoms or note';
}

function bindClinicianEntryList(list) {
  list.querySelectorAll('.entry-card-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.entry-card');
      selectEntry(card.dataset.entryId);
    });
  });
  list.querySelectorAll('.entry-marker-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectRegionOnly(btn.dataset.regionId);
    });
  });
}

function openPatientHistoryEntry(entryId, intent) {
  selectEntry(entryId);
  if (typeof setPatientStep === 'function') {
    setPatientStep(intent === 'edit' ? 'describe' : 'review', { force: true });
  } else if (typeof window.setPatientStep === 'function') {
    window.setPatientStep(intent === 'edit' ? 'describe' : 'review', { force: true });
  }
  refreshUI();
}

function bindPatientEntryList(list) {
  list.querySelectorAll('[data-patient-entry-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const card = btn.closest('.entry-card');
      if (!card) return;
      openPatientHistoryEntry(card.dataset.entryId, btn.dataset.patientEntryAction);
    });
  });
  list.querySelectorAll('.entry-card-header[data-patient-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.entry-card');
      if (!card) return;
      openPatientHistoryEntry(card.dataset.entryId, 'open');
    });
  });
}

function renderClinicianEntryCards(all) {
  const activeId = entryStore.getActiveEntry()?.id;
  return all.map((entry, i) => {
    const num = entryStore.getEntryNumber(entry) || (i + 1);
    const summary = entryStore.getEntrySummary(entry, num, useClinicalLabels());
    const isDraft = entry === entryStore.draftEntry && !entryStore.isEntrySaved(entry);
    const isActive = entry.id === activeId;
    const regionsOnView = entry.regions.filter(r => r.view === state.view);
    const regionItems = entry.regions.map((r, ri) => {
      const selected = entryStore.selectedRegionIds.includes(r.id);
      const onView = r.view === state.view;
      return `<button type="button" class="entry-marker-chip${selected ? ' selected' : ''}${onView ? '' : ' other-view'}" data-region-id="${escapeAttr(r.id)}" data-entry-id="${escapeAttr(entry.id)}">
        ${useClinicalLabels() ? `${escapeHtml(regionLabel(num, ri))} ` : ''}${escapeHtml(getRegionDisplay(r))}${useClinicalLabels() ? ` <span class="chip-view">${escapeHtml(r.view)}</span>` : ''}
      </button>`;
    }).join('');

    return `<div class="entry-card${isActive ? ' active' : ''}${isDraft ? ' draft' : ''}" data-entry-id="${isDraft ? DRAFT_KEY : escapeAttr(entry.id)}">
      <button type="button" class="entry-card-header">
        <span class="entry-dot" style="background:${PAIN_COLORS[entry.intensity]}" aria-hidden="true"></span>
        <span class="entry-card-title">
          <strong>${isDraft ? 'Draft' : `Entry #${num}`}${isDraft ? ' (unsaved)' : ''}</strong>
          <span class="entry-card-meta">${summary.regionCount} region${summary.regionCount !== 1 ? 's' : ''} · Intensity ${summary.intensity}${summary.triggers ? ' · ' + escapeHtml(summary.triggers) : ''}</span>
          <span class="entry-card-regions">${escapeHtml(summary.regions)}</span>
          <span class="entry-card-time">${escapeHtml(summary.time)}${regionsOnView.length ? ` · ${regionsOnView.length} on this view` : ''}</span>
        </span>
      </button>
      <div class="entry-marker-chips">${regionItems || '<span class="entry-no-markers">No regions yet</span>'}</div>
    </div>`;
  }).join('');
}

function renderPatientEntryCards(entries) {
  const activeId = entryStore.getActiveEntry()?.id;
  return entries.map((entry, i) => {
    const num = entryStore.getEntryNumber(entry) || (i + 1);
    const summary = entryStore.getEntrySummary(entry, num, false);
    const isDraft = entry === entryStore.draftEntry && !entryStore.isEntrySaved(entry);
    const isActive = entry.id === activeId;
    const dateLabel = formatEntryDate(entry);
    const symptoms = formatEntrySymptoms(entry);
    const entryKey = isDraft ? DRAFT_KEY : entry.id;

    return `<article class="entry-card patient-entry-card${isActive ? ' active' : ''}${isDraft ? ' draft' : ''}" data-entry-id="${escapeAttr(entryKey)}">
      <button type="button" class="entry-card-header" data-patient-open aria-label="Open entry ${num}">
        <span class="entry-dot" style="background:${PAIN_COLORS[entry.intensity]}" aria-hidden="true"></span>
        <span class="entry-card-title">
          <strong>${isDraft ? 'Draft (unsaved)' : `Entry #${num}`}</strong>
          <span class="entry-card-time">${escapeHtml(dateLabel)}</span>
          <span class="entry-card-regions">${escapeHtml(summary.regions)}</span>
          <span class="entry-card-meta">Intensity ${summary.intensity}/10</span>
          <span class="entry-card-symptoms">${escapeHtml(symptoms)}</span>
        </span>
      </button>
      <div class="patient-entry-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-patient-entry-action="open">Open</button>
        <button type="button" class="btn btn-secondary btn-sm" data-patient-entry-action="edit">Edit</button>
      </div>
    </article>`;
  }).join('');
}

function updateEntryList() {
  const list = document.getElementById('entryList');
  const patientList = document.getElementById('patientEntryList');
  const model = normalizeModelType(state.modelType);
  let saved = entryStore.entries.filter(e => normalizeModelType(e.patientModel) === model);
  const clinicianSaved = filterEntriesForReview(saved);
  const draft = state.workflowMode === 'capture' && entryStore.draftEntry
    && normalizeModelType(entryStore.draftEntry.patientModel) === model
    && entryStore.draftEntry.regions.length ? entryStore.draftEntry : null;
  const clinicianAll = draft ? [...clinicianSaved, draft] : clinicianSaved;

  if (list) {
    if (!clinicianAll.length) {
      list.innerHTML = state.workflowMode === 'review'
        ? '<p class="entry-list-empty">No entries match this view. Switch to Capture to log a pain entry, or clear filters.</p>'
        : '<p class="entry-list-empty">No pain entries yet. Mark regions on the anatomy or choose <strong>New Entry</strong> to start.</p>';
    } else {
      list.innerHTML = renderClinicianEntryCards(clinicianAll);
      bindClinicianEntryList(list);
    }
  }

  if (patientList) {
    const patientFilter = state.patientEntryFilter || 'all';
    const patientEntries = filterEntriesForReview(saved, patientFilter)
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (!patientEntries.length) {
      patientList.innerHTML = saved.length
        ? '<p class="entry-list-empty">No entries match this filter.</p>'
        : '<p class="entry-list-empty">No saved entries yet. Save this entry to start your history.</p>';
    } else {
      patientList.innerHTML = renderPatientEntryCards(patientEntries);
      bindPatientEntryList(patientList);
    }
  }
}

function initRegionTools() {
  document.querySelectorAll('.capture-tools .region-tool[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const interaction = state.engine?.clinicalRenderer?.layers?.interaction;
      if (interaction?.cancelPolygonDraw) interaction.cancelPolygonDraw();
      entryStore.setTool(btn.dataset.tool);
      document.querySelectorAll('.capture-tools .region-tool[data-tool]').forEach(b => b.classList.toggle('active', b === btn));
      const layer = document.querySelector('.cae-region-layer');
      const tool = btn.dataset.tool;
      if (layer) {
        layer.style.cursor = tool === 'select' ? 'default'
          : tool === 'eraser' ? 'not-allowed'
          : tool === 'polygon' ? 'crosshair'
          : 'crosshair';
      }
    });
  });
}

function syncEnlargeButton(enlarged) {
  const btn = document.getElementById('btnEnlargeAnatomy');
  if (!btn) return;
  const on = !!enlarged;
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.textContent = on ? 'Fit' : 'Enlarge';
  btn.title = on
    ? 'Return silhouette to full view'
    : 'Enlarge silhouette for precise marking';
  const hint = document.getElementById('avatarHint');
  if (hint && on) {
    hint.textContent = 'Silhouette enlarged — mark precisely, or drag empty space to pan';
    hint.classList.remove('hidden');
  } else if (hint && !hint.classList.contains('hidden') && hint.textContent.includes('enlarged')) {
    hint.textContent = 'Choose a tool, mark where you feel pain, then describe intensity and symptoms';
  }
}

function initAnatomyZoom() {
  const btn = document.getElementById('btnEnlargeAnatomy');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (state.engine?.isSpatialMode?.()) return;
    const enlarged = state.engine?.toggleEnlarge?.();
    syncEnlargeButton(enlarged);
  });
  state.engine?.onZoomChange?.(({ enlarged }) => syncEnlargeButton(enlarged));
  syncEnlargeButton(state.engine?.isEnlarged?.());
}

function syncDisplayModeButtons(mode) {
  const plate = document.getElementById('btnPlateMode');
  const spatial = document.getElementById('btnSpatialMode');
  const isSpatial = mode === 'spatial';
  plate?.classList.toggle('active', !isSpatial);
  spatial?.classList.toggle('active', isSpatial);
  plate?.setAttribute('aria-pressed', (!isSpatial).toString());
  spatial?.setAttribute('aria-pressed', isSpatial.toString());
  if (typeof SpatialPrimaryChrome !== 'undefined') {
    SpatialPrimaryChrome.applySpatialPrimaryChrome(isSpatial, isSpatial
      ? { keepSpatialPrimary: true }
      : { forcePlate: true, keepSpatialPrimary: false });
  } else {
    const enlarge = document.getElementById('btnEnlargeAnatomy');
    if (enlarge) {
      enlarge.disabled = isSpatial;
      enlarge.hidden = isSpatial;
    }
    document.getElementById('avatarWrap')?.classList.toggle('display-spatial', isSpatial);
    document.getElementById('avatarStage')?.classList.toggle('cae-spatial-host', isSpatial);
  }
  if (!isSpatial) syncEnlargeButton?.(state.engine?.isEnlarged?.());
}
if (typeof window !== 'undefined') window.syncDisplayModeButtons = syncDisplayModeButtons;

function initDisplayModeToggle() {
  const plate = document.getElementById('btnPlateMode');
  const spatial = document.getElementById('btnSpatialMode');
  if (!plate || !spatial) return;

  plate.addEventListener('click', () => {
    state.engine?.setDisplayMode?.('plate');
  });
  spatial.addEventListener('click', async () => {
    if (state.engine?.isSpatialMode?.()) return;
    spatial.disabled = true;
    spatial.textContent = 'Loading…';
    try {
      const ok = await state.engine?.setDisplayMode?.('spatial');
      syncDisplayModeButtons(ok ? 'spatial' : 'plate');
      if (!ok) {
        showToast?.('3D body unavailable — showing 2D diagram.', { type: 'warning' });
      }
    } finally {
      spatial.disabled = false;
      spatial.textContent = '3D';
    }
  });

  state.engine?.on?.('displaymodechanged', ({ displayMode }) => {
    if (displayMode === 'spatial') {
      syncDisplayModeButtons('spatial');
    } else if (displayMode === 'plate') {
      syncDisplayModeButtons('plate');
    } else if (displayMode === 'spatial-unavailable') {
      // Failed Spatial request — return to usable 2D immediately.
      state.engine?.enablePlateMode?.(displayMode);
      syncDisplayModeButtons('plate');
      showToast?.('3D body unavailable — showing 2D diagram.', { type: 'warning' });
    } else if (typeof SpatialPrimaryChrome !== 'undefined') {
      SpatialPrimaryChrome.applySpatialPrimaryChrome(false, { forcePlate: true, keepSpatialPrimary: false });
      syncDisplayModeButtons('plate');
    }
    refreshUI?.();
  });
  // Product default is 2D plate — never fall through to Spatial on boot.
  const bootMode = state.engine?.isSpatialMode?.()
    ? 'spatial'
    : (state.engine?.displayMode === 'spatial' ? 'spatial' : 'plate');
  syncDisplayModeButtons(bootMode);
}

function updateTrendSummary() {
  const box = document.getElementById('trendSummaryBox');
  if (!box) return;
  if (state.workflowMode !== 'review' && state.workflowMode !== 'clinical') return;
  const model = normalizeModelType(state.modelType);
  let entries = entryStore.entries.filter(e => normalizeModelType(e.patientModel) === model);
  entries = typeof filterEntriesByRange === 'function'
    ? filterEntriesByRange(entries, state.timelineRange ?? 'all')
    : entries;
  entries = typeof filterEntriesByRegion === 'function'
    ? filterEntriesByRegion(entries, state.timelineRegion || 'all')
    : entries;

  if (typeof generateTrendSummary !== 'function') {
    box.innerHTML = '<p>Log entries in Capture to see patterns here.</p>';
    return;
  }

  const result = generateTrendSummary(entries, {
    rangeDays: state.timelineRange ?? 'all',
    regionLabel: state.timelineRegion || 'all'
  });

  const list = result.observations.map(o => `<li>${escapeHtml(o)}</li>`).join('');
  box.innerHTML = `
    <p class="assistive-disclaimer">${escapeHtml(result.disclaimer)}</p>
    <ul>${list}</ul>
    ${result.stats.count >= 2 ? `<p class="trend-stats">Range: ${result.stats.min}–${result.stats.max}/10 · average ${result.stats.avg.toFixed(1)}</p>` : ''}
  `;
}

function updateComparePanel() {
  const panel = document.getElementById('comparePanel');
  const result = document.getElementById('compareResult');
  const selA = document.getElementById('compareEntryA');
  const selB = document.getElementById('compareEntryB');
  if (!panel || !result || !selA || !selB) return;

  panel.hidden = !state.compareVisible || state.workflowMode !== 'review';

  const model = normalizeModelType(state.modelType);
  const entries = [...entryStore.entries.filter(e => normalizeModelType(e.patientModel) === model)]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const opts = entries.map((e, i) => {
    const t = new Date(e.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<option value="${e.id}">Entry #${i + 1} · ${e.intensity}/10 · ${t}</option>`;
  }).join('');

  if (entries.length < 2) {
    selA.innerHTML = selB.innerHTML = '';
    result.innerHTML = '<p>Need at least two saved entries to compare.</p>';
    return;
  }

  if (!selA.options.length || selA.dataset.count !== String(entries.length)) {
    selA.innerHTML = opts;
    selB.innerHTML = opts;
    selA.dataset.count = String(entries.length);
    if (entries.length > 1) {
      selA.value = entries[0].id;
      selB.value = entries[entries.length - 1].id;
    }
  }

  const a = entries.find(e => e.id === selA.value);
  const b = entries.find(e => e.id === selB.value);
  if (!a || !b) return;

  const labelsA = a.regions.map(r => getRegionDisplay(r)).join(', ') || '—';
  const labelsB = b.regions.map(r => getRegionDisplay(r)).join(', ') || '—';
  result.innerHTML = `
    <div><strong>Entry A:</strong> Intensity ${a.intensity}/10 · ${a.regions.length} region(s) · ${labelsA}</div>
    <div style="margin-top:4px"><strong>Entry B:</strong> Intensity ${b.intensity}/10 · ${b.regions.length} region(s) · ${labelsB}</div>
    <div style="margin-top:6px">Δ Intensity: <strong>${b.intensity - a.intensity >= 0 ? '+' : ''}${b.intensity - a.intensity}</strong></div>`;
}

function setCaptureFormDisabled(disabled) {
  const ids = ['intensitySlider', 'notesInput', 'durationSelect', 'occurrenceSelect'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
  document.querySelectorAll('#qualityPills .pill, #triggerPills .pill, #easePills .pill').forEach(p => {
    p.disabled = disabled;
    p.style.pointerEvents = disabled ? 'none' : '';
    p.style.opacity = disabled ? '0.55' : '';
  });
  document.getElementById('btnLog')?.toggleAttribute('disabled', disabled || !entryStore.getActiveEntry()?.regions?.length);
}

function initReviewTools() {
  document.querySelectorAll('[data-review-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.reviewTool;
      document.querySelectorAll('[data-review-tool]').forEach(b => b.classList.toggle('active', b === btn));
      if (tool === 'select') {
        entryStore.setTool('select');
        state.compareVisible = false;
        document.getElementById('entryFilterBar').hidden = true;
      } else if (tool === 'filter') {
        const bar = document.getElementById('entryFilterBar');
        bar.hidden = !bar.hidden;
        state.compareVisible = false;
      } else if (tool === 'compare') {
        state.compareVisible = !state.compareVisible;
        document.getElementById('entryFilterBar').hidden = true;
        updateComparePanel();
      }
      refreshUI();
    });
  });

  document.getElementById('btnEditEntry')?.addEventListener('click', () => {
    state.reviewEditMode = !state.reviewEditMode;
    document.body.classList.toggle('review-editing', state.reviewEditMode);
    const btn = document.getElementById('btnEditEntry');
    if (btn) btn.textContent = state.reviewEditMode ? 'Done Editing' : 'Edit Entry';
    if (state.reviewEditMode) entryStore.setTool('circle');
    else entryStore.setTool('select');
    setCaptureFormDisabled(!state.reviewEditMode);
    refreshUI();
  });

  document.querySelectorAll('#entryFilters .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#entryFilters .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.entryFilter = pill.dataset.filter;
      refreshUI();
    });
  });

  document.querySelectorAll('#patientHistoryFilters .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#patientHistoryFilters .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.patientEntryFilter = pill.dataset.filter || 'all';
      updateEntryList();
    });
  });

  ['compareEntryA', 'compareEntryB'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updateComparePanel);
  });
}

function refreshUI() {
  updateChart();
  updateInsights();
  updateTrendSummary();
  updateComparePanel();
  updateActiveEntrySummary();
  updateEntryList();
  updateRegionEditor();
  setCaptureFormDisabled(state.workflowMode === 'review' && !state.reviewEditMode);
  if (state.engine) state.engine.renderPins();
}

window.updateEntryList = updateEntryList;
window.openPatientHistoryEntry = openPatientHistoryEntry;

// ==========================================================================
