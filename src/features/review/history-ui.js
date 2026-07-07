function filterEntriesForReview(entries) {
  if (state.workflowMode !== 'review' || state.entryFilter === 'all') return entries;
  const now = Date.now();
  if (state.entryFilter === 'week') {
    const week = 7 * 24 * 60 * 60 * 1000;
    return entries.filter(e => now - new Date(e.createdAt).getTime() <= week);
  }
  if (state.entryFilter === 'severe') return entries.filter(e => e.intensity >= 7);
  return entries;
}

function updateEntryList() {
  const list = document.getElementById('entryList');
  if (!list) return;
  const model = normalizeModelType(state.modelType);
  let saved = entryStore.entries.filter(e => normalizeModelType(e.patientModel) === model);
  saved = filterEntriesForReview(saved);
  const draft = state.workflowMode === 'capture' && entryStore.draftEntry
    && normalizeModelType(entryStore.draftEntry.patientModel) === model
    && entryStore.draftEntry.regions.length ? entryStore.draftEntry : null;
  const all = draft ? [...saved, draft] : saved;

  if (!all.length) {
    list.innerHTML = '<p class="entry-list-empty">No pain entries yet. Mark regions on the anatomy to start.</p>';
    return;
  }

  const activeId = entryStore.getActiveEntry()?.id;
  list.innerHTML = all.map((entry, i) => {
    const num = i + 1;
    const summary = entryStore.getEntrySummary(entry, num, useClinicalLabels());
    const isDraft = entry === entryStore.draftEntry && !entryStore.isEntrySaved(entry);
    const isActive = entry.id === activeId;
    const regionsOnView = entry.regions.filter(r => r.view === state.view);
    const regionItems = entry.regions.map((r, ri) => {
      const selected = entryStore.selectedRegionIds.includes(r.id);
      const onView = r.view === state.view;
      return `<button type="button" class="entry-marker-chip${selected ? ' selected' : ''}${onView ? '' : ' other-view'}" data-region-id="${r.id}" data-entry-id="${entry.id}">
        ${useClinicalLabels() ? `${regionLabel(num, ri)} ` : ''}${getRegionDisplay(r)}${useClinicalLabels() ? ` <span class="chip-view">${r.view}</span>` : ''}
      </button>`;
    }).join('');

    return `<div class="entry-card${isActive ? ' active' : ''}${isDraft ? ' draft' : ''}" data-entry-id="${isDraft ? DRAFT_KEY : entry.id}">
      <button type="button" class="entry-card-header">
        <span class="entry-dot" style="background:${PAIN_COLORS[entry.intensity]}"></span>
        <span class="entry-card-title">
          <strong>Entry #${num}${isDraft ? ' (unsaved)' : ''}</strong>
          <span class="entry-card-meta">${summary.regionCount} region${summary.regionCount !== 1 ? 's' : ''} · Intensity ${summary.intensity}${summary.triggers ? ' · ' + summary.triggers : ''}</span>
          <span class="entry-card-regions">${summary.regions}</span>
          <span class="entry-card-time">${summary.time}${regionsOnView.length ? ` · ${regionsOnView.length} on this view` : ''}</span>
        </span>
      </button>
      <div class="entry-marker-chips">${regionItems || '<span class="entry-no-markers">No regions yet</span>'}</div>
    </div>`;
  }).join('');

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

function initRegionTools() {
  document.querySelectorAll('.capture-tools .region-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const interaction = state.engine?.clinicalRenderer?.layers?.interaction;
      if (interaction?.cancelPolygonDraw) interaction.cancelPolygonDraw();
      entryStore.setTool(btn.dataset.tool);
      document.querySelectorAll('.capture-tools .region-tool').forEach(b => b.classList.toggle('active', b === btn));
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

function updateTrendSummary() {
  const box = document.getElementById('trendSummaryBox');
  if (!box || state.workflowMode !== 'review') return;
  const model = normalizeModelType(state.modelType);
  const entries = entryStore.entries.filter(e => normalizeModelType(e.patientModel) === model);
  if (!entries.length) {
    box.innerHTML = '<p>Log entries in Capture to see patterns here.</p>';
    return;
  }
  const sorted = [...entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const avg = entries.reduce((s, e) => s + e.intensity, 0) / entries.length;
  const latest = sorted[sorted.length - 1];
  const earliest = sorted[0];
  const delta = latest.intensity - earliest.intensity;
  const trend = delta > 0.5 ? 'worsening' : delta < -0.5 ? 'improving' : 'stable';
  box.innerHTML = `<ul>
    <li>${entries.length} entries logged · average ${avg.toFixed(1)}/10</li>
    <li>Latest: ${latest.intensity}/10 on ${new Date(latest.createdAt).toLocaleDateString()}</li>
    <li>Overall trend: <strong>${trend}</strong> (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} since first entry)</li>
  </ul>`;
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

// ==========================================================================
