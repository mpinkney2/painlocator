// ==========================================================================
window.toggleAccordion = function(id) {
  document.getElementById(id)?.classList.toggle('collapsed');
};

function rebuildReferenceOverlayUI() {
  const container = document.getElementById('referenceOverlayOptions');
  const emptyNote = document.getElementById('vizOverlayEmpty');
  const panel = document.getElementById('vizReferencePanel');
  if (!container || !state.vizController) return;

  const available = state.vizController.getOverlayDefsForUI();
  const current = state.vizController.referenceOverlay;
  container.innerHTML = `<label class="radio-option"><input type="radio" name="ref_overlay" value="none"${current === 'none' ? ' checked' : ''}><span>None</span></label>`
    + available.map(def => `<label class="radio-option"><input type="radio" name="ref_overlay" value="${def.id}"${current === def.id ? ' checked' : ''}><span>${def.label}</span></label>`).join('');

  if (emptyNote) emptyNote.hidden = available.length > 0;
  if (panel) panel.hidden = !useClinicalLabels() || state.vizController.baseMode !== 'reference';

  container.querySelectorAll('input[name="ref_overlay"]').forEach(input => {
    input.addEventListener('change', () => state.vizController.setReferenceOverlay(input.value));
  });
}

function syncVisualizationUI() {
  if (!state.vizController) return;
  const viz = state.vizController.getState();
  document.querySelectorAll('input[name="viz_mode"]').forEach(r => {
    r.checked = r.value === viz.baseMode;
  });
  const refPanel = document.getElementById('vizReferencePanel');
  if (refPanel) refPanel.hidden = !useClinicalLabels() || viz.baseMode !== 'reference';
  rebuildReferenceOverlayUI();
}

function initVisualization() {
  state.vizController = new VisualizationController({
    onChange: ({ type }) => {
      if (type === 'availability' || type === 'baseMode' || type === 'referenceOverlay') {
        syncVisualizationUI();
      }
    }
  });

  document.querySelectorAll('input[name="viz_mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.vizController.setBaseMode(e.target.value);
      const refPanel = document.getElementById('vizReferencePanel');
      if (refPanel) refPanel.hidden = !useClinicalLabels() || e.target.value !== 'reference';
      if (e.target.value === 'reference') rebuildReferenceOverlayUI();
    });
  });

  document.querySelectorAll('#aiOverlayToggles input').forEach(input => {
    input.addEventListener('change', () => {
      state.vizController.setAIOverlay(input.dataset.overlay, input.checked);
    });
  });
}

