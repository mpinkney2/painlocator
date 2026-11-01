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
    const workflowTabs = document.querySelector('.workflow-toggle .toggle-buttons');

    if (next === 'patient') {
      if (workflowTabs) workflowTabs.setAttribute('aria-label', 'Workflow: Locate, Describe, Review');
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
      // Clinician console: Review / Compare / Report
      if (workflowTabs) workflowTabs.setAttribute('aria-label', 'Workflow: Review, Compare, Report');
      if (captureBtn) {
        captureBtn.textContent = 'Review';
        captureBtn.title = 'Review patient marks on anatomy';
      }
      if (reviewBtn) {
        reviewBtn.textContent = 'Compare';
        reviewBtn.title = 'Compare visits';
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
    const helpToolName = document.getElementById('helpMarkingToolName');
    const helpMarkingCopy = document.getElementById('helpMarkingCopy');
    if (next === 'patient') {
      if (pointBtn) {
        pointBtn.textContent = 'Tap';
        pointBtn.title = 'Tap a pain point';
        pointBtn.setAttribute('aria-label', 'Tap tool');
      }
      if (circleBtn) {
        circleBtn.textContent = 'Area';
        circleBtn.title = 'Mark a pain area';
        circleBtn.setAttribute('aria-label', 'Area tool');
      }
      if (eraserBtn) {
        eraserBtn.textContent = 'Remove';
        eraserBtn.title = 'Remove a mark';
        eraserBtn.setAttribute('aria-label', 'Remove mark');
      }
      if (helpToolName) helpToolName.textContent = 'Tap';
      if (helpMarkingCopy) {
        helpMarkingCopy.innerHTML =
          'Use <strong id="helpMarkingToolName">Tap</strong> to place a pain mark on the body. Use Area to outline a wider region, and Remove to clear a mark. Rotate the body, then use Front / Back / Left / Right to snap the view.';
      }
    } else {
      if (pointBtn) {
        pointBtn.textContent = 'Point';
        pointBtn.title = 'Mark a pain point';
        pointBtn.setAttribute('aria-label', 'Point tool');
      }
      if (circleBtn) {
        circleBtn.textContent = 'Region';
        circleBtn.title = 'Click-drag to mark a pain region';
        circleBtn.setAttribute('aria-label', 'Region tool');
      }
      if (eraserBtn) {
        eraserBtn.textContent = 'Eraser';
        eraserBtn.title = 'Remove region';
        eraserBtn.setAttribute('aria-label', 'Eraser tool');
      }
      if (helpToolName) helpToolName.textContent = 'Point';
      if (helpMarkingCopy) {
        helpMarkingCopy.innerHTML =
          'Use <strong id="helpMarkingToolName">Point</strong> to place a pain mark on the body. Use Region to outline a wider area, and Eraser to clear a mark. Editing stays behind explicit Edit Entry actions. Front / Back / Left / Right snap the view.';
      }
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

  function closePresentationMenu() {
    const menu = document.getElementById('presentationMenu');
    const toggle = document.getElementById('btnPresentationMenu');
    if (!menu) return false;
    const wasOpen = menu.classList.contains('open') || !menu.hasAttribute('hidden');
    menu.setAttribute('hidden', '');
    menu.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
    return wasOpen;
  }

  function initPresentationMode() {
    applyPresentationMode(readStored(), { persist: false });

    document.getElementById('btnPresentationMenu')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const menu = document.getElementById('presentationMenu');
      if (menu) {
        const open = menu.hasAttribute('hidden');
        if (open) menu.removeAttribute('hidden'); else menu.setAttribute('hidden', '');
        menu.classList.toggle('open', open);
        document.getElementById('btnPresentationMenu')?.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    });

    document.querySelectorAll('[data-presentation-option]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        applyPresentationMode(btn.getAttribute('data-presentation-option'));
        closePresentationMenu();
        // Switching from Help must close the dialog so the intended shell is usable.
        try { document.getElementById('helpModal')?.close?.(); } catch (_) { /* ignore */ }
        btn.focus?.();
      });
    });

    // Swallow the outside gesture so anatomy never receives the same pointer that dismisses chrome.
    document.addEventListener('pointerdown', (e) => {
      const menu = document.getElementById('presentationMenu');
      const toggle = document.getElementById('btnPresentationMenu');
      if (!menu || !toggle) return;
      if (!menu.classList.contains('open') && menu.hasAttribute('hidden')) return;
      if (menu.contains(e.target) || toggle.contains(e.target)) return;
      closePresentationMenu();
      e.preventDefault();
      e.stopPropagation();
    }, true);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (closePresentationMenu()) {
          e.preventDefault();
          document.getElementById('btnPresentationMenu')?.focus?.();
          return;
        }
        const openDialog = document.querySelector('dialog[open]');
        if (openDialog) {
          try { openDialog.close(); } catch (_) { /* ignore */ }
          e.preventDefault();
          return;
        }
      }

      if (typeof state === 'undefined' || state.presentationMode === 'patient') return;
      if (document.querySelector('dialog[open]')) return;
      if (global.UiChrome?.isUiChromeBlockingMarks?.()) return;
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
        capture: { label: 'Review', title: 'Review patient marks on anatomy' },
        review: { label: 'Compare', title: 'Compare visits' },
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
