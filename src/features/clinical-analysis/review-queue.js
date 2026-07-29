/**
 * Clinical review queue — local clinician review / sign-off workflow.
 */

function clinicalStatusLabel(status) {
  const found = (CLINICAL_STATUSES || []).find(s => s.id === status);
  return found?.label || normalizeClinicalStatus(status);
}

function renderReviewQueue() {
  const list = document.getElementById("reviewQueueList");
  if (!list) return;
  const model = normalizeModelType(state.modelType);
  const entries = entryStore.entries
    .filter(e => normalizeModelType(e.patientModel) === model)
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  if (!entries.length) {
    list.innerHTML = '<p class="entry-list-empty">No saved entries yet. Capture pain, then queue it for clinician review.</p>';
    return;
  }

  list.innerHTML = entries.map((entry, i) => {
    const num = entryStore.getEntryNumber(entry) || (i + 1);
    const status = normalizeClinicalStatus(entry.clinicalStatus);
    const summary = entryStore.getEntrySummary(entry, num, useClinicalLabels());
    const locs = (entry.regions || []).slice(0, 3).map(r => r.patientLabel || r.physicianLabel || "Region").join(", ");
    return `
      <article class="queue-card status-${status}" data-entry-id="${entry.id}">
        <header class="queue-card-head">
          <div>
            <strong>Entry #${num}</strong>
            <span class="queue-status">${clinicalStatusLabel(status)}</span>
          </div>
          <span class="queue-meta">${entry.intensity}/10 · ${entry.regions.length} region${entry.regions.length === 1 ? "" : "s"}</span>
        </header>
        <p class="queue-locs">${locs || "No regions"}</p>
        <p class="queue-note">${entry.note ? entry.note.slice(0, 120) : "No clinical notes"}</p>
        <div class="queue-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-queue-action="open" data-entry-id="${entry.id}">Open</button>
          <button type="button" class="btn btn-ghost btn-sm" data-queue-action="ready" data-entry-id="${entry.id}">Ready</button>
          <button type="button" class="btn btn-ghost btn-sm" data-queue-action="reviewed" data-entry-id="${entry.id}">Reviewed</button>
          <button type="button" class="btn btn-secondary btn-sm" data-queue-action="signoff" data-entry-id="${entry.id}">Sign off</button>
        </div>
      </article>`;
  }).join("");
}

function initReviewQueue() {
  const list = document.getElementById("reviewQueueList");
  if (!list) return;
  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-queue-action]");
    if (!btn) return;
    const id = btn.dataset.entryId;
    const action = btn.dataset.queueAction;
    if (action === "open") {
      entryStore.selectEntry(id);
      refreshUI();
      return;
    }
    if (action === "ready") entryStore.setClinicalStatus(id, "ready_for_review");
    if (action === "reviewed") entryStore.setClinicalStatus(id, "reviewed", { reviewedBy: "Clinician" });
    if (action === "signoff") entryStore.setClinicalStatus(id, "signed_off", { reviewedBy: "Clinician" });
    renderReviewQueue();
    refreshUI();
  });
}

window.renderReviewQueue = renderReviewQueue;
window.initReviewQueue = initReviewQueue;
window.clinicalStatusLabel = clinicalStatusLabel;
