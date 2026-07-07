/**
 * Clinical consultation report — printable PDF via browser print.
 */

function captureAnatomyMapDataUrl(options = {}) {
  const img = document.querySelector('.cae-anatomy-image');
  if (!img?.complete || !img.naturalWidth) return null;

  const model = normalizeModelType(state.modelType);
  const view = options.view || state.view;
  const regions = entryStore.getRegionsForView(model, view);
  const size = options.size || 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const stageBg = getThemeToken('--anatomy-stage-bg') || getThemeToken('--background');
  if (stageBg.startsWith('radial')) {
    ctx.fillStyle = getThemeToken('--background') || '#0f172a';
  } else {
    ctx.fillStyle = stageBg || '#0f172a';
  }
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);

  regions.forEach(r => {
    const intensity = r._entryIntensity ?? 5;
    const baseColor = PAIN_COLORS[intensity] || getThemeToken('--danger') || '#ef4444';
    const c = getRegionCenter(r);
    const opacity = getRegionOpacity(r, intensity);
    const isPolygon = r.shape === 'polygon' && r.anchors.length >= 3;
    const { rx, ry } = getRegionRadii(r, intensity);
    const x = c.x * size;
    const y = c.y * size;
    ctx.save();
    ctx.globalAlpha = opacity;
    if (isPolygon) {
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      r.anchors.forEach((a, i) => {
        const px = a.x * size;
        const py = a.y * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
    } else {
      const rxPx = rx * size;
      const ryPx = ry * size;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rxPx, ryPx));
      grad.addColorStop(0, baseColor);
      grad.addColorStop(0.5, baseColor);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y, rxPx, ryPx, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = getThemeToken('--text-primary') || '#f8fafc';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillText(r._entryLabel || '', x, y);
  });

  return canvas.toDataURL('image/png');
}

function summarizeQualities(entries) {
  const counts = {};
  entries.forEach(e => (e.quality || []).forEach(q => { counts[q] = (counts[q] || 0) + 1; }));
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`);
}

function summarizeTriggers(entries) {
  const counts = {};
  entries.forEach(e => (e.triggers || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`);
}

