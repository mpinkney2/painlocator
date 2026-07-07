function getActivePills(containerId) {
  return [...document.querySelectorAll(`#${containerId} .pill.active`)].map(b => b.dataset.value);
}

function setActivePills(containerId, values = []) {
  document.querySelectorAll(`#${containerId} .pill`).forEach(b => {
    b.classList.toggle('active', values.includes(b.dataset.value));
  });
}

function setupPillToggles(containerId, multi = true) {
  document.querySelectorAll(`#${containerId} .pill`).forEach(btn => {
    btn.addEventListener('click', () => {
      if (multi) btn.classList.toggle('active');
      else {
        document.querySelectorAll(`#${containerId} .pill`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
      syncFormToActiveEntry();
      if (state.engine) state.engine.renderPins();
    });
  });
}

function updateIntensityUI(val, skipSync) {
  const n = parseInt(val, 10);
  const color = PAIN_COLORS[n];
  document.getElementById('intensityNum').textContent = n;
  document.getElementById('intensityNum').style.color = color;
  document.getElementById('intensityLabel').textContent = INTENSITY_LABELS[n];
  const hero = document.getElementById('intensityHero');
  if (hero) {
    hero.style.setProperty('--intensity-accent', color);
    hero.style.borderColor = color + '55';
  }
  if (!skipSync) {
    syncFormToActiveEntry();
    if (state.engine) state.engine.renderPins();
  }
}
