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
            afterLabel(tooltipItem) {
              const entry = state.chartEntries[tooltipItem.dataIndex];
              if (!entry) return '';
              const triggers = (entry.triggers || []).join(', ') || 'No triggers';
              return `${entry.regions.length} region${entry.regions.length !== 1 ? 's' : ''} · ${triggers}`;
            }
          }
        }
      },
      onClick(_event, elements) {
        if (!elements.length || !state.chartEntries.length) return;
        const entry = state.chartEntries[elements[0].index];
        if (entry) selectEntry(entryStore.isEntrySaved(entry) ? entry.id : DRAFT_KEY);
      },
      scales: {
        y: { min: 0, max: 10, ticks: { color: colors.ticks, stepSize: 2 }, grid: { color: colors.grid } },
        x: { ticks: { color: colors.ticks, font: { size: 9 } }, grid: { display: false } }
      }
    }
  });
}

function getChartEntries() {
  const model = normalizeModelType(state.modelType);
  return [...entryStore.entries.filter(e => normalizeModelType(e.patientModel) === model)]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function updateChart() {
  const sorted = getChartEntries();
  state.chartEntries = sorted;
  const emptyEl = document.getElementById('chartEmpty');
  if (emptyEl) emptyEl.classList.toggle('hidden', sorted.length > 0);
  if (!state.chart) return;

  const colors = getChartThemeColors();
  const activeEntry = entryStore.getActiveEntry();
  const activeId = activeEntry && entryStore.isEntrySaved(activeEntry) ? activeEntry.id : null;

  state.chart.data.labels = sorted.map(e =>
    new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' })
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
}

function updateTimelineMeta(sorted, activeId) {
  const meta = document.getElementById('timelineMeta');
  if (!meta) return;
  if (!sorted.length) {
    meta.textContent = 'No entries logged yet.';
    return;
  }
  const active = activeId ? sorted.find(e => e.id === activeId) : null;
  if (active) {
    const triggers = (active.triggers || []).slice(0, 2).join(', ') || 'No triggers';
    const time = new Date(active.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    meta.textContent = `Selected: ${active.regions.length} region${active.regions.length !== 1 ? 's' : ''} · ${triggers} · ${time}`;
    return;
  }
  const latest = sorted[sorted.length - 1];
  const avg = (sorted.reduce((s, e) => s + e.intensity, 0) / sorted.length).toFixed(1);
  meta.textContent = `${sorted.length} entries · avg ${avg}/10 · latest ${latest.intensity}/10`;
}

function updateActiveEntrySummary() {
  const box = document.getElementById('activeEntrySummary');
  if (!box) return;
  const entry = entryStore.getActiveEntry();
  if (!entry) {
    box.innerHTML = '<p class="entry-list-empty">No active entry. Mark regions on the anatomy or select from the timeline.</p>';
    return;
  }
  const num = entryStore.getEntryNumber(entry);
  const isDraft = !entryStore.isEntrySaved(entry);
  const summary = entryStore.getEntrySummary(entry, num, useClinicalLabels());
  const time = new Date(entry.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  box.innerHTML = `
    <div class="summary-row">
      <span class="summary-dot" style="background:${PAIN_COLORS[entry.intensity]}"></span>
      <strong>Entry #${num}${isDraft ? ' (unsaved)' : ''}</strong>
    </div>
    <div>Intensity ${summary.intensity}/10 · ${summary.regionCount} region${summary.regionCount !== 1 ? 's' : ''} · ${time}</div>
    <div>${summary.regions || 'No regions labeled'}</div>
    ${summary.triggers ? `<div>Triggers: ${summary.triggers}</div>` : ''}
  `;
}

window.updateChartTheme = updateChartTheme;