function buildClinicalReportHtml() {
  const session = buildSessionExport(state, entryStore);
  const entries = [...session.entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const visitDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const mapUrl = captureAnatomyMapDataUrl();
  const insights = generateInsights();
  const avgIntensity = entries.length
    ? (entries.reduce((s, e) => s + e.intensity, 0) / entries.length).toFixed(1)
    : '—';
  const peakIntensity = entries.length ? Math.max(...entries.map(e => e.intensity)) : '—';
  const qualities = summarizeQualities(entries);
  const triggers = summarizeTriggers(entries);

  const regionRows = session.regions.length
    ? session.regions.map(r => `
        <tr>
          <td>${r.label}</td>
          <td>${r.patientLabel || '—'}</td>
          <td>${r.physicianLabel || '—'}</td>
          <td>${r.view}</td>
          <td>${r.shape}</td>
        </tr>`).join('')
    : '<tr><td colspan="5">No pain regions recorded.</td></tr>';

  const entryBlocks = entries.length
    ? entries.map((entry, i) => {
        const num = i + 1;
        const time = new Date(entry.createdAt).toLocaleString();
        const locs = (entry.regions || []).map((r, ri) => {
          const label = regionLabel(num, ri);
          return `<li><strong>${label}</strong> — ${r.patientLabel || 'Unspecified'} (${r.view} view, ${r.shape})</li>`;
        }).join('') || '<li>No regions marked</li>';
        return `
          <section class="report-section">
            <h3>Entry #${num} — ${time}</h3>
            <p><strong>Intensity:</strong> ${entry.intensity}/10 &nbsp;|&nbsp;
            <strong>Duration:</strong> ${entry.duration || '—'} &nbsp;|&nbsp;
            <strong>When:</strong> ${entry.whenOccurring || '—'}</p>
            <p><strong>Quality:</strong> ${(entry.quality || []).join(', ') || '—'}</p>
            <p><strong>Triggers:</strong> ${(entry.triggers || []).join(', ') || '—'}</p>
            <p><strong>Eases after:</strong> ${(entry.easesAfter || []).join(', ') || '—'}</p>
            <p><strong>Clinical notes:</strong> ${entry.note || '—'}</p>
            <p><strong>Regions:</strong></p>
            <ul>${locs}</ul>
          </section>`;
      }).join('')
    : '<p class="report-empty">No pain entries in this session.</p>';

  const timelineRows = session.timeline.length
    ? session.timeline.map(t => `
        <tr>
          <td>#${t.entryNumber}</td>
          <td>${new Date(t.createdAt).toLocaleString()}</td>
          <td>${t.intensity}/10</td>
          <td>${t.regionCount}</td>
        </tr>`).join('')
    : '<tr><td colspan="4">No timeline data.</td></tr>';

  const aiBlock = insights.alerts.length || insights.html
    ? `<div class="report-ai-notice">
        <p><strong>AI Observations (non-diagnostic):</strong></p>
        ${insights.alerts.length ? `<ul>${insights.alerts.map(a => `<li>${a}</li>`).join('')}</ul>` : ''}
        <div class="report-ai-body">${insights.html.replace(/<div class="insight-alert">/g, '<p class="report-alert">').replace(/<\/div>/g, '</p>')}</div>
        <p class="report-disclaimer">These observations are generated from logged symptom patterns only. They do not constitute a medical diagnosis, treatment plan, or clinical decision.</p>
      </div>`
    : '<p class="report-muted">Insufficient data for AI pattern observations.</p>';

  return `
    <article class="clinical-report">
      <header class="report-header">
        <div class="report-brand">
          <span class="report-brand-name">Pain<span class="report-brand-accent">Locator</span></span>
          <span class="report-brand-sub">Powered by Clinical Anatomy Engine</span>
        </div>
        <h1>Clinical Pain Consultation Report</h1>
        <p class="report-meta-line">Visit Date: ${visitDate}</p>
      </header>

      <section class="report-section">
        <h2>Patient &amp; Session</h2>
        <table class="report-table report-table-meta">
          <tr><th>Patient Model</th><td>${formatPatientModelLabel(session.patient.model)}</td></tr>
          <tr><th>Current View</th><td>${session.patient.view}</td></tr>
          <tr><th>Workflow</th><td>${session.workflow.mode}</td></tr>
          <tr><th>Total Entries</th><td>${entries.length}</td></tr>
          <tr><th>Total Regions</th><td>${session.regions.length}</td></tr>
        </table>
      </section>

      <section class="report-section">
        <h2>Annotated Anatomy</h2>
        ${mapUrl
          ? `<figure class="report-figure"><img src="${mapUrl}" alt="Annotated anatomy — ${session.patient.view} view" /><figcaption>${formatPatientModelLabel(session.patient.model)} — ${session.patient.view} view with pain regions</figcaption></figure>`
          : '<p class="report-muted">Anatomy map unavailable at time of export.</p>'}
      </section>

      <section class="report-section">
        <h2>Pain Summary</h2>
        <table class="report-table report-table-meta">
          <tr><th>Average Intensity</th><td>${avgIntensity}/10</td></tr>
          <tr><th>Peak Intensity</th><td>${peakIntensity}/10</td></tr>
          <tr><th>Symptom Qualities</th><td>${qualities.join(', ') || '—'}</td></tr>
          <tr><th>Common Triggers</th><td>${triggers.join(', ') || '—'}</td></tr>
        </table>
      </section>

      <section class="report-section">
        <h2>Pain Regions</h2>
        <table class="report-table">
          <thead><tr><th>ID</th><th>Patient Label</th><th>Clinical Label</th><th>View</th><th>Shape</th></tr></thead>
          <tbody>${regionRows}</tbody>
        </table>
      </section>

      <section class="report-section">
        <h2>Pain Timeline</h2>
        <table class="report-table">
          <thead><tr><th>Entry</th><th>Date/Time</th><th>Intensity</th><th>Regions</th></tr></thead>
          <tbody>${timelineRows}</tbody>
        </table>
      </section>

      <section class="report-section">
        <h2>Clinical Notes</h2>
        <p>${session.notes.aggregate || 'No clinical notes recorded.'}</p>
      </section>

      <section class="report-section">
        <h2>Entry Detail</h2>
        ${entryBlocks}
      </section>

      <section class="report-section">
        <h2>AI Observations</h2>
        ${aiBlock}
      </section>

      <footer class="report-footer">
        <h2>Session Metadata</h2>
        <table class="report-table report-table-meta">
          <tr><th>Generated</th><td>${new Date().toLocaleString()}</td></tr>
          <tr><th>Schema Version</th><td>${session.schemaVersion}</td></tr>
          <tr><th>Application</th><td>PainLocator ${session.applicationVersion}</td></tr>
          <tr><th>Engine</th><td>Clinical Anatomy Engine ${session.engineVersion}</td></tr>
          <tr><th>Session Created</th><td>${new Date(session.created).toLocaleString()}</td></tr>
          <tr><th>Session Modified</th><td>${new Date(session.modified).toLocaleString()}</td></tr>
        </table>
        <p class="report-disclaimer">This document is a patient-reported pain log exported from PainLocator. It is intended to support clinical consultation and does not replace professional medical evaluation.</p>
      </footer>
    </article>`;
}

function printClinicalReport() {
  document.getElementById('printReport').innerHTML = buildClinicalReportHtml();
  window.print();
}

function buildSharePayload() {
  return exportSessionJsonString();
}

function openShareModal() {
  const payload = document.getElementById('sharePayload');
  if (payload) payload.value = buildSharePayload();
  document.getElementById('shareModal')?.showModal();
}

window.captureAnatomyMapDataUrl = captureAnatomyMapDataUrl;
window.buildClinicalReportHtml = buildClinicalReportHtml;
window.printClinicalReport = printClinicalReport;
window.printReport = printClinicalReport;
window.buildSharePayload = buildSharePayload;
window.openShareModal = openShareModal;
