/**
 * Presentation mode — orthogonal to workflow (capture | review | clinical).
 * patient   → mobile-first capture shell
 * clinician → desktop/tablet review console
 * consult   → reserved (reuses clinician chrome density in v1)
 *
 * Lives in app state / shell code — NOT in src/engine/.
 */
(function (global) {
  const STORAGE_KEY = 'painlocator_presentation_mode';

  function normalizeMode(mode) {
    if (mode === 'consult') return 'consult';
    if (mode === 'clinician' || mode === 'clinical') return 'clinician';
    return 'patient';
  }

  function readStored() {
    try {
      return normalizeMode(localStorage.getItem(STORAGE_KEY) || 'patient');
    } catch (_) {
      return 'patient';
    }
  }

  function writeStored(mode) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (_) { /* ignore */ }
  }

  function syncChrome(mode) {
    const next = normalizeMode(mode);

    document.querySelectorAll('[data-presentation-option]').forEach((btn) => {
      const opt = btn.getAttribute('data-presentation-option');
      const active = opt === next || (next === 'consult' && opt === 'clinician');
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const switcherLabel = document.getElementById('presentationSwitcherLabel');
    if (switcherLabel) {
      switcherLabel.textContent =
        next === 'patient' ? 'Patient' : next === 'consult' ? 'Consult' : 'Clinician';
    }

    // Header workflow tab labels differ by shell
    const captureBtn = document.getElementById('btnCaptureWF');
    const reviewBtn = document.getElementById('btnReviewWF');
    const clinicalBtn = document.getElementById('btnClinicalWF');

    if (next === 'patient') {
      if (captureBtn) {
        captureBtn.textContent = 'Locate';
        captureBtn.title = 'Where does it hurt?';
      }
      if (clinicalBtn) {
        clinicalBtn.textContent = 'Describe';
        clinicalBtn.title = 'How does it feel?';
      }
      if (reviewBtn) {
        reviewBtn.textContent = 'Review';
        reviewBtn.title = 'Review & save';
      }
    } else {
      if (captureBtn) {
        captureBtn.textContent = 'Anatomy';
        captureBtn.title = 'Anatomy workspace';
      }
      if (reviewBtn) {
        reviewBtn.textContent = 'History';
        reviewBtn.title = 'Visit history';
      }
      if (clinicalBtn) {
        clinicalBtn.innerHTML =
          '<span class="label-full">Report</span><span class="label-short">Report</span>';
        clinicalBtn.title = 'Clinical report';
      }
    }

    const pointBtn = document.querySelector('.capture-tools .region-tool[data-tool="point"]');
    const circleBtn = document.querySelector('.capture-tools .region-tool[data-tool="circle"]');
    const eraserBtn = document.querySelector('.capture-tools .region-tool[data-tool="eraser"]');
    if (next === 'patient') {
      if (pointBtn) { pointBtn.textContent = 'Tap'; pointBtn.title = 'Tap a pain point'; }
      if (circleBtn) { circleBtn.textContent = 'Area'; circleBtn.title = 'Mark a pain area'; }
      if (eraserBtn) { eraserBtn.textContent = 'Remove'; eraserBtn.title = 'Remove a mark'; }
    } else {
      if (pointBtn) { pointBtn.textContent = 'Point'; pointBtn.title = 'Mark a pain point'; }
      if (circleBtn) { circleBtn.textContent = 'Region'; circleBtn.title = 'Click-drag to mark a pain region'; }
      if (eraserBtn) { eraserBtn.textContent = 'Eraser'; eraserBtn.title = 'Remove region'; }
    }

    if (typeof global.refreshPatientFlow === 'function') global.refreshPatientFlow();
  }

  function applyPresentationMode(mode, options) {
    const opts = options || {};
    const persist = opts.persist !== false;
    const next = normalizeMode(mode);

    if (typeof state !== 'undefined') state.presentationMode = next;
    if (persist) writeStored(next);

    document.body.classList.remove('shell-patient', 'shell-clinician', 'shell-consult');
    if (next === 'patient') document.body.classList.add('shell-patient');
    else if (next === 'consult') document.body.classList.add('shell-consult', 'shell-clinician');
    else document.body.classList.add('shell-clinician');
    document.body.dataset.presentation = next;

    syncChrome(next);

    // Refresh workflow chrome (titles/hints) without changing the workflow enum.
    if (typeof applyWorkflowMode === 'function' && typeof state !== 'undefined') {
      applyWorkflowMode(state.workflowMode || 'capture');
    }

    document.dispatchEvent(
      new CustomEvent('presentationchange', { detail: { presentationMode: next } })
    );
    return next;
  }

  function initPresentationMode() {
    applyPresentationMode(readStored(), { persist: false });

    document.getElementById('btnPresentationMenu')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = document.getElementById('presentationMenu');
      if (menu) {
        const open = menu.hasAttribute('hidden');
        if (open) menu.removeAttribute('hidden'); else menu.setAttribute('hidden', '');
        menu.classList.toggle('open', open);
        document.getElementById('btnPresentationMenu')?.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    });

    document.querySelectorAll('[data-presentation-option]').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyPresentationMode(btn.getAttribute('data-presentation-option'));
        const menu = document.getElementById('presentationMenu');
        if (menu) { menu.setAttribute('hidden', ''); menu.classList.remove('open'); }
        document.getElementById('btnPresentationMenu')?.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      const menu = document.getElementById('presentationMenu');
      const toggle = document.getElementById('btnPresentationMenu');
      if (!menu || !toggle) return;
      if (menu.contains(e.target) || toggle.contains(e.target)) return;
      menu.setAttribute('hidden', '');
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });

    // Clinician shortcuts: 1–4 change view (skip when typing in fields)
    document.addEventListener('keydown', (e) => {
      if (typeof state === 'undefined' || state.presentationMode === 'patient') return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      const map = { Digit1: 'front', Digit2: 'right', Digit3: 'back', Digit4: 'left' };
      const view = map[e.code];
      if (!view) return;
      e.preventDefault();
      if (typeof global.setBodyView === 'function') global.setBodyView(view);
      else if (typeof setBodyView === 'function') setBodyView(view);
    });
  }

  global.PresentationMode = {
    STORAGE_KEY,
    normalizeMode,
    readStored,
    writeStored,
    navLabels: function (m) {
      const mode = normalizeMode(m);
      if (mode === 'patient') {
        return {
          capture: { label: 'Locate', title: 'Where does it hurt?' },
          clinical: { label: 'Describe', title: 'How does it feel?' },
          review: { label: 'Review', title: 'Review & save' }
        };
      }
      return {
        capture: { label: 'Anatomy', title: 'Anatomy workspace' },
        review: { label: 'History', title: 'Visit history' },
        clinical: { label: 'Report', title: 'Clinical report' }
      };
    },
    applyPresentationMode,
    syncChrome,
    initPresentationMode
  };
  global.applyPresentationMode = applyPresentationMode;
  global.initPresentationMode = initPresentationMode;
})(typeof window !== 'undefined' ? window : globalThis);