function applyWorkflowMode(mode) {
  if (!['capture', 'review', 'clinical'].includes(mode)) mode = 'capture';
  state.workflowMode = mode;
  state.physicianMode = mode === 'clinical';
  state.reviewEditMode = false;
  state.compareVisible = false;
  state.entryFilter = 'all';

  document.body.classList.remove('wf-capture', 'wf-review', 'wf-clinical', 'review-editing');
  document.body.classList.add(`wf-${mode}`);

  document.getElementById('btnCaptureWF')?.classList.toggle('active', mode === 'capture');
  document.getElementById('btnReviewWF')?.classList.toggle('active', mode === 'review');
  document.getElementById('btnClinicalWF')?.classList.toggle('active', mode === 'clinical');

  const isPatient = typeof state !== 'undefined' && state.presentationMode === 'patient';
  const titles = isPatient
    ? {
        capture: 'Locate — Mark pain',
        review: 'Review — History & Trends',
        clinical: 'Describe — How it feels'
      }
    : {
        capture: 'Review — Patient marks',
        review: 'Compare — Visits & trends',
        clinical: 'Report — Share findings'
      };
  const titleEl = document.getElementById('clinicalDocTitle');
  if (titleEl) titleEl.textContent = titles[mode];

  const progress = document.getElementById('workflowProgressHint');
  if (progress) {
    const hints = isPatient
      ? {
          capture: 'Step 1 of 3 — Mark pain, set intensity, then save',
          review: 'Step 2 of 3 — Review timeline and compare entries',
          clinical: 'Step 3 of 3 — Describe how it feels'
        }
      : {
          capture: 'Review — Inspect patient-reported marks on anatomy',
          review: 'Compare — Select visits and review change over time',
          clinical: 'Report — Generate and share a clinician summary'
        };
    progress.textContent = hints[mode];
  }

  const hints = isPatient
    ? {
        capture: 'Choose a tool, mark where you feel pain, then describe intensity and symptoms',
        review: 'Select an entry from the timeline or list to review patterns',
        clinical: 'Describe intensity, quality, and notes for this entry'
      }
    : {
        capture: 'Review marks on the body. Use Edit Entry when you need to change regions.',
        review: 'Compare visits from the timeline. Editing stays behind Edit Entry.',
        clinical: 'Build and share the clinical report. Capture tools stay demoted.'
      };
  const hint = document.getElementById('avatarHint');
  // Spatial-primary chrome owns live locate hints; avoid clobbering with workflow copy there.
  const spatialOwnsHint =
    isPatient &&
    mode === 'capture' &&
    document.body.classList.contains('spatial-primary');
  if (hint && !spatialOwnsHint) hint.textContent = hints[mode];

  // Tab accessibility
  ['btnCaptureWF', 'btnReviewWF', 'btnClinicalWF'].forEach((id, i) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const modes = ['capture', 'review', 'clinical'];
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', modes[i] === mode ? 'true' : 'false');
  });

  const editBtn = document.getElementById('btnEditEntry');
  if (editBtn) editBtn.textContent = 'Edit Entry';

  if (mode !== 'clinical') {
    const advancedTools = ['polygon', 'brush', 'lasso'];
    if (advancedTools.includes(entryStore.activeTool)) {
      const spatial = state.engine?.isSpatialMode?.();
      entryStore.setTool(mode === 'review' ? 'select' : spatial ? 'point' : 'circle');
    }
    state.engine?.clinicalRenderer?.layers?.interaction?.cancelPolygonDraw?.();
    if (state.vizController?.baseMode === 'reference') {
      state.vizController.setBaseMode('standard');
    }
  }

  if (mode === 'review') {
    entryStore.setTool('select');
    document.querySelectorAll('.capture-tools .region-tool[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === 'select');
    });
    document.getElementById('entryFilterBar').hidden = true;
    document.getElementById('comparePanel').hidden = true;
  } else if (mode === 'capture') {
    const spatial = state.engine?.isSpatialMode?.();
    const tool = spatial ? 'point' : 'circle';
    entryStore.setTool(tool);
    document.querySelectorAll('.capture-tools .region-tool[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
  }

  if (typeof SpatialPrimaryChrome !== 'undefined') {
    SpatialPrimaryChrome.applySpatialPrimaryChrome(!!state.engine?.isSpatialMode?.());
  } else if (typeof syncEnlargeButton === 'function') {
    syncEnlargeButton(state.engine?.isEnlarged?.());
  }

  const accNotes = document.getElementById('accNotes');
  if (accNotes) accNotes.classList.toggle('collapsed', mode !== 'capture');

  // Clinician Report: keep advanced anatomy / region engineering demoted.
  if (!isPatient) {
    ['accDetail', 'accPainStyle', 'accAIOverlays', 'accVisualization', 'accRegions'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (mode === 'clinical') el.classList.add('collapsed');
    });
    const bodySettings = document.getElementById('bodySettings');
    if (bodySettings && mode === 'clinical' && window.matchMedia('(max-width: 1100px)').matches) {
      bodySettings.open = false;
    }
  }

  setCaptureFormDisabled(mode === 'review');
  if (state.engine) state.engine.update({ physicianMode: state.physicianMode });
  syncVisualizationUI();
  refreshUI();
  if (window.lucide) lucide.createIcons();
}

window.setWorkflowMode = applyWorkflowMode;

window.changeRendererMode = function(mode) {
  if (state.engine) state.engine.update({ rendererMode: mode });
};

// ==========================================================================
// INIT
