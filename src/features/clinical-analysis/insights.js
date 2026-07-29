function generateInsights() {
  const active = entryStore.getActiveEntry();
  const entries = active && entryStore.isEntrySaved(active)
    ? [active]
    : entryStore.entries.filter(e => normalizeModelType(e.patientModel) === normalizeModelType(state.modelType));

  if (!entries.length) {
    return {
      html: '<p>Log a few entries to see simple pattern notes for intensity, location, and triggers.</p>',
      alerts: [],
      brief: 'No pain entries yet.'
    };
  }

  const alerts = [];
  const notes = [];
  const scopeLabel = active && entryStore.isEntrySaved(active)
    ? `Entry #${entryStore.getEntryNumber(active)}`
    : 'Overall trend';

  const avg = entries.reduce((s, e) => s + e.intensity, 0) / entries.length;
  const totalRegions = entries.reduce((s, e) => s + e.regions.length, 0);
  notes.push(`${scopeLabel}: average intensity ${avg.toFixed(1)}/10 across ${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'} (${totalRegions} region${totalRegions !== 1 ? 's' : ''}).`);

  const regionCounts = {};
  entries.forEach(e => e.regions.forEach(r => {
    const label = getRegionDisplay(r);
    regionCounts[label] = (regionCounts[label] || 0) + 1;
  }));
  const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0];
  if (topRegion) notes.push(`Most frequent location: ${topRegion[0]} (${topRegion[1]} mark${topRegion[1] !== 1 ? 's' : ''}).`);

  const triggerCounts = {};
  entries.forEach(e => (e.triggers || []).forEach(t => { triggerCounts[t] = (triggerCounts[t] || 0) + 1; }));
  const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0];
  if (topTrigger) notes.push(`Common trigger: ${topTrigger[0]}.`);

  const peak = Math.max(...entries.map(e => e.intensity));
  if (peak >= 8) {
    alerts.push(`Peak intensity ${peak}/10 was logged. Worth reviewing with a clinician.`);
  }

  const briefParts = [
    `${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}`,
    `avg ${avg.toFixed(1)}/10`,
    `peak ${peak}/10`
  ];
  if (topRegion) briefParts.push(topRegion[0]);
  if (topTrigger) briefParts.push(`trigger: ${topTrigger[0]}`);

  let html = '';
  if (alerts.length) {
    html += alerts.map(a => `<div class="insight-alert"><i data-lucide="info"></i><span>${a}</span></div>`).join('');
  }
  html += '<ul>' + notes.map(n => `<li>${n}</li>`).join('') + '</ul>';
  return { html, alerts, brief: briefParts.join(' · ') };
}

function updateInsights() {
  const box = document.getElementById('insightBox');
  if (box) {
    box.innerHTML = generateInsights().html;
    if (window.lucide) lucide.createIcons();
  }
}
