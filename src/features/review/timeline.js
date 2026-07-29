function getChartThemeColors() {
  return {
    line: getThemeToken('--chart-line') || getThemeToken('--accent'),
    fill: getThemeToken('--chart-fill'),
    grid: getThemeToken('--chart-grid'),
    ticks: getThemeToken('--chart-ticks'),
    pointActive: getThemeToken('--chart-point-active'),
    pointBorder: getThemeToken('--chart-point-border')
  };
}

function updateChartTheme() {
  if (!state.chart) return;
  const colors = getChartThemeColors();
  const ds = state.chart.data.datasets[0];
  ds.borderColor = colors.line;
  ds.backgroundColor = colors.fill;
  state.chart.options.scales.y.ticks.color = colors.ticks;
  state.chart.options.scales.y.grid.color = colors.grid;
  state.chart.options.scales.x.ticks.color = colors.ticks;
  state.chart.update('none');
}

function initChart() {
  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;
  const colors = getChartThemeColors();
  state.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Pain Intensity',
        data: [],
        borderColor: colors.line,
        backgroundColor: colors.fill,
        tension: 0.3,
        fill: true,
        pointBackgroundColor: [],
        pointBorderColor: [],
        pointBorderWidth: [],
        pointRadius: [],
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items) {
              const entry = state.chartEntries[items[0]?.dataIndex];
              if (!entry) return '';
              return new Date(entry.createdAt).toLocaleString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
              });
            },
            label(tooltipItem) {
              return `Pain intensity: ${tooltipItem.formattedValue}/10`;
            },
            afterLabel(tooltipItem) {
              const entry = state.chartEntries[tooltipItem.dataIndex];
              if (!entry) return '';
              const regions = (entry.regions || [])
                .map(r => r.patientLabel || r.physicianLabel)
                .filter(Boolean)
                .slice(0, 3)
                .join(', ') || 'No labeled regions';
              const triggers = (entry.triggers || []).join(', ') || 'No triggers recorded';
              const lines = [
                `${entry.regions.length} region${entry.regions.length !== 1 ? 's' : ''}: ${regions}`,
                `Triggers: ${triggers}`
              ];
              if (entry.note && /medication|appointment|procedure|activity/i.test(entry.note)) {
                lines.push(`Note associated with this day: ${String(entry.note).slice(0, 80)}`);
              }
              return lines;
            }
          }
        }
      },
      onClick(_event, elements) {
        if (!elements.length || !state.chartEntries.length) return;
        const entry = state.chartEntries[elements[0].index];
        if (entry) {
          selectEntry(entryStore.isEntrySaved(entry) ? entry.id : DRAFT_KEY);
          if (state.workflowMode === 'capture') applyWorkflowMode?.('review');
        }
      },
      scales: {
        y: {
          min: 0,
          max: 10,
          title: { display: true, text: 'Intensity', color: colors.ticks, font: { size: 10 } },
          ticks: { color: colors.ticks, stepSize: 2 },
          grid: { color: colors.grid }
        },
        x: {
          ticks: { color: colors.ticks, font: { size: 9 }, maxRotation: 45, minRotation: 0 },
          grid: { display: false }
        }
      }
    }
  });

  initTimelineFilters();
}

function initTimelineFilters() {
  const rangeBar = document.getElementById('timelineRangeFilters');
  const regionSel = document.getElementById('timelineRegionFilter');
  rangeBar?.querySelectorAll('[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      rangeBar.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.timelineRange = btn.dataset.range === 'all' ? 'all' : Number(btn.dataset.range);
      updateChart();
      updateTrendSummary();
    });
  });
  regionSel?.addEventListener('change', () => {
    state.timelineRegion = regionSel.value || 'all';
    updateChart();
    updateTrendSummary();
  });
}

function getChartEntries() {
  const model = normalizeModelType(state.modelType);
  let entries = [...entryStore.entries.filter(e => normalizeModelType(e.patientModel) === model)]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const range = state.timelineRange ?? (state.entryFilter === 'week' ? 7 : 'all');
  if (typeof filterEntriesByRange === 'function') {
    entries = filterEntriesByRange(entries, range);
  }
  if (typeof filterEntriesByRegion === 'function') {
    entries = filterEntriesByRegion(entries, state.timelineRegion || 'all');
  }
  // Review filter also applies when set
  if (state.workflowMode === 'review' && state.entryFilter === 'severe') {
    entries = entries.filter(e => e.intensity >= 7);
  } else if (state.workflowMode === 'review' && state.entryFilter === 'week' && range === 'all') {
    entries = filterEntriesByRange(entries, 7);
  }
  return entries;
}

function refreshTimelineRegionOptions(allEntries) {
  const sel = document.getElementById('timelineRegionFilter');
  if (!sel) return;
  const labels = new Set();
  allEntries.forEach(e => (e.regions || []).forEach(r => {
    const label = r.patientLabel || r.physicianLabel;
    if (label) labels.add(label);
  }));
  const current = state.timelineRegion || 'all';
  const opts = ['<option value="all">All regions</option>']
    .concat([...labels].sort().map(l =>
      `<option value="${escapeAttr(l)}"${l === current ? ' selected' : ''}>${escapeHtml(l)}</option>`
    ));
  sel.innerHTML = opts.join('');
}

