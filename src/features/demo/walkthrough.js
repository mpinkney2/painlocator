/**
 * Guided walkthrough — skippable, restartable, mobile-friendly.
 */
(function initWalkthrough() {
  const STEPS = [
    {
      id: 'mark',
      title: 'Mark pain on the anatomy',
      body: 'Choose a tool, then tap or drag on the body map to mark where it hurts.',
      target: '#avatarStage',
      workflow: 'capture'
    },
    {
      id: 'intensity',
      title: 'Set pain intensity',
      body: 'Use the intensity slider (0–10) to describe how strong the pain feels.',
      target: '#intensityHero',
      workflow: 'capture'
    },
    {
      id: 'symptoms',
      title: 'Add symptoms and notes',
      body: 'Optionally add quality, triggers, and a short note for your clinician.',
      target: '#accSymptoms',
      workflow: 'capture'
    },
    {
      id: 'save',
      title: 'Save an entry',
      body: 'When ready, tap Save Pain Entry. You can edit it later from Review.',
      target: '#btnLog',
      workflow: 'capture'
    },
    {
      id: 'review',
      title: 'Review changes over time',
      body: 'Open Review to see the recovery timeline and compare entries.',
      target: '#btnReviewWF',
      workflow: 'review'
    },
    {
      id: 'report',
      title: 'Open the clinical report',
      body: 'Clinical Analysis includes sharing tools for a clinician-ready summary.',
      target: '#btnClinicalWF',
      workflow: 'clinical'
    },
    {
      id: 'share',
      title: 'Share or print the report',
      body: 'Use Share to print a PDF, export JSON, or save an anatomy snapshot.',
      target: '#btnExport',
      workflow: 'clinical'
    },
    {
      id: 'feedback',
      title: 'Provide feedback',
      body: 'Tell us what worked and what was confusing — it helps improve PainLocator.',
      target: '#btnFeedback',
      workflow: null
    }
  ];

  let index = -1;
  let active = false;
  let overlay = null;
  let card = null;

  function doneKey() {
    return demoMode?.isActive?.()
      ? demoMode.DEMO_WALKTHROUGH_DONE_KEY
      : demoMode?.WALKTHROUGH_DONE_KEY || 'painlocator_walkthrough_done';
  }

  function ensureUI() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'walkthroughOverlay';
    overlay.className = 'walkthrough-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="walkthrough-spotlight" id="walkthroughSpotlight" aria-hidden="true"></div>
      <div class="walkthrough-card" id="walkthroughCard" role="dialog" aria-modal="false" aria-labelledby="walkthroughTitle">
        <p class="walkthrough-step" id="walkthroughStep"></p>
        <h3 id="walkthroughTitle"></h3>
        <p id="walkthroughBody"></p>
        <div class="walkthrough-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="walkthroughSkip">Skip</button>
          <button type="button" class="btn btn-ghost btn-sm" id="walkthroughBack">Back</button>
          <button type="button" class="btn btn-primary btn-sm" id="walkthroughNext">Next</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    card = document.getElementById('walkthroughCard');
    document.getElementById('walkthroughSkip').addEventListener('click', skip);
    document.getElementById('walkthroughBack').addEventListener('click', back);
    document.getElementById('walkthroughNext').addEventListener('click', next);
  }

  function positionSpotlight(selector) {
    const spot = document.getElementById('walkthroughSpotlight');
    const el = selector ? document.querySelector(selector) : null;
    if (!spot) return;
    if (!el || el.offsetParent === null) {
      spot.style.display = 'none';
      return;
    }
    const r = el.getBoundingClientRect();
    spot.style.display = 'block';
    spot.style.top = `${Math.max(8, r.top - 8)}px`;
    spot.style.left = `${Math.max(8, r.left - 8)}px`;
    spot.style.width = `${r.width + 16}px`;
    spot.style.height = `${r.height + 16}px`;
  }

  function render() {
    ensureUI();
    const step = STEPS[index];
    if (!step) {
      finish(true);
      return;
    }
    if (step.workflow && typeof applyWorkflowMode === 'function') {
      applyWorkflowMode(step.workflow);
    }
    overlay.hidden = false;
    document.getElementById('walkthroughStep').textContent = `Step ${index + 1} of ${STEPS.length}`;
    document.getElementById('walkthroughTitle').textContent = step.title;
    document.getElementById('walkthroughBody').textContent = step.body;
    document.getElementById('walkthroughBack').disabled = index === 0;
    document.getElementById('walkthroughNext').textContent =
      index === STEPS.length - 1 ? 'Finish' : 'Next';
    requestAnimationFrame(() => positionSpotlight(step.target));
  }

  function start(options = {}) {
    ensureUI();
    active = true;
    index = 0;
    trackEvent?.('walkthrough_started');
    render();
  }

  function next() {
    if (index >= STEPS.length - 1) {
      finish(true);
      return;
    }
    index += 1;
    render();
  }

  function back() {
    if (index <= 0) return;
    index -= 1;
    render();
  }

  function skip() {
    trackEvent?.('walkthrough_skipped');
    finish(false);
  }

  function finish(completed) {
    active = false;
    index = -1;
    if (overlay) overlay.hidden = true;
    try {
      localStorage.setItem(doneKey(), '1');
    } catch { /* ignore */ }
    if (completed) {
      trackEvent?.('walkthrough_completed');
      if (demoMode?.isActive?.()) demoMode.showEndPanel();
      else showToast?.('Walkthrough complete. You can restart it from Help anytime.', { type: 'success' });
    }
  }

  function restart() {
    try { localStorage.removeItem(doneKey()); } catch { /* ignore */ }
    start();
  }

  function isComplete() {
    try { return localStorage.getItem(doneKey()) === '1'; } catch { return false; }
  }

  window.addEventListener('resize', () => {
    if (active && STEPS[index]) positionSpotlight(STEPS[index].target);
  });

  window.walkthrough = { start, skip, restart, isComplete, STEPS };
})();
