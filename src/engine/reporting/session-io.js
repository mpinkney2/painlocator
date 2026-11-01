/**
 * Session import/export — JSON, PNG snapshot, and file helpers.
 */

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportSessionJson() {
  const session = buildSessionExport(state, entryStore);
  const json = JSON.stringify(session, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `painlocator-session-${stamp}.json`);
  return session;
}

function exportSessionJsonString() {
  return JSON.stringify(buildSessionExport(state, entryStore), null, 2);
}

async function captureClinicalSnapshot() {
  const dataUrl = await captureAnatomyMapDataUrl({ view: state.view });
  if (!dataUrl) {
    showToast?.('Anatomy image is not ready. Wait for the plate to load, then try again.', { type: 'warning' });
    return null;
  }
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `painlocator-snapshot-${stamp}.png`;
  a.click();
  return dataUrl;
}

function importSessionFromObject(session) {
  const validation = validateSessionImport(session);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const model = session.patient?.model || 'adult-male';
  const view = session.patient?.view || 'front';

  entryStore.entries = session.entries.map(e => createPainEntry(e));
  entryStore.draftEntry = null;
  entryStore.activeEntryId = entryStore.entries.length ? entryStore.entries[entryStore.entries.length - 1].id : null;
  entryStore.selectedRegionIds = [];
  entryStore._history = [entryStore._snapshot()];
  entryStore._historyIndex = 0;
  entryStore.save();

  const radioValue = model.replace('adult-', '');
  const modelRadio = document.querySelector(`input[name="patient_model"][value="${radioValue}"]`)
    || document.querySelector(`input[name="patient_model"][value="male"]`);
  if (modelRadio) {
    modelRadio.checked = true;
    state.modelType = modelRadio.value;
  } else {
    state.modelType = model;
  }

  state.view = view;
  document.querySelectorAll('#viewSelector .view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  if (session.workflow?.mode) {
    applyWorkflowMode(session.workflow.mode);
    if (session.workflow.reviewEditMode) {
      state.reviewEditMode = true;
      document.body.classList.add('review-editing');
    }
  }

  if (session.theme === 'dark' || session.theme === 'light') {
    applyTheme(session.theme);
  }

  state.engine?.update({ modelType: state.modelType, viewType: state.view });
  state.vizController?.refreshAvailability(state.modelType, state.view);

  const active = entryStore.getActiveEntry();
  if (active) populateFormFromEntry(active);
  else entryStore.newEntry(normalizeModelType(state.modelType));

  refreshUI();
  return session;
}

function importSessionFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        resolve(importSessionFromObject(data));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not parse session file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

function openImportSessionPicker() {
  const input = document.getElementById('importSessionInput');
  if (!input) return;
  input.value = '';
  input.click();
}

/**
 * Open the shared export modal.
 * @param {{ audience?: 'patient'|'clinician' }} [options]
 * Patient audience uses visit-friendly copy and does not imply auto-send.
 */
function openExportModal(options = {}) {
  const audience = options.audience === 'patient' ? 'patient' : 'clinician';
  const modal = document.getElementById('exportModal');
  if (!modal) return;

  const title = document.getElementById('exportModalTitle');
  const note = document.getElementById('exportModalNote');
  const pdfLabel = document.getElementById('exportPdfLabel');
  const pngLabel = document.getElementById('exportPngLabel');
  const advanced = document.getElementById('exportAdvancedJson');

  modal.dataset.audience = audience;
  document.body.classList.toggle('export-modal-patient', audience === 'patient');

  if (audience === 'patient') {
    if (title) title.textContent = 'Share for your visit';
    if (note) {
      note.textContent =
        'Download a PDF or body-map image to bring or send yourself. Nothing is sent to a clinician automatically — files stay on this device until you share them.';
    }
    if (pdfLabel) pdfLabel.textContent = 'Pain report (PDF)';
    if (pngLabel) pngLabel.textContent = 'Body map image (PNG)';
  } else {
    if (title) title.textContent = 'Share with clinician';
    if (note) {
      note.textContent =
        'Give your clinician a clear pain map and timeline. Nothing leaves this device until you save or share a file.';
    }
    if (pdfLabel) pdfLabel.textContent = 'Clinical report (PDF)';
    if (pngLabel) pngLabel.textContent = 'Anatomy snapshot (PNG)';
  }

  if (advanced) advanced.open = false;
  modal.showModal();
  if (window.lucide) lucide.createIcons();
}

document.getElementById('exportModal')?.addEventListener('close', () => {
  document.body.classList.remove('export-modal-patient');
});

window.exportSessionJson = exportSessionJson;
window.exportSessionJsonString = exportSessionJsonString;
window.captureClinicalSnapshot = captureClinicalSnapshot;
window.importSessionFromObject = importSessionFromObject;
window.importSessionFromFile = importSessionFromFile;
window.openImportSessionPicker = openImportSessionPicker;
window.openExportModal = openExportModal;
window.downloadBlob = downloadBlob;