function updateChart() {
  const model = normalizeModelType(state.modelType);
  const allForModel = entryStore.entries.filter(e => normalizeModelType(e.patientModel) === model);
  refreshTimelineRegionOptions(allForModel);

  const sorted = getChartEntries();
  state.chartEntries = sorted;
  const emptyEl = document.getElementById('chartEmpty');
  if (emptyEl) {
    emptyEl.classList.toggle('hidden', sorted.length > 0);
    if (!sorted.length) {
      if (!allForModel.length) {
        emptyEl.textContent = 'No entries yet. Log pain entries to build your timeline.';
      } else {
        emptyEl.textContent = 'No entries match the current filters. Try All time or clear the region filter.';
      }
    }
  }
  if (!state.chart) return;

  const colors = getChartThemeColors();
  const activeEntry = entryStore.getActiveEntry();
  const activeId = activeEntry && entryStore.isEntrySaved(activeEntry) ? activeEntry.id : null;

  state.chart.data.labels = sorted.map(e =>
    new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  );
  state.chart.data.datasets[0].data = sorted.map(e => e.intensity);
  state.chart.data.datasets[0].pointBackgroundColor = sorted.map(e =>
    e.id === activeId ? colors.pointActive : PAIN_COLORS[e.intensity]
  );
  state.chart.data.datasets[0].pointBorderColor = sorted.map(e =>
    e.id === activeId ? colors.pointBorder : 'transparent'
  );
  state.chart.data.datasets[0].pointBorderWidth = sorted.map(e =>
    e.id === activeId ? 3 : 0
  );
  state.chart.data.datasets[0].pointRadius = sorted.map(e =>
    e.id === activeId ? 8 : 6
  );
  state.chart.update();
  updateTimelineMeta(sorted, activeId);
  updateTimelineA11ySummary(sorted);
}

function updateTimelineA11ySummary(sorted) {
  const el = document.getElementById('timelineA11ySummary');
  if (!el) return;
  if (!sorted.length) {
    el.textContent = 'Recovery timeline is empty.';
    return;
  }
  const stats = typeof getTimelineStats === 'function'
    ? getTimelineStats(sorted, { rangeDays: state.timelineRange || 'all' })
    : null;
  if (stats?.textSummary) {
    el.textContent = stats.textSummary;
  } else {
    const avg = (sorted.reduce((s, e) => s + e.intensity, 0) / sorted.length).toFixed(1);
    el.textContent = `${sorted.length} entries plotted. Average intensity ${avg} out of 10.`;
  }
}

function updateTimelineMeta(sorted, activeId) {
  const meta = document.getElementById('timelineMeta');
  if (!meta) return;
  if (!sorted.length) {
    meta.textContent = 'No entries in this range.';
    return;
  }
  const active = activeId ? sorted.find(e => e.id === activeId) : null;
  if (active) {
    const triggers = (active.triggers || []).slice(0, 2).join(', ') || 'No triggers';
    const time = new Date(active.createdAt).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    meta.textContent = `Selected: intensity ${active.intensity}/10 · ${active.regions.length} region${active.regions.length !== 1 ? 's' : ''} · ${triggers} · ${time}`;
    return;
  }
  const latest = sorted[sorted.length - 1];
  const avg = (sorted.reduce((s, e) => s + e.intensity, 0) / sorted.length).toFixed(1);
  meta.textContent = `${sorted.length} entries · avg ${avg}/10 · latest ${latest.intensity}/10 · click a point to open that entry`;
}

function updateActiveEntrySummary() {
  const box = document.getElementById('activeEntrySummary');
  if (!box) return;
  const entry = entryStore.getActiveEntry();
  if (!entry) {
    box.innerHTML = '<p class="entry-list-empty">No active entry. Mark regions on the anatomy, choose <strong>New Entry</strong>, or select a point on the timeline.</p>';
    return;
  }
  const num = entryStore.getEntryNumber(entry);
  const isDraft = !entryStore.isEntrySaved(entry);
  const summary = entryStore.getEntrySummary(entry, num, useClinicalLabels());
  const time = new Date(entry.createdAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  box.innerHTML = `
    <div class="summary-row">
      <span class="summary-dot" style="background:${PAIN_COLORS[entry.intensity]}" aria-hidden="true"></span>
      <strong>${isDraft ? 'Draft entry' : `Entry #${num}`}${isDraft ? ' (unsaved)' : ''}</strong>
    </div>
    <div>Intensity ${summary.intensity}/10 · ${summary.regionCount} region${summary.regionCount !== 1 ? 's' : ''} · ${escapeHtml(time)}</div>
    <div>${escapeHtml(summary.regions || 'No regions labeled')}</div>
    ${summary.triggers ? `<div>Triggers: ${escapeHtml(summary.triggers)}</div>` : ''}
  `;
}

window.updateChartTheme = updateChartTheme;
window.getChartEntries = getChartEntries;
