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

  const titles = {
    capture: 'Capture — Log Pain',
    review: 'Review — History & Trends',
    clinical: 'Clinical — Report & Share'
  };
  const titleEl = document.getElementById('clinicalDocTitle');
  if (titleEl) titleEl.textContent = titles[mode];

  const progress = document.getElementById('workflowProgressHint');
  if (progress) {
    const hints = {
      capture: 'Step 1 of 3 — Mark pain, set intensity, then save',
      review: 'Step 2 of 3 — Review timeline and compare entries',
      clinical: 'Step 3 of 3 — Generate and share a clinician summary'
    };
    progress.textContent = hints[mode];
  }

  const hints = {
    capture: 'Choose a tool, mark where you feel pain, then describe intensity and symptoms',
    review: 'Select an entry from the timeline or list to review patterns',
    clinical: 'Clinical tools for annotation, pattern notes, and clinician sharing'
  };
  const hint = document.getElementById('avatarHint');
  if (hint) hint.textContent = hints[mode];

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
      entryStore.setTool(mode === 'review' ? 'select' : 'circle');
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
    entryStore.setTool('circle');
    document.querySelectorAll('.capture-tools .region-tool[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === 'circle');
    });
  }

  if (typeof syncEnlargeButton === 'function') {
    syncEnlargeButton(state.engine?.isEnlarged?.());
  }

  const accNotes = document.getElementById('accNotes');
  if (accNotes) accNotes.classList.toggle('collapsed', mode !== 'capture');

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
