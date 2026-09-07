/**
 * Clinical consultation report — printable PDF via browser print.
 */

function loadAnatomyImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load anatomy plate'));
    img.src = src;
  });
}

/**
 * Prefer live Spatial WebGL when Spatial-primary is active so PNG/PDF match
 * clinician/patient anatomy (not legacy 2D plates). Falls back to plate compositor.
 */
async function captureSpatialAnatomyDataUrl(options = {}) {
  const engine = (typeof state !== 'undefined' && state.engine) || null;
  if (!engine?.isSpatialMode?.()) return null;
  const renderer = engine.spatialRenderer;
  if (!renderer?.ready || typeof renderer.captureViewDataUrl !== 'function') return null;

  const view = options.view || state.view || 'front';
  const size = options.size || 512;
  const bgToken = typeof getThemeToken === 'function' ? getThemeToken('--background') : null;
  try {
    return await renderer.captureViewDataUrl(view, {
      width: size,
      height: size,
      background: bgToken || '#0f172a',
      backgroundAlpha: 1,
      restoreView: true
    });
  } catch (err) {
    console.warn('[PainLocator] Spatial anatomy capture failed — falling back to plate', err);
    return null;
  }
}

async function captureAnatomyMapDataUrl(options = {}) {
  const model = normalizeModelType(options.model || state.modelType);
  const view = options.view || state.view;
  const size = options.size || 512;
  const regions = entryStore.getRegionsForView(model, view);

  // Spatial-primary path: export the same 3D body the user sees (Surface / Muscle / Skeletal).
  const spatialUrl = await captureSpatialAnatomyDataUrl({ model, view, size });
  if (spatialUrl) return spatialUrl;

  let img = null;
  if (view === state.view && normalizeModelType(state.modelType) === model) {
    const live = document.querySelector('.cae-anatomy-image');
    if (live?.complete && live.naturalWidth) img = live;
  }
  if (!img) {
    try {
      img = await loadAnatomyImage(getAssetPath(model, view));
    } catch {
      return null;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = getThemeToken('--background') || '#0f172a';
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
    ctx.globalAlpha = Math.min(0.95, opacity + 0.1);
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
      grad.addColorStop(0.45, baseColor);
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

async function buildAnnotatedViewFigures(session) {
  const model = session.patient.model;
  const views = ['front', 'back', 'left', 'right'].filter(view =>
    entryStore.getRegionsForView(model, view).length > 0
  );
  const targetViews = views.length ? views : [session.patient.view || 'front'];
  const figures = [];
  for (const view of targetViews) {
    const mapUrl = await captureAnatomyMapDataUrl({ model, view, size: 480 });
    if (!mapUrl) continue;
    figures.push(`
      <figure class="report-figure">
        <img src="${mapUrl}" alt="Annotated anatomy — ${view} view" />
        <figcaption>${formatPatientModelLabel(model)} — ${view} view</figcaption>
      </figure>`);
  }
  if (!figures.length) {
    return '<p class="report-muted">Anatomy map unavailable at time of export.</p>';
  }
  return `<div class="report-anatomy-grid">${figures.join('')}</div>`;
}

async function buildClinicalReportHtml() {
  const session = buildSessionExport(state, entryStore);
  const entries = [...session.entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const visitDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const generatedAt = new Date().toLocaleString();
  const anatomyFigures = await buildAnnotatedViewFigures(session);
  const insights = generateInsights();
  const trend = typeof generateTrendSummary === 'function'
    ? generateTrendSummary(entries, { rangeDays: 'all' })
    : { observations: [], disclaimer: 'These observations summarize your recorded entries and are not a medical diagnosis.' };

  const intensities = entries.map(e => e.intensity);
  const avgIntensity = intensities.length
    ? (intensities.reduce((s, e) => s + e, 0) / intensities.length).toFixed(1)
    : '—';
  const peakIntensity = intensities.length ? Math.max(...intensities) : '—';
  const lowIntensity = intensities.length ? Math.min(...intensities) : '—';
  const currentIntensity = intensities.length ? intensities[intensities.length - 1] : '—';
  const qualities = summarizeQualities(entries);
  const triggers = summarizeTriggers(entries);
  const eases = (() => {
    const counts = {};
    entries.forEach(e => (e.easesAfter || []).forEach(x => { counts[x] = (counts[x] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`);
  })();

  const dateRange = entries.length
    ? `${new Date(entries[0].createdAt).toLocaleDateString()} – ${new Date(entries[entries.length - 1].createdAt).toLocaleDateString()}`
    : '—';

  const patientLabel = session.patient?.label
    || (typeof formatPatientModelLabel === 'function' ? formatPatientModelLabel(session.patient.model) : session.patient.model)
    || 'Anonymous patient model';
  const identifier = demoMode?.isActive?.()
    ? 'Demo participant (fictional sample — not a real patient)'
    : 'Anonymous / device-local identifier';

  const regionRows = session.regions.length
    ? session.regions.map(r => `
        <tr>
          <td>${escapeHtml(r.label)}</td>
          <td>${escapeHtml(r.patientLabel || '—')}</td>
          <td>${escapeHtml(r.physicianLabel || '—')}</td>
          <td>${escapeHtml(r.view)}</td>
          <td>${escapeHtml(r.shape)}</td>
        </tr>`).join('')
    : '<tr><td colspan="5">No pain regions recorded.</td></tr>';

  const entryBlocks = entries.length
    ? entries.map((entry, i) => {
        const num = i + 1;
        const time = new Date(entry.createdAt).toLocaleString();
        const locs = (entry.regions || []).map((r, ri) => {
          const label = regionLabel(num, ri);
          return `<li><strong>${escapeHtml(label)}</strong> — ${escapeHtml(r.patientLabel || 'Unspecified')} (${escapeHtml(r.view)} view, ${escapeHtml(r.shape)})</li>`;
        }).join('') || '<li>No regions marked</li>';
        return `
          <section class="report-section">
            <h3>Entry #${num} — ${escapeHtml(time)}</h3>
            <p><strong>Intensity:</strong> ${entry.intensity}/10 &nbsp;|&nbsp;
            <strong>Duration:</strong> ${escapeHtml(entry.duration || '—')} &nbsp;|&nbsp;
            <strong>When:</strong> ${escapeHtml(entry.whenOccurring || '—')}</p>
            <p><strong>Quality:</strong> ${escapeHtml((entry.quality || []).join(', ') || '—')}</p>
            <p><strong>Triggers:</strong> ${escapeHtml((entry.triggers || []).join(', ') || '—')}</p>
            <p><strong>Relieving factors:</strong> ${escapeHtml((entry.easesAfter || []).join(', ') || '—')}</p>
            <p><strong>Patient notes:</strong> ${escapeHtml(entry.note || '—')}</p>
            <p><strong>Regions:</strong></p>
            <ul>${locs}</ul>
          </section>`;
      }).join('')
    : '<p class="report-empty">No pain entries in this session.</p>';

  const timelineRows = session.timeline.length
    ? session.timeline.map(t => `
        <tr>
          <td>#${t.entryNumber}</td>
          <td>${escapeHtml(new Date(t.createdAt).toLocaleString())}</td>
          <td>${t.intensity}/10</td>
          <td>${t.regionCount}</td>
        </tr>`).join('')
    : '<tr><td colspan="4">No timeline data.</td></tr>';

  const trendList = (trend.observations || [])
    .map(o => `<li>${escapeHtml(o)}</li>`)
    .join('') || '<li>Insufficient data for trend observations.</li>';

  const activityNotes = entries
    .filter(e => e.note && /medication|appointment|procedure|activity|ice|pt |physical therapy/i.test(e.note))
    .map(e => `<li><strong>${escapeHtml(new Date(e.createdAt).toLocaleDateString())}:</strong> ${escapeHtml(e.note)}</li>`)
    .join('');

  return `
    <article class="clinical-report">
      <header class="report-header">
        <div class="report-brand">
          <span class="report-brand-name">Pain<span class="report-brand-accent">Locator</span></span>
          <span class="report-brand-sub">Powered by Clinical Anatomy Engine</span>
        </div>
        <h1>Patient-Reported Pain Summary</h1>
        <p class="report-meta-line">Prepared for clinician review · ${escapeHtml(visitDate)}</p>
        <p class="report-disclaimer">Patient-reported content only — not a diagnosis, medical record, or physician assessment.</p>
      </header>

      <section class="report-section report-brief">
        <h2>Summary</h2>
        <table class="report-table report-table-meta">
          <tr><th>Patient / identifier</th><td>${escapeHtml(identifier)} · ${escapeHtml(patientLabel)}</td></tr>
          <tr><th>Report date range</th><td>${escapeHtml(dateRange)}</td></tr>
          <tr><th>Current / avg / low / high</th><td>${currentIntensity} / ${avgIntensity} / ${lowIntensity} / ${peakIntensity} (scale 0–10)</td></tr>
          <tr><th>Entries / regions</th><td>${entries.length} / ${session.regions.length}</td></tr>
          <tr><th>Common symptoms</th><td>${escapeHtml(qualities.slice(0, 5).join(', ') || '—')}</td></tr>
          <tr><th>Reported triggers</th><td>${escapeHtml(triggers.slice(0, 5).join(', ') || '—')}</td></tr>
          <tr><th>Relieving factors</th><td>${escapeHtml(eases.slice(0, 5).join(', ') || '—')}</td></tr>
        </table>
        <p>${escapeHtml(insights.brief || 'No entries logged.')}</p>
      </section>

      <section class="report-section">
        <h2>Annotated anatomy</h2>
        ${anatomyFigures}
      </section>

      <section class="report-section">
        <h2>Recovery timeline</h2>
        <table class="report-table">
          <thead><tr><th>Entry</th><th>Date/Time</th><th>Intensity</th><th>Regions</th></tr></thead>
          <tbody>${timelineRows}</tbody>
        </table>
      </section>

      <section class="report-section">
        <h2>Trend observations</h2>
        <p class="assistive-disclaimer">${escapeHtml(trend.disclaimer)}</p>
        <ul>${trendList}</ul>
      </section>

      ${activityNotes ? `<section class="report-section"><h2>Medication / activity / appointment notes</h2><ul>${activityNotes}</ul><p class="report-muted">Items listed were recorded on the same day as the entry; association is not causation.</p></section>` : ''}

      <section class="report-section">
        <h2>Pain regions</h2>
        <table class="report-table">
          <thead><tr><th>ID</th><th>Patient Label</th><th>Clinical Label</th><th>View</th><th>Shape</th></tr></thead>
          <tbody>${regionRows}</tbody>
        </table>
      </section>

      <section class="report-section">
        <h2>Patient notes (aggregate)</h2>
        <p>${escapeHtml(session.notes.aggregate || 'No clinical notes recorded.')}</p>
      </section>

      <section class="report-section">
        <h2>Chronological entries</h2>
        ${entryBlocks}
      </section>

      <footer class="report-footer">
        <h2>Generation details</h2>
        <table class="report-table report-table-meta">
          <tr><th>Generated</th><td>${escapeHtml(generatedAt)}</td></tr>
          <tr><th>Schema Version</th><td>${escapeHtml(session.schemaVersion)}</td></tr>
          <tr><th>Application</th><td>PainLocator ${escapeHtml(session.applicationVersion)}</td></tr>
          <tr><th>Engine</th><td>Clinical Anatomy Engine ${escapeHtml(session.engineVersion)}</td></tr>
        </table>
        <p class="report-disclaimer">This document summarizes patient-entered information from PainLocator. It does not replace professional medical evaluation and is not a medical diagnosis.</p>
      </footer>
    </article>`;
}

async function printClinicalReport() {
  document.getElementById('printReport').innerHTML = await buildClinicalReportHtml();
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
