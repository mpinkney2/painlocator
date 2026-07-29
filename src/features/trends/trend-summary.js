/**
 * Deterministic trend-summary service (UI-independent).
 * Observations only — never diagnoses, predicts, or recommends treatment.
 */
function countFrequency(items) {
  const counts = {};
  items.forEach(item => {
    if (!item) return;
    counts[item] = (counts[item] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function filterEntriesByRange(entries, rangeDays) {
  if (!rangeDays || rangeDays === 'all') return [...entries];
  const days = Number(rangeDays);
  if (!Number.isFinite(days) || days <= 0) return [...entries];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return entries.filter(e => new Date(e.createdAt).getTime() >= cutoff);
}

function filterEntriesByRegion(entries, regionLabel) {
  if (!regionLabel || regionLabel === 'all') return entries;
  const needle = String(regionLabel).toLowerCase();
  return entries.filter(e =>
    (e.regions || []).some(r => {
      const label = (r.patientLabel || r.physicianLabel || '').toLowerCase();
      return label.includes(needle);
    })
  );
}

/**
 * @param {object[]} entries - saved PainEntry objects
 * @param {{ rangeDays?: number|'all', regionLabel?: string }} options
 * @returns {{ observations: string[], insufficient: boolean, stats: object, disclaimer: string }}
 */
function generateTrendSummary(entries, options = {}) {
  const disclaimer =
    'These observations summarize your recorded entries and are not a medical diagnosis.';
  const rangeFiltered = filterEntriesByRange(entries || [], options.rangeDays ?? 'all');
  const scoped = filterEntriesByRegion(rangeFiltered, options.regionLabel);
  const sorted = [...scoped].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const stats = {
    count: sorted.length,
    avg: null,
    min: null,
    max: null,
    latest: null,
    earliest: null,
    delta: null
  };

  if (!sorted.length) {
    return {
      observations: ['Not enough recorded entries yet to summarize a trend. Start by saving a pain entry.'],
      insufficient: true,
      stats,
      disclaimer
    };
  }

  const intensities = sorted.map(e => e.intensity);
  stats.avg = intensities.reduce((s, n) => s + n, 0) / intensities.length;
  stats.min = Math.min(...intensities);
  stats.max = Math.max(...intensities);
  stats.latest = sorted[sorted.length - 1];
  stats.earliest = sorted[0];
  stats.delta = stats.latest.intensity - stats.earliest.intensity;

  const observations = [];

  if (sorted.length === 1) {
    observations.push(
      `One entry recorded at intensity ${stats.latest.intensity}/10. More entries are needed to describe a trend.`
    );
    return { observations, insufficient: true, stats, disclaimer };
  }

  const weekCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = sorted.filter(e => new Date(e.createdAt).getTime() >= weekCutoff);
  if (thisWeek.length) {
    observations.push(
      `${thisWeek.length} entr${thisWeek.length === 1 ? 'y was' : 'ies were'} logged this week.`
    );
  }

  const lastN = sorted.slice(-7);
  if (lastN.length >= 3) {
    const first = lastN[0].intensity;
    const last = lastN[lastN.length - 1].intensity;
    const d = last - first;
    if (Math.abs(d) >= 1) {
      observations.push(
        `Your recorded pain ${d < 0 ? 'decreased' : 'increased'} from ${first} to ${last} over the last ${lastN.length} entries.`
      );
    } else {
      observations.push(
        `Pain intensity has remained relatively stable during the selected period (about ${stats.avg.toFixed(1)}/10).`
      );
    }
  } else if (Math.abs(stats.delta) >= 1) {
    observations.push(
      `Recorded intensity changed from ${stats.earliest.intensity} to ${stats.latest.intensity} across ${sorted.length} entries.`
    );
  } else {
    observations.push(
      `Pain intensity has remained relatively stable during the selected period.`
    );
  }

  const regionLabels = [];
  sorted.forEach(e => (e.regions || []).forEach(r => {
    const label = r.patientLabel || r.physicianLabel;
    if (label) regionLabels.push(label);
  }));
  const topRegions = countFrequency(regionLabels);
  if (topRegions[0] && sorted.length >= 3) {
    const [label, count] = topRegions[0];
    observations.push(
      `“${label}” was selected in ${count} of the last ${sorted.length} entries.`
    );
  }

  const triggers = [];
  sorted.forEach(e => (e.triggers || []).forEach(t => triggers.push(t)));
  const topTriggers = countFrequency(triggers);
  if (topTriggers.length >= 2) {
    observations.push(
      `“${topTriggers[0][0]}” was recorded as a trigger more often than “${topTriggers[1][0]}”.`
    );
  } else if (topTriggers[0] && topTriggers[0][1] >= 2) {
    observations.push(
      `“${topTriggers[0][0]}” was the most frequently recorded trigger (${topTriggers[0][1]} times).`
    );
  }

  const qualities = [];
  sorted.forEach(e => (e.quality || []).forEach(q => qualities.push(q)));
  const topQualities = countFrequency(qualities);
  if (topQualities[0] && topQualities[0][1] >= 2) {
    observations.push(
      `“${topQualities[0][0]}” was reported in ${topQualities[0][1]} entries.`
    );
  }

  return {
    observations: observations.slice(0, 6),
    insufficient: sorted.length < 2,
    stats,
    disclaimer
  };
}

function getTimelineStats(entries, options = {}) {
  const summary = generateTrendSummary(entries, options);
  return {
    ...summary.stats,
    rangeLabel: options.rangeDays === 'all' || !options.rangeDays
      ? 'All time'
      : `Last ${options.rangeDays} days`,
    textSummary: summary.observations.join(' '),
    disclaimer: summary.disclaimer
  };
}

window.generateTrendSummary = generateTrendSummary;
window.getTimelineStats = getTimelineStats;
window.filterEntriesByRange = filterEntriesByRange;
window.filterEntriesByRegion = filterEntriesByRegion;
