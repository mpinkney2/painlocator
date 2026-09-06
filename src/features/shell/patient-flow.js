/**
 * Patient mobile funnel: Locate → Describe → Review.
 * App shell only — shares entryStore + CAE; does not live in src/engine/.
 * Internal workflowMode stays on "capture" during describe/review pre-save.
 */
(function (global) {
  'use strict';

  const STEPS = Object.freeze(['locate', 'describe', 'review']);

  function toast(msg) {
    if (typeof global.showToast === 'function') {
      global.showToast(msg, { type: 'info' });
    }
  }

  function getState() {
    return typeof state !== 'undefined' ? state : global.state;
  }

  function getStore() {
    return typeof entryStore !== 'undefined' ? entryStore : global.entryStore;
  }

  function setPatientStep(step) {
    const st = getState();
    const next = STEPS.includes(step) ? step : 'locate';
    if (st) st.patientStep = next;
    document.body.classList.toggle('patient-step-locate', next === 'locate');
    document.body.classList.toggle('patient-step-describe', next === 'describe');
    document.body.classList.toggle('patient-step-review', next === 'review');
    document.body.classList.toggle('patient-describe-open', next === 'describe');
    syncPatientChrome();
  }

  function isPatientShell() {
    const st = getState();
    return ((st && st.presentationMode) || 'patient') === 'patient';
  }

  function activeHasRegions() {
    try {
      const store = getStore();
      const entry = store && typeof store.getActiveEntry === 'function' ? store.getActiveEntry() : null;
      return !!(entry && Array.isArray(entry.regions) && entry.regions.length > 0);
    } catch (_) {
      return false;
    }
  }

  function syncForm() {
    try {
      if (typeof syncFormToActiveEntry === 'function') syncFormToActiveEntry();
      else if (typeof getFormValues === 'function' && getStore()?.updateActiveEntry) {
        getStore().updateActiveEntry(getFormValues());
      }
    } catch (_) {
      /* ignore */
    }
  }

  function syncPatientChrome() {
    const patient = isPatientShell();
    const st = getState();
    const step = (st && st.patientStep) || 'locate';
    const sheet = document.getElementById('patientSheet');
    const backdrop = document.getElementById('patientSheetBackdrop');
    const locateCta = document.getElementById('patientLocateCta');
    const describePane = document.getElementById('patientDescribePane');
    const reviewPane = document.getElementById('patientReviewPane');
    const describeBar = document.getElementById('patientDescribeBar');
    const nextDescribe = document.getElementById('btnPatientNextDescribe');
    const confirm = document.getElementById('patientSaveConfirm');

    if (!patient) {
      if (sheet) sheet.hidden = true;
      if (backdrop) backdrop.hidden = true;
      if (locateCta) locateCta.hidden = true;
      if (describeBar) describeBar.hidden = true;
      if (confirm) confirm.hidden = true;
      document.body.classList.remove(
        'patient-step-locate',
        'patient-step-describe',
        'patient-step-review',
        'patient-describe-open'
      );
      return;
    }

    if (locateCta) locateCta.hidden = step !== 'locate';
    if (nextDescribe) nextDescribe.disabled = !activeHasRegions();
    if (describeBar) describeBar.hidden = step !== 'describe';

    const showSheet = step === 'review';
    if (sheet) sheet.hidden = !showSheet;
    if (backdrop) backdrop.hidden = !showSheet;
    if (describePane) describePane.hidden = true;
    if (reviewPane) reviewPane.hidden = !showSheet;

    if (step === 'review') updatePatientSummary();
    if (step === 'describe' && typeof global.setWorkflowMode === 'function') {
      global.setWorkflowMode('capture');
    }
  }

  function updatePatientSummary() {
    const el = document.getElementById('patientReviewSummary');
    if (!el) return;
    const store = getStore();
    const entry = store?.getActiveEntry?.() || null;
    if (!entry) {
      el.innerHTML = '<p class="patient-empty">Tap the body where you feel pain, then describe it.</p>';
      return;
    }
    const region = (entry.regions && entry.regions[0]) || null;
    const location =
      (region && (region.patientLabel || region.physicianLabel || region.id)) ||
      'Marked location';
    const intensity = Number.isFinite(entry.intensity) ? entry.intensity : '—';
    const qualities =
      Array.isArray(entry.quality) && entry.quality.length
        ? entry.quality.join(', ')
        : 'Not specified';
    const pattern = entry.whenOccurring || entry.occurrence || 'Not specified';
    const duration = entry.duration || 'Not specified';
    el.innerHTML = [
      '<dl class="patient-summary-dl">',
      `<div><dt>Where</dt><dd>${escapeHtml(String(location))}</dd></div>`,
      `<div><dt>How bad</dt><dd>${escapeHtml(String(intensity))} / 10</dd></div>`,
      `<div><dt>How it feels</dt><dd>${escapeHtml(String(qualities))}</dd></div>`,
      `<div><dt>When</dt><dd>${escapeHtml(String(pattern))}</dd></div>`,
      `<div><dt>Duration</dt><dd>${escapeHtml(String(duration))}</dd></div>`,
      '</dl>',
    ].join('');
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function goDescribe() {
    if (!activeHasRegions()) {
      toast('Tap the body where you feel pain first.');
      return;
    }
    if (typeof global.setWorkflowMode === 'function') global.setWorkflowMode('capture');
    setPatientStep('describe');
    const panel = document.querySelector('.clinical-doc-panel');
    if (panel && typeof panel.scrollIntoView === 'function') {
      try {
        panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch (_) {
        /* ignore */
      }
    }
  }

  function goReview() {
    syncForm();
    setPatientStep('review');
  }

  function goLocate() {
    if (typeof global.setWorkflowMode === 'function') global.setWorkflowMode('capture');
    setPatientStep('locate');
  }

  function savePatientEntry() {
    syncForm();
    if (typeof global.saveCurrentEntry === 'function') {
      global.saveCurrentEntry();
    } else {
      document.getElementById('btnLog')?.click();
    }
    const confirm = document.getElementById('patientSaveConfirm');
    if (confirm) {
      confirm.hidden = false;
      confirm.textContent = 'Pain entry saved.';
    }
    toast('Pain entry saved.');
    setTimeout(() => {
      setPatientStep('locate');
      if (confirm) confirm.hidden = true;
    }, 1600);
  }

  function refreshPatientFlow() {
    syncPatientChrome();
  }

  function initPatientFlow() {
    const st = getState();
    setPatientStep((st && st.patientStep) || 'locate');

    document.getElementById('btnPatientNextDescribe')?.addEventListener('click', goDescribe);
    document.getElementById('btnPatientToReview')?.addEventListener('click', goReview);
    document.getElementById('btnPatientDescribeReview')?.addEventListener('click', goReview);
    document.getElementById('btnPatientBackLocate')?.addEventListener('click', goLocate);
    document.getElementById('btnPatientBackDescribe')?.addEventListener('click', goDescribe);
    document.getElementById('btnPatientEditLocation')?.addEventListener('click', goLocate);
    document.getElementById('btnPatientEditDescribe')?.addEventListener('click', goDescribe);
    document.getElementById('btnPatientSave')?.addEventListener('click', savePatientEntry);

    document.getElementById('patientSheetBackdrop')?.addEventListener('click', () => {
      if ((getState()?.patientStep || '') === 'review') goDescribe();
    });

    // Patient header tabs drive the funnel (do not jump into clinician History/Report).
    document.getElementById('btnCaptureWF')?.addEventListener(
      'click',
      (ev) => {
        if (!isPatientShell()) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        goLocate();
      },
      true
    );
    document.getElementById('btnClinicalWF')?.addEventListener(
      'click',
      (ev) => {
        if (!isPatientShell()) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        goDescribe();
      },
      true
    );
    document.getElementById('btnReviewWF')?.addEventListener(
      'click',
      (ev) => {
        if (!isPatientShell()) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (!activeHasRegions()) {
          toast('Mark a pain location first.');
          return;
        }
        goReview();
      },
      true
    );

    const store = getStore();
    if (store && typeof store.onChange === 'function') {
      store.onChange(() => syncPatientChrome());
    }

    document.addEventListener('presentationchange', () => {
      if (isPatientShell()) setPatientStep(getState()?.patientStep || 'locate');
      else syncPatientChrome();
    });
  }

  global.setPatientStep = setPatientStep;
  global.refreshPatientFlow = refreshPatientFlow;
  global.initPatientFlow = initPatientFlow;
  global.PatientSteps = STEPS;
})(typeof window !== 'undefined' ? window : globalThis);
