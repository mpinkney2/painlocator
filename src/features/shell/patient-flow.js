/**
 * Patient mobile funnel: Locate → Describe → Review.
 * App shell only — shares entryStore + form adapters; not in src/engine/.
 *
 * PatientDescribeUI → form adapters → entryStore
 * Clinical documentation panel stays clinician-only.
 */
(function (global) {
  'use strict';

  var PatientSteps = Object.freeze(['locate', 'describe', 'review']);

  var QUALITY_CHIPS = Object.freeze([
    { value: 'Ache', label: 'Aching', match: ['Ache', 'Aching'] },
    { value: 'Burning', label: 'Burning', match: ['Burning'] },
    { value: 'Sharp', label: 'Sharp', match: ['Sharp'] },
    { value: 'Throbbing', label: 'Throbbing', match: ['Throbbing'] },
    { value: 'Tingling', label: 'Tingling', match: ['Tingling'] },
    { value: 'Numbness', label: 'Numbness', match: ['Numbness'] },
    { value: 'Pressure', label: 'Pressure', match: ['Pressure'] }
  ]);

  var TIMING_CHIPS = Object.freeze([
    { field: 'duration', value: 'Constant', label: 'Constant' },
    { field: 'whenOccurring', value: 'During activity', label: 'During activity' },
    { field: 'whenOccurring', value: 'At rest', label: 'At rest' },
    { field: 'duration', value: 'Hours', label: 'Lasting hours' },
    { field: 'duration', value: 'Days', label: 'Several days' },
    { field: 'whenOccurring', value: 'Morning', label: 'Morning' }
  ]);

  var TRIGGER_CHIPS = Object.freeze([
    { value: 'Standing', label: 'Standing' },
    { value: 'Sitting', label: 'Sitting' },
    { value: 'Walking', label: 'Walking' },
    { value: 'Lifting', label: 'Lifting' },
    { value: 'Bending', label: 'Bending' },
    { value: 'Coughing', label: 'Coughing' },
    { value: 'First step', label: 'First step' },
    { value: 'At rest', label: 'At rest' }
  ]);

  var RELIEF_CHIPS = Object.freeze([
    { value: '5 sec', label: 'Eases in seconds' },
    { value: '15 sec', label: 'Eases quickly' },
    { value: '1 min', label: 'Eases in a minute' },
    { value: 'None', label: 'Does not ease' }
  ]);

  var describeBuilt = false;
  var saving = false;
  var lastFocusEl = null;

  function toast(msg, type) {
    if (typeof global.showToast === 'function') {
      global.showToast(msg, { type: type || 'info' });
    } else if (typeof showToast === 'function') {
      showToast(msg, { type: type || 'info' });
    }
  }

  function getState() {
    return typeof state !== 'undefined' ? state : global.state;
  }

  function getStore() {
    return typeof entryStore !== 'undefined' ? entryStore : global.entryStore;
  }

  function isPatientShell() {
    var st = getState();
    return ((st && st.presentationMode) || 'patient') === 'patient';
  }

  function activeHasLocations() {
    try {
      var store = getStore();
      var entry = store && typeof store.getActiveEntry === 'function' ? store.getActiveEntry() : null;
      if (!entry) return false;
      var regions = Array.isArray(entry.regions) ? entry.regions.length : 0;
      var points = Array.isArray(entry.points) ? entry.points.length : 0;
      return regions + points > 0;
    } catch (e) {
      return false;
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function arrayIncludes(list, matchers) {
    var values = Array.isArray(list) ? list : [];
    return matchers.some(function (m) { return values.indexOf(m) !== -1; });
  }

  function safeGetFormValues() {
    if (typeof getFormValues !== 'function') return {};
    try { return getFormValues(); } catch (e) { return {}; }
  }

  function pushToFormAndStore() {
    try {
      var patientIntensity = document.getElementById('patientIntensitySlider');
      var intensitySlider = document.getElementById('intensitySlider');
      if (patientIntensity && intensitySlider) {
        intensitySlider.value = patientIntensity.value;
        if (typeof updateIntensityUI === 'function') {
          updateIntensityUI(patientIntensity.value, true);
        }
      }

      var patientNote = document.getElementById('patientNoteInput');
      var notesInput = document.getElementById('notesInput');
      if (patientNote && notesInput) notesInput.value = patientNote.value;

      var quality = QUALITY_CHIPS.filter(function (c) {
        var btn = document.querySelector('[data-patient-quality="' + c.value + '"]');
        return btn && btn.classList.contains('is-selected');
      }).map(function (c) { return c.value; });
      if (typeof setActivePills === 'function') setActivePills('qualityPills', quality);

      var whenBtn = document.querySelector('[data-patient-when].is-selected');
      var durationBtn = document.querySelector('[data-patient-duration].is-selected');
      var occurrenceSelect = document.getElementById('occurrenceSelect');
      var durationSelect = document.getElementById('durationSelect');
      if (occurrenceSelect) {
        occurrenceSelect.value = (whenBtn && whenBtn.getAttribute('data-patient-when')) || '';
      }
      if (durationSelect) {
        durationSelect.value = (durationBtn && durationBtn.getAttribute('data-patient-duration')) || '';
      }

      var triggers = TRIGGER_CHIPS.filter(function (c) {
        var btn = document.querySelector('[data-patient-trigger="' + c.value + '"]');
        return btn && btn.classList.contains('is-selected');
      }).map(function (c) { return c.value; });
      if (typeof setActivePills === 'function') setActivePills('triggerPills', triggers);

      var eases = RELIEF_CHIPS.filter(function (c) {
        var btn = document.querySelector('[data-patient-relief="' + c.value + '"]');
        return btn && btn.classList.contains('is-selected');
      }).map(function (c) { return c.value; });
      if (typeof setActivePills === 'function') setActivePills('easePills', eases);

      if (typeof syncFormToActiveEntry === 'function') {
        syncFormToActiveEntry();
      } else {
        var store = getStore();
        if (store && typeof store.updateActiveEntry === 'function') {
          var form = safeGetFormValues();
          store.updateActiveEntry({
            intensity: patientIntensity ? Number(patientIntensity.value) : (form.intensity != null ? form.intensity : 5),
            quality: quality.length ? quality : (form.quality || []),
            triggers: triggers.length ? triggers : (form.triggers || []),
            easesAfter: eases.length ? eases : (form.easesAfter || []),
            note: patientNote ? patientNote.value.trim() : (form.note || ''),
            duration: durationSelect ? durationSelect.value : (form.duration || ''),
            whenOccurring: occurrenceSelect ? occurrenceSelect.value : (form.whenOccurring || '')
          });
        }
      }
    } catch (e) {
      /* ignore incomplete DOM */
    }
  }

  function pullFromStoreToPatientUI() {
    var store = getStore();
    if (store && typeof store.ensureActiveEntry === 'function') {
      try { store.ensureActiveEntry({ view: 'anterior', gender: 'male' }); } catch (e) {}
    }
    var active = (store && store.getActiveEntry) ? store.getActiveEntry() : null;
    var form = safeGetFormValues();

    var intensity = Number(
      active && active.intensity != null ? active.intensity :
      (form.intensity != null ? form.intensity : 5)
    );
    var quality = Array.isArray(active && active.quality) ? active.quality : (form.quality || []);
    var triggers = Array.isArray(active && active.triggers) ? active.triggers : (form.triggers || []);
    var eases = Array.isArray(active && active.easesAfter) ? active.easesAfter : (form.easesAfter || []);
    var duration = (active && active.duration) || form.duration || '';
    var whenOccurring = (active && active.whenOccurring) || form.whenOccurring || '';
    var note = (active && active.note) || form.note || '';

    var patientIntensity = document.getElementById('patientIntensitySlider');
    var intensityValue = document.getElementById('patientIntensityValue');
    if (patientIntensity) {
      patientIntensity.value = String(intensity);
      patientIntensity.setAttribute('aria-valuenow', String(intensity));
      patientIntensity.setAttribute('aria-valuetext', 'Pain intensity ' + intensity + ' out of 10');
    }
    if (intensityValue) intensityValue.textContent = String(intensity);

    QUALITY_CHIPS.forEach(function (chip) {
      var btn = document.querySelector('[data-patient-quality="' + chip.value + '"]');
      if (!btn) return;
      var on = arrayIncludes(quality, chip.match);
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    document.querySelectorAll('[data-patient-when]').forEach(function (btn) {
      var on = whenOccurring === btn.getAttribute('data-patient-when');
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-patient-duration]').forEach(function (btn) {
      var on = duration === btn.getAttribute('data-patient-duration');
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    TRIGGER_CHIPS.forEach(function (chip) {
      var btn = document.querySelector('[data-patient-trigger="' + chip.value + '"]');
      if (!btn) return;
      var on = Array.isArray(triggers) && triggers.indexOf(chip.value) !== -1;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    RELIEF_CHIPS.forEach(function (chip) {
      var btn = document.querySelector('[data-patient-relief="' + chip.value + '"]');
      if (!btn) return;
      var on = Array.isArray(eases) && eases.indexOf(chip.value) !== -1;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    var patientNote = document.getElementById('patientNoteInput');
    if (patientNote) patientNote.value = note;
  }

  function chipButton(attrs, label) {
    var parts = Object.keys(attrs).map(function (k) {
      return k + '="' + escapeHtml(attrs[k]) + '"';
    }).join(' ');
    return '<button type="button" class="patient-chip" ' + parts + ' aria-pressed="false">' + escapeHtml(label) + '</button>';
  }

  function buildDescribeUI() {
    var mount = document.getElementById('patientDescribeMount');
    if (!mount) return;

    if (!describeBuilt) {
      mount.innerHTML =
        '<section class="patient-describe-section" aria-labelledby="patientIntensityHeading">' +
          '<h3 id="patientIntensityHeading" class="patient-describe-heading">How bad is it?</h3>' +
          '<div class="patient-intensity-row">' +
            '<span class="patient-intensity-value" id="patientIntensityValue" aria-live="polite">5</span>' +
            '<span class="patient-intensity-of">out of 10</span>' +
          '</div>' +
          '<label class="visually-hidden sr-only" for="patientIntensitySlider">Pain intensity from 0 to 10</label>' +
          '<input type="range" id="patientIntensitySlider" class="patient-intensity-slider" min="0" max="10" step="1" value="5"' +
            ' aria-valuemin="0" aria-valuemax="10" aria-valuenow="5" aria-valuetext="Pain intensity 5 out of 10" />' +
          '<div class="patient-intensity-ends" aria-hidden="true"><span>0</span><span>10</span></div>' +
        '</section>' +
        '<section class="patient-describe-section" aria-labelledby="patientQualityHeading">' +
          '<h3 id="patientQualityHeading" class="patient-describe-heading">How does it feel?</h3>' +
          '<div class="patient-chip-grid" role="group" aria-labelledby="patientQualityHeading">' +
            QUALITY_CHIPS.map(function (c) { return chipButton({ 'data-patient-quality': c.value }, c.label); }).join('') +
          '</div>' +
        '</section>' +
        '<section class="patient-describe-section" aria-labelledby="patientTimingHeading">' +
          '<h3 id="patientTimingHeading" class="patient-describe-heading">When does it happen?</h3>' +
          '<div class="patient-chip-grid" role="group" aria-labelledby="patientTimingHeading">' +
            TIMING_CHIPS.map(function (c) {
              return chipButton(
                c.field === 'duration'
                  ? { 'data-patient-duration': c.value }
                  : { 'data-patient-when': c.value },
                c.label
              );
            }).join('') +
          '</div>' +
        '</section>' +
        '<section class="patient-describe-section" aria-labelledby="patientWorseHeading">' +
          '<h3 id="patientWorseHeading" class="patient-describe-heading">What makes it worse?</h3>' +
          '<div class="patient-chip-grid" role="group" aria-labelledby="patientWorseHeading">' +
            TRIGGER_CHIPS.map(function (c) { return chipButton({ 'data-patient-trigger': c.value }, c.label); }).join('') +
          '</div>' +
        '</section>' +
        '<section class="patient-describe-section" aria-labelledby="patientHelpsHeading">' +
          '<h3 id="patientHelpsHeading" class="patient-describe-heading">What helps?</h3>' +
          '<p class="patient-describe-hint">How quickly does the pain ease after it flares?</p>' +
          '<div class="patient-chip-grid" role="group" aria-labelledby="patientHelpsHeading">' +
            RELIEF_CHIPS.map(function (c) { return chipButton({ 'data-patient-relief': c.value }, c.label); }).join('') +
          '</div>' +
        '</section>' +
        '<section class="patient-describe-section" aria-labelledby="patientNoteHeading">' +
          '<h3 id="patientNoteHeading" class="patient-describe-heading">Optional note</h3>' +
          '<label class="visually-hidden sr-only" for="patientNoteInput">Optional note about your pain</label>' +
          '<textarea id="patientNoteInput" class="patient-note-input" rows="3" maxlength="500"' +
            ' placeholder="Anything else you want your care team to know?"></textarea>' +
        '</section>';

      mount.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var chip = target.closest('.patient-chip');
        if (!chip) return;

        if (
          chip.hasAttribute('data-patient-quality') ||
          chip.hasAttribute('data-patient-trigger') ||
          chip.hasAttribute('data-patient-relief')
        ) {
          var next = !chip.classList.contains('is-selected');
          chip.classList.toggle('is-selected', next);
          chip.setAttribute('aria-pressed', next ? 'true' : 'false');
          pushToFormAndStore();
          return;
        }

        if (chip.hasAttribute('data-patient-when')) {
          mount.querySelectorAll('[data-patient-when]').forEach(function (el) {
            el.classList.remove('is-selected');
            el.setAttribute('aria-pressed', 'false');
          });
          chip.classList.add('is-selected');
          chip.setAttribute('aria-pressed', 'true');
          pushToFormAndStore();
          return;
        }

        if (chip.hasAttribute('data-patient-duration')) {
          mount.querySelectorAll('[data-patient-duration]').forEach(function (el) {
            el.classList.remove('is-selected');
            el.setAttribute('aria-pressed', 'false');
          });
          chip.classList.add('is-selected');
          chip.setAttribute('aria-pressed', 'true');
          pushToFormAndStore();
        }
      });

      var patientIntensity = document.getElementById('patientIntensitySlider');
      if (patientIntensity) {
        patientIntensity.addEventListener('input', function () {
          var value = Number(patientIntensity.value || 5);
          patientIntensity.setAttribute('aria-valuenow', String(value));
          patientIntensity.setAttribute('aria-valuetext', 'Pain intensity ' + value + ' out of 10');
          var label = document.getElementById('patientIntensityValue');
          if (label) label.textContent = String(value);
          pushToFormAndStore();
        });
      }

      var noteInput = document.getElementById('patientNoteInput');
      if (noteInput) {
        noteInput.addEventListener('input', function () { pushToFormAndStore(); });
      }

      describeBuilt = true;
    }

    pullFromStoreToPatientUI();
  }

  function locationLines(entry) {
    var regions = Array.isArray(entry && entry.regions) ? entry.regions : [];
    var points = Array.isArray(entry && entry.points) ? entry.points : [];
    var lines = [];
    regions.forEach(function (region, index) {
      lines.push((region && (region.patientLabel || region.label || region.name)) || ('Area ' + (index + 1)));
    });
    points.forEach(function (point, index) {
      lines.push((point && (point.patientLabel || point.label)) || ('Point ' + (index + 1)));
    });
    return lines.length ? lines : ['No location marked'];
  }

  function formatList(values) {
    if (!Array.isArray(values) || values.length === 0) return 'Not specified';
    return values.join(', ');
  }

  function updatePatientSummary() {
    var host = document.getElementById('patientReviewSummary');
    if (!host) return;
    var store = getStore();
    var entry = store && store.getActiveEntry ? store.getActiveEntry() : null;
    if (!entry) {
      host.innerHTML = '<p class="patient-empty">Tap the body where you feel pain, then describe it.</p>';
      return;
    }

    var form = safeGetFormValues();
    var intensity = entry.intensity != null ? entry.intensity : (form.intensity != null ? form.intensity : '—');
    var quality = entry.quality && entry.quality.length ? entry.quality : form.quality;
    var triggers = entry.triggers && entry.triggers.length ? entry.triggers : form.triggers;
    var eases = entry.easesAfter && entry.easesAfter.length ? entry.easesAfter : form.easesAfter;
    var duration = entry.duration || form.duration || '';
    var whenOccurring = entry.whenOccurring || form.whenOccurring || '';
    var note = String(entry.note || form.note || '').trim();
    var locations = locationLines(entry);
    var timingParts = [whenOccurring, duration].filter(Boolean);

    host.innerHTML =
      '<div class="patient-review-block">' +
        '<h3 class="patient-review-label">Reported location</h3>' +
        '<ul class="patient-review-list">' +
          locations.map(function (line) { return '<li>' + escapeHtml(line) + '</li>'; }).join('') +
        '</ul>' +
      '</div>' +
      '<div class="patient-review-block">' +
        '<h3 class="patient-review-label">Intensity</h3>' +
        '<p class="patient-review-value">' + escapeHtml(String(intensity)) + ' out of 10</p>' +
      '</div>' +
      '<div class="patient-review-block">' +
        '<h3 class="patient-review-label">Pain characteristics</h3>' +
        '<p class="patient-review-value">' + escapeHtml(formatList(quality)) + '</p>' +
      '</div>' +
      '<div class="patient-review-block">' +
        '<h3 class="patient-review-label">Timing / duration</h3>' +
        '<p class="patient-review-value">' + escapeHtml(timingParts.length ? timingParts.join(' · ') : 'Not specified') + '</p>' +
      '</div>' +
      '<div class="patient-review-block">' +
        '<h3 class="patient-review-label">What makes it worse</h3>' +
        '<p class="patient-review-value">' + escapeHtml(formatList(triggers)) + '</p>' +
      '</div>' +
      '<div class="patient-review-block">' +
        '<h3 class="patient-review-label">What helps</h3>' +
        '<p class="patient-review-value">' + escapeHtml(formatList(eases)) + '</p>' +
      '</div>' +
      '<div class="patient-review-block">' +
        '<h3 class="patient-review-label">Optional note</h3>' +
        '<p class="patient-review-value">' + escapeHtml(note || 'None') + '</p>' +
      '</div>';
  }

  function updateStepChrome() {
    var patient = isPatientShell();
    var st = getState();
    var step = (st && st.patientStep) || 'locate';
    var sheet = document.getElementById('patientSheet');
    var backdrop = document.getElementById('patientSheetBackdrop');
    var locateCta = document.getElementById('patientLocateCta');
    var describePane = document.getElementById('patientDescribePane');
    var reviewPane = document.getElementById('patientReviewPane');
    var describeBar = document.getElementById('patientDescribeBar');
    var nextDescribe = document.getElementById('btnPatientNextDescribe');
    var confirm = document.getElementById('patientSaveConfirm');
    var indicator = document.getElementById('patientStepIndicator');
    var status = document.getElementById('patientStepStatus');

    document.body.classList.toggle('patient-step-locate', !!(patient && step === 'locate'));
    document.body.classList.toggle('patient-step-describe', !!(patient && step === 'describe'));
    document.body.classList.toggle('patient-step-review', !!(patient && step === 'review'));
    document.body.classList.toggle('patient-describe-open', !!(patient && step === 'describe'));

    if (!patient) {
      if (sheet) sheet.hidden = true;
      if (backdrop) backdrop.hidden = true;
      if (locateCta) locateCta.hidden = true;
      if (describeBar) describeBar.hidden = true;
      if (confirm) confirm.hidden = true;
      if (indicator) indicator.hidden = true;
      document.body.classList.remove(
        'patient-step-locate',
        'patient-step-describe',
        'patient-step-review',
        'patient-describe-open'
      );
      return;
    }

    if (indicator) indicator.hidden = false;
    var index = PatientSteps.indexOf(step);
    if (status) {
      status.textContent = 'Step ' + (index + 1) + ' of 3 · ' + step.charAt(0).toUpperCase() + step.slice(1);
    }
    if (indicator) {
      indicator.querySelectorAll('[data-patient-step]').forEach(function (el) {
        var s = el.getAttribute('data-patient-step');
        var stepIndex = PatientSteps.indexOf(s);
        el.classList.toggle('is-current', s === step);
        el.classList.toggle('is-complete', stepIndex >= 0 && stepIndex < index);
        el.classList.toggle('is-done', stepIndex >= 0 && stepIndex < index);
        el.setAttribute('aria-current', s === step ? 'step' : 'false');
      });
    }

    if (locateCta) locateCta.hidden = step !== 'locate';
    var hasLocations = activeHasLocations();
    if (nextDescribe) nextDescribe.disabled = !hasLocations;
    if (locateCta) locateCta.classList.toggle('has-location', hasLocations);
    var locateHint = document.getElementById('patientLocateHint');
    if (locateHint) {
      locateHint.hidden = hasLocations;
      locateHint.setAttribute('aria-hidden', hasLocations ? 'true' : 'false');
    }
    if (describeBar) describeBar.hidden = step !== 'describe';

    var showSheet = step === 'describe' || step === 'review';
    if (sheet) {
      sheet.hidden = !showSheet;
      sheet.setAttribute('role', showSheet ? 'dialog' : 'presentation');
      sheet.setAttribute('aria-modal', showSheet ? 'true' : 'false');
      sheet.setAttribute('aria-labelledby', step === 'review' ? 'patientReviewTitle' : 'patientDescribeTitle');
    }
    if (backdrop) backdrop.hidden = !showSheet;
    if (describePane) describePane.hidden = step !== 'describe';
    if (reviewPane) reviewPane.hidden = step !== 'review';
    if (confirm && step !== 'review') confirm.hidden = true;

    if (step === 'review') {
      updatePatientSummary();
      if (typeof updateEntryList === 'function') updateEntryList();
      else if (typeof global.updateEntryList === 'function') global.updateEntryList();
    }
  }

  function openPatientShare() {
    if (typeof global.openExportModal === 'function') {
      global.openExportModal({ audience: 'patient' });
    } else if (typeof openExportModal === 'function') {
      openExportModal({ audience: 'patient' });
    }
    if (typeof global.trackEvent === 'function') global.trackEvent('report_opened', { audience: 'patient' });
    else trackEvent?.('report_opened', { audience: 'patient' });
  }

  function setPatientStep(step, options) {
    var opts = options || {};
    var st = getState();
    var next = PatientSteps.indexOf(step) >= 0 ? step : 'locate';

    if (!isPatientShell()) {
      if (st) st.patientStep = 'locate';
      updateStepChrome();
      return;
    }

    if ((next === 'describe' || next === 'review') && !opts.force && !activeHasLocations()) {
      toast('Mark at least one pain location to continue.', 'warning');
      next = 'locate';
    }

    if (st) st.patientStep = next;

    if (next === 'describe' || next === 'review') {
      if (typeof global.setWorkflowMode === 'function') global.setWorkflowMode('capture');
      else if (typeof setWorkflowMode === 'function') setWorkflowMode('capture');
    }

    if (next === 'describe') buildDescribeUI();
    if (next === 'review') {
      pushToFormAndStore();
      updatePatientSummary();
      if (typeof updateEntryList === 'function') updateEntryList();
      else if (typeof global.updateEntryList === 'function') global.updateEntryList();
    }

    updateStepChrome();

    if (next === 'describe') {
      var slider = document.getElementById('patientIntensitySlider');
      var dTitle = document.getElementById('patientDescribeTitle');
      if (slider && slider.focus) slider.focus();
      else if (dTitle && dTitle.focus) dTitle.focus();
    } else if (next === 'review') {
      var rTitle = document.getElementById('patientReviewTitle');
      if (rTitle && rTitle.focus) rTitle.focus();
    } else if (lastFocusEl && lastFocusEl.focus) {
      try { lastFocusEl.focus(); } catch (e) {
        var btn = document.getElementById('btnPatientNextDescribe');
        if (btn && btn.focus) btn.focus();
      }
    }
  }

  function goDescribe() {
    if (!activeHasLocations()) {
      toast('Mark at least one pain location to continue.', 'warning');
      return;
    }
    lastFocusEl = document.activeElement;
    if (typeof global.setWorkflowMode === 'function') global.setWorkflowMode('capture');
    else if (typeof setWorkflowMode === 'function') setWorkflowMode('capture');
    setPatientStep('describe');
  }

  function goReview() {
    pushToFormAndStore();
    lastFocusEl = document.activeElement;
    setPatientStep('review');
  }

  function goLocate() {
    if (typeof global.setWorkflowMode === 'function') global.setWorkflowMode('capture');
    else if (typeof setWorkflowMode === 'function') setWorkflowMode('capture');
    setPatientStep('locate', { force: true });
  }

  async function savePatientEntry() {
    if (saving) return null;
    var saveBtn = document.getElementById('btnPatientSave');
    saving = true;
    if (saveBtn) {
      saveBtn.disabled = true;
      if (typeof saveBtn.setAttribute === 'function') saveBtn.setAttribute('aria-busy', 'true');
      saveBtn.textContent = 'Saving…';
    }

    try {
      pushToFormAndStore();
      var saved = null;
      if (typeof global.saveCurrentEntry === 'function') {
        saved = await global.saveCurrentEntry({ quiet: true });
      } else if (typeof saveCurrentEntry === 'function') {
        saved = await saveCurrentEntry({ quiet: true });
      }

      if (!saved) return null;

      var confirm = document.getElementById('patientSaveConfirm');
      if (confirm) {
        confirm.hidden = false;
        confirm.textContent = 'Pain entry saved.';
      }
      toast('Pain entry saved.', 'success');
      setPatientStep('locate', { force: true });
      return saved;
    } finally {
      saving = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        if (typeof saveBtn.removeAttribute === 'function') saveBtn.removeAttribute('aria-busy');
        saveBtn.textContent = 'Save Pain Entry';
      }
    }
  }

  function refreshPatientFlow() {
    updateStepChrome();
    if (isPatientShell()) {
      var step = (getState() && getState().patientStep) || 'locate';
      if (step === 'describe') buildDescribeUI();
      if (step === 'review') updatePatientSummary();
    }
  }

  function on(id, event, handler, capture) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(event, handler, !!capture);
  }

  function initPatientFlow() {
    var st = getState();
    setPatientStep((st && st.patientStep) || 'locate', { force: true });

    on('btnPatientNextDescribe', 'click', goDescribe);
    on('btnPatientToReview', 'click', goReview);
    on('btnPatientDescribeReview', 'click', goReview);
    on('btnPatientBackLocate', 'click', goLocate);
    on('btnPatientBackDescribe', 'click', goDescribe);
    on('btnPatientEditLocation', 'click', goLocate);
    on('btnPatientEditDescribe', 'click', goDescribe);
    on('btnPatientSave', 'click', function () { void savePatientEntry(); });
    on('btnPatientShare', 'click', openPatientShare);

    on('patientSheetBackdrop', 'click', function () {
      var step = (getState() && getState().patientStep) || '';
      if (step === 'review') goDescribe();
      else if (step === 'describe') goLocate();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !isPatientShell()) return;
      var step = (getState() && getState().patientStep) || '';
      if (step === 'review') {
        e.preventDefault();
        goDescribe();
      } else if (step === 'describe') {
        e.preventDefault();
        goLocate();
      }
    });

    on('btnCaptureWF', 'click', function (ev) {
      if (!isPatientShell()) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      goLocate();
    }, true);
    on('btnClinicalWF', 'click', function (ev) {
      if (!isPatientShell()) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      goDescribe();
    }, true);
    on('btnReviewWF', 'click', function (ev) {
      if (!isPatientShell()) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (!activeHasLocations()) {
        var histStore = getStore();
        if (histStore && histStore.entries && histStore.entries.length) {
          // Browse saved history even when the current draft has no marks yet.
          setPatientStep('review', { force: true });
          return;
        }
        toast('Mark at least one pain location to continue.', 'warning');
        return;
      }
      goReview();
    }, true);

    var store = getStore();
    if (store && typeof store.onChange === 'function') {
      store.onChange(function () {
        if (!isPatientShell()) return;
        updateStepChrome();
        if (((getState() && getState().patientStep) || '') === 'review') {
          updatePatientSummary();
          if (typeof updateEntryList === 'function') updateEntryList();
        }
      });
    }

    document.addEventListener('presentationchange', function () {
      // Preserve draft / saved active entry across role switches — only refresh chrome.
      var st = getState();
      var storeNow = getStore();
      if (isPatientShell()) {
        var step = (st && st.patientStep) || 'locate';
        setPatientStep(step, { force: true });
      } else {
        refreshPatientFlow();
      }
      if (typeof global.syncSaveStatusFromStore === 'function') global.syncSaveStatusFromStore();
      else if (typeof syncSaveStatusFromStore === 'function') syncSaveStatusFromStore();
      if (typeof updateEntryList === 'function') updateEntryList();
      if (storeNow && storeNow.getActiveEntry) {
        var active = storeNow.getActiveEntry();
        if (active) {
          if (typeof global.populateFormFromEntry === 'function') global.populateFormFromEntry(active);
          else if (typeof populateFormFromEntry === 'function') populateFormFromEntry(active);
        }
      }
      if (global.demoMode && typeof global.demoMode.updateBadge === 'function') {
        global.demoMode.updateBadge();
      } else if (window.demoMode && typeof window.demoMode.isActive === 'function') {
        var badge = document.getElementById('demoModeBadge');
        var on = window.demoMode.isActive();
        document.body.classList.toggle('demo-mode-active', on);
        if (badge) badge.hidden = !on;
      }
    });
  }

  global.setPatientStep = setPatientStep;
  global.refreshPatientFlow = refreshPatientFlow;
  global.initPatientFlow = initPatientFlow;
  global.savePatientEntry = savePatientEntry;
  global.PatientSteps = PatientSteps;
  global.__patientDescribe = {
    QUALITY_CHIPS: QUALITY_CHIPS,
    TIMING_CHIPS: TIMING_CHIPS,
    TRIGGER_CHIPS: TRIGGER_CHIPS,
    RELIEF_CHIPS: RELIEF_CHIPS,
    pushToFormAndStore: pushToFormAndStore,
    buildDescribeUI: buildDescribeUI
  };
  global.__testables = {
    activeHasLocations: activeHasLocations,
    savePatientEntry: savePatientEntry,
    isSaving: function () { return saving; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
