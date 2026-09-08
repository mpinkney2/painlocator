/**
 * Simple pain-map shell: single screen (body + describe), warm white / navy / amber.
 * Reuses entryStore save/history/share. Hides anatomy layers & technical chrome.
 */
(function (global) {
  'use strict';

  var PatientSteps = Object.freeze(['locate', 'describe', 'review']);

  var PRIMARY_QUALITY = Object.freeze([
    { value: 'Ache', label: 'Aching', match: ['Ache', 'Aching'] },
    { value: 'Sharp', label: 'Sharp', match: ['Sharp'] },
    { value: 'Burning', label: 'Burning', match: ['Burning'] }
  ]);

  var MORE_QUALITY = Object.freeze([
    { value: 'Throbbing', label: 'Throbbing', match: ['Throbbing'] },
    { value: 'Tingling', label: 'Tingling', match: ['Tingling'] },
    { value: 'Numbness', label: 'Numbness', match: ['Numbness'] },
    { value: 'Pressure', label: 'Pressure', match: ['Pressure'] }
  ]);

  var QUALITY_CHIPS = Object.freeze(PRIMARY_QUALITY.concat(MORE_QUALITY));

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
  var simpleView = 'map'; // map | history
  var assessStep = 'mark'; // mark | describe | save
  var ASSESS_STEPS = Object.freeze(['mark', 'describe', 'save']);

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
      try { store.ensureActiveEntry('adult-male'); } catch (e) {}
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
      patientIntensity.style.setProperty('--spm-slider-pct', (intensity * 10) + '%');
    }
    if (intensityValue) intensityValue.textContent = String(intensity);
    // Keep anatomy marks colored to the active intensity.
    refreshMarkColors();

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

  function updateLocationChrome() {
    var idEl = document.getElementById('simplePainId');
    var titleEl = document.getElementById('simplePainLocationTitle');
    var summaryEl = document.getElementById('simpleMarksSummary');
    var undoMarkBtn = document.getElementById('btnSimpleUndoMark');
    var saveSummary = document.getElementById('simpleSaveSummary');
    var store = getStore();
    var entry = store && store.getActiveEntry ? store.getActiveEntry() : null;
    var regions = Array.isArray(entry && entry.regions) ? entry.regions : [];
    var points = Array.isArray(entry && entry.points) ? entry.points : [];
    var marks = regions.concat(points);
    var count = marks.length;
    if (idEl) {
      idEl.textContent = count > 0 ? ('Pain ' + count) : 'Pain map';
    }
    if (titleEl) {
      if (assessStep === 'describe') {
        titleEl.textContent = count ? 'Describe how it feels' : 'Describe your pain';
      } else if (assessStep === 'save') {
        titleEl.textContent = 'Review & save';
      } else if (!count) {
        titleEl.textContent = 'Tap the body to begin';
      } else {
        var last = marks[marks.length - 1];
        titleEl.textContent =
          (last && (last.patientLabel || last.label || last.name || last.physicianLabel)) ||
          ('Mark ' + count);
      }
    }
    if (summaryEl) {
      var strength = entry && entry.intensity != null ? entry.intensity : 5;
      if (!count) {
        summaryEl.textContent = 'No marks yet — choose Point or Area, then mark the body.';
      } else if (count === 1) {
        summaryEl.textContent = '1 mark · strength ' + strength + '/10. Continue to describe how it feels.';
      } else {
        summaryEl.textContent = count + ' marks · strength ' + strength + '/10. Use Remove to delete one, or continue.';
      }
    }
    if (saveSummary) {
      var intensity = entry && entry.intensity != null ? entry.intensity : '—';
      var quality = entry && Array.isArray(entry.quality) && entry.quality.length
        ? entry.quality.join(', ')
        : 'Not specified';
      saveSummary.innerHTML =
        '<p><strong>Marks:</strong> ' + count + '</p>' +
        '<p><strong>Strength:</strong> ' + escapeHtml(String(intensity)) + ' / 10</p>' +
        '<p><strong>Feels like:</strong> ' + escapeHtml(quality) + '</p>';
    }
    if (undoMarkBtn) {
      var canUndo = !!(store && typeof store.canUndo === 'function' && store.canUndo());
      undoMarkBtn.disabled = !canUndo;
    }
    syncSimpleAnnotateActive();
  }

  function syncSimpleAnnotateActive() {
    var store = getStore();
    var tool = (store && store.activeTool) || 'point';
    var bar = document.getElementById('captureTools');
    if (bar) {
      bar.querySelectorAll('.region-tool[data-tool]').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-tool') === tool);
      });
    }
    document.querySelectorAll('[data-patient-tool]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-patient-tool') === tool);
    });
  }

  function toolHint(tool) {
    if (tool === 'eraser') return 'Tap a mark on the body to remove it.';
    if (tool === 'circle') return 'Drag on the body to mark a pain area.';
    if (tool === 'polygon') return 'Tap points to outline a pain shape. Double-tap to finish.';
    return 'Tap the body where it hurts.';
  }

  function activatePatientTool(tool) {
    try {
      var store = getStore();
      if (store && typeof store.setTool === 'function') store.setTool(tool);
      if (typeof global.setRegionTool === 'function') global.setRegionTool(tool);
      else if (typeof setRegionTool === 'function') setRegionTool(tool);
    } catch (e) { /* ignore */ }
    var bar = document.getElementById('captureTools');
    if (bar) {
      bar.querySelectorAll('.region-tool[data-tool]').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-tool') === tool);
      });
    }
    syncSimpleAnnotateActive();
    var hint = document.getElementById('avatarHint');
    if (hint) {
      hint.textContent = toolHint(tool);
      hint.classList.remove('hidden');
    }
  }


  function refreshPatientIcons() {
    try {
      if (global.lucide && typeof global.lucide.createIcons === 'function') {
        global.lucide.createIcons();
      } else if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    } catch (e) { /* ignore */ }
  }

  function syncAnatomyLayout() {
    try {
      var st = getState();
      var engine = st && st.engine;
      if (engine && engine.clinicalRenderer && typeof engine.clinicalRenderer.syncLayout === 'function') {
        engine.clinicalRenderer.syncLayout();
      } else if (engine && typeof engine.renderPins === 'function') {
        engine.renderPins();
      }
      if (typeof global.refreshUI === 'function') global.refreshUI();
      else if (typeof refreshUI === 'function') refreshUI();
    } catch (e) { /* ignore */ }
  }

  function setDrawerExpanded(expanded) {
    expanded = !!expanded;
    document.body.classList.toggle('simple-drawer-expanded', expanded);
    var grab = document.getElementById('simpleDrawerGrab');
    if (grab) {
      grab.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      grab.setAttribute('title', expanded ? 'Collapse tools' : 'Open tools');
      grab.setAttribute(
        'aria-label',
        expanded ? 'Collapse assessment panel' : 'Expand assessment panel — swipe up'
      );
    }
    // Re-fit markers while the drawer/image eases, then once more after settle.
    syncAnatomyLayout();
    var schedule = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : function (fn) { fn(); };
    schedule(function () {
      syncAnatomyLayout();
      if (typeof setTimeout === 'function') {
        setTimeout(syncAnatomyLayout, 220);
        setTimeout(syncAnatomyLayout, 450);
      }
    });
  }

  function placePatientDrawerChrome() {
    var tools = document.getElementById('captureTools');
    var views = document.getElementById('simpleViewBar');
    var hint = document.getElementById('avatarHint');
    var panel = document.getElementById('simplePainPanel');
    var sheet = document.getElementById('simpleDrawerSheet') || panel;
    var wrap = document.getElementById('avatarWrap');
    var stage = document.getElementById('avatarStage');
    if (!tools || !wrap) return;

    if (isPatientShell() && sheet) {
      var context = sheet.querySelector('.simple-pain-context');
      if (hint) {
        hint.classList.add('simple-drawer-hint');
        if (hint.parentElement !== sheet) {
          sheet.insertBefore(hint, context ? context.nextSibling : sheet.firstChild);
        }
      }
      if (tools.parentElement !== sheet) {
        sheet.insertBefore(tools, sheet.querySelector('#simpleViewBar') || sheet.querySelector('.simple-pain-panel-body') || null);
      }
      if (views && views.parentElement !== sheet) {
        sheet.insertBefore(views, sheet.querySelector('.simple-assess-nav') || sheet.querySelector('.simple-pain-panel-body') || null);
      }
      if (hint && tools) sheet.insertBefore(hint, tools);
      if (tools && views) sheet.insertBefore(tools, views);
      refreshPatientIcons();
    } else {
      if (hint) {
        hint.classList.remove('simple-drawer-hint');
        if (stage && stage.parentElement === wrap) wrap.insertBefore(hint, stage.nextSibling);
        else wrap.appendChild(hint);
      }
      if (tools.parentElement !== wrap) wrap.appendChild(tools);
      if (views && views.parentElement !== wrap) wrap.appendChild(views);
    }
  }

  function setAssessStep(step, opts) {
    if (ASSESS_STEPS.indexOf(step) < 0) step = 'mark';
    assessStep = step;
    var panel = document.getElementById('simplePainPanel');
    if (panel) panel.setAttribute('data-assess-step', step);
    document.body.setAttribute('data-assess-step', step);

    document.querySelectorAll('.simple-assess-tab').forEach(function (tab) {
      var on = tab.getAttribute('data-assess-step') === step;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    document.querySelectorAll('[data-assess-panel]').forEach(function (section) {
      var panel = section.getAttribute('data-assess-panel');
      var match = panel === step || (step === 'mark' && panel === 'mark');
      if (panel === 'save') match = false; // mock uses Save CTA directly
      if (step === 'describe' && panel === 'describe') match = true;
      if (step === 'describe' && panel === 'mark') match = false;
      if (step === 'mark' && panel === 'describe') match = false;
      section.hidden = !match;
      section.classList.toggle('is-active-panel', match);
    });

    var back = document.getElementById('btnAssessBack');
    var next = document.getElementById('btnAssessNext');
    var save = document.getElementById('btnPatientSave');
    if (back) back.hidden = true;
    if (next) {
      next.hidden = false;
      next.textContent = step === 'describe' ? 'Back to mark' : 'Describe pain';
    }
    if (save) save.hidden = false;

    if (step === 'describe' || step === 'save') {
      setDrawerExpanded(true);
    } else if (opts && opts.forceExpand) {
      setDrawerExpanded(true);
    } else if (!(opts && opts.keepExpanded)) {
      // leave drawer state as-is unless explicitly collapsing
    }

    updateLocationChrome();
  }

  function buildDescribeUI() {
    var mount = document.getElementById('patientDescribeMount');
    if (!mount) return;

    if (!describeBuilt) {
      mount.innerHTML =
        '<section class="simple-assess-panel simple-marks-section" data-assess-panel="mark" aria-labelledby="simpleMarksHeading">' +
          '<h3 id="simpleMarksHeading" class="visually-hidden sr-only">Your marks</h3>' +
          '<p class="simple-marks-summary" id="simpleMarksSummary">No marks yet — choose Point or Area, then mark the body.</p>' +
          '<details class="simple-tool-help">' +
            '<summary>Marking tips</summary>' +
            '<ul>' +
              '<li><strong>Tap</strong> — tap once for a specific spot.</li>' +
              '<li><strong>Area</strong> — drag to cover a broader region.</li>' +
              '<li><strong>Outline</strong> — tap corners of an irregular shape.</li>' +
            '</ul>' +
          '</details>' +
        '</section>' +
        '<section class="simple-assess-panel patient-describe-section" data-assess-panel="describe" hidden aria-labelledby="patientQualityHeading">' +
          '<h3 id="patientQualityHeading" class="patient-describe-heading">What does it feel like?</h3>' +
          '<div class="patient-chip-grid patient-chip-grid-primary" role="group" aria-labelledby="patientQualityHeading">' +
            PRIMARY_QUALITY.map(function (c) { return chipButton({ 'data-patient-quality': c.value }, c.label); }).join('') +
          '</div>' +
          '<details class="simple-more-descriptions">' +
            '<summary>More descriptions</summary>' +
            '<div class="patient-chip-grid" role="group" aria-label="More descriptions">' +
              MORE_QUALITY.map(function (c) { return chipButton({ 'data-patient-quality': c.value }, c.label); }).join('') +
              TIMING_CHIPS.map(function (c) {
                return chipButton(
                  c.field === 'duration'
                    ? { 'data-patient-duration': c.value }
                    : { 'data-patient-when': c.value },
                  c.label
                );
              }).join('') +
              TRIGGER_CHIPS.map(function (c) { return chipButton({ 'data-patient-trigger': c.value }, c.label); }).join('') +
              RELIEF_CHIPS.map(function (c) { return chipButton({ 'data-patient-relief': c.value }, c.label); }).join('') +
            '</div>' +
          '</details>' +
          '<h3 id="patientNoteHeading" class="patient-describe-heading simple-subhead">Add a note <span class="optional-label">(optional)</span></h3>' +
          '<label class="visually-hidden sr-only" for="patientNoteInput">Optional note about your pain</label>' +
          '<textarea id="patientNoteInput" class="patient-note-input" rows="2" maxlength="500"' +
            ' placeholder="e.g. Worse in the evening..."></textarea>' +
        '</section>' +
        '<section class="simple-assess-panel simple-save-panel" data-assess-panel="save" hidden aria-labelledby="simpleSaveHeading">' +
          '<h3 id="simpleSaveHeading" class="patient-describe-heading">Ready to save?</h3>' +
          '<div class="simple-save-summary" id="simpleSaveSummary"></div>' +
          '<p class="simple-marks-summary">You can go back to adjust marks or description before saving.</p>' +
        '</section>';

      on('btnSimpleUndoMark', 'click', function () {
        var undoBtn = document.getElementById('btnUndo');
        if (undoBtn && !undoBtn.disabled) undoBtn.click();
        else if (typeof global.performUndo === 'function') global.performUndo();
        updateLocationChrome();
      });

      mount.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var toolBtn = target.closest('[data-patient-tool]');
        if (toolBtn) {
          activatePatientTool(toolBtn.getAttribute('data-patient-tool'));
          return;
        }
        var chip = target.closest('.patient-chip');
        if (!chip) return;

        if (
          chip.hasAttribute('data-patient-quality') ||
          chip.hasAttribute('data-patient-trigger') ||
          chip.hasAttribute('data-patient-relief')
        ) {
          var nextSel = !chip.classList.contains('is-selected');
          chip.classList.toggle('is-selected', nextSel);
          chip.setAttribute('aria-pressed', nextSel ? 'true' : 'false');
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

      var noteInput = document.getElementById('patientNoteInput');
      if (noteInput) {
        noteInput.addEventListener('input', function () { pushToFormAndStore(); });
      }

      describeBuilt = true;
    }

    bindMapIntensityUI();
    pullFromStoreToPatientUI();
    setAssessStep(assessStep, { skipExpand: assessStep === 'mark' });
  }

  function refreshMarkColors() {
    try {
      var st = getState();
      var engine = st && st.engine;
      if (engine && engine.clinicalRenderer && typeof engine.clinicalRenderer.renderRegions === 'function') {
        engine.clinicalRenderer.renderRegions();
      } else if (engine && typeof engine.renderPins === 'function') {
        engine.renderPins();
      }
      if (typeof global.refreshUI === 'function') global.refreshUI();
      else if (typeof refreshUI === 'function') refreshUI();
    } catch (e) { /* ignore */ }
  }

  function applyIntensityValue(value, opts) {
    var options = opts || {};
    value = Math.max(0, Math.min(10, Number(value)));
    if (!isFinite(value)) value = 5;
    var patientIntensity = document.getElementById('patientIntensitySlider');
    var label = document.getElementById('patientIntensityValue');
    if (patientIntensity) {
      patientIntensity.value = String(value);
      patientIntensity.setAttribute('aria-valuenow', String(value));
      patientIntensity.setAttribute('aria-valuetext', 'Pain intensity ' + value + ' out of 10');
      patientIntensity.style.setProperty('--spm-slider-pct', (value * 10) + '%');
    }
    if (label) label.textContent = String(value);
    if (!options.skipStore) {
      try {
        var store = getStore();
        if (store && typeof store.updateActiveEntry === 'function') {
          store.updateActiveEntry({ intensity: value });
        }
        var intensitySlider = document.getElementById('intensitySlider');
        if (intensitySlider) intensitySlider.value = String(value);
        if (typeof updateIntensityUI === 'function') updateIntensityUI(value, true);
      } catch (e) { /* ignore */ }
    }
    if (!options.skipRender) refreshMarkColors();
    if (!options.skipChrome) {
      try { updateLocationChrome(); } catch (e) { /* ignore */ }
    }
  }

  var mapIntensityBound = false;
  function bindMapIntensityUI() {
    var patientIntensity = document.getElementById('patientIntensitySlider');
    if (!patientIntensity) return;
    if (!mapIntensityBound) {
      mapIntensityBound = true;
      patientIntensity.addEventListener('input', function () {
        applyIntensityValue(patientIntensity.value);
        pushToFormAndStore();
      });
      patientIntensity.addEventListener('change', function () {
        applyIntensityValue(patientIntensity.value);
        pushToFormAndStore();
      });
    }
    patientIntensity.style.setProperty(
      '--spm-slider-pct',
      (Number(patientIntensity.value || 5) * 10) + '%'
    );
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
    var note = String(entry.note || form.note || '').trim();
    var locations = locationLines(entry);

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
        '<h3 class="patient-review-label">Descriptions</h3>' +
        '<p class="patient-review-value">' + escapeHtml(formatList(quality)) + '</p>' +
      '</div>' +
      '<div class="patient-review-block">' +
        '<h3 class="patient-review-label">Note</h3>' +
        '<p class="patient-review-value">' + escapeHtml(note || 'None') + '</p>' +
      '</div>';
  }

  function syncSimpleNav() {
    var mapBtn = document.getElementById('btnSimplePainMap');
    var histBtn = document.getElementById('btnSimpleHistory');
    if (mapBtn) {
      mapBtn.classList.toggle('is-active', simpleView === 'map');
      mapBtn.setAttribute('aria-current', simpleView === 'map' ? 'page' : 'false');
    }
    if (histBtn) {
      histBtn.classList.toggle('is-active', simpleView === 'history');
      histBtn.setAttribute('aria-current', simpleView === 'history' ? 'page' : 'false');
    }
  }

  function setSimpleView(view) {
    simpleView = view === 'history' ? 'history' : 'map';
    document.body.classList.toggle('simple-view-history', isPatientShell() && simpleView === 'history');
    document.body.classList.toggle('simple-view-map', isPatientShell() && simpleView === 'map');
    syncSimpleNav();

    if (simpleView === 'history') {
      if (typeof global.setWorkflowMode === 'function') global.setWorkflowMode('review');
      else if (typeof setWorkflowMode === 'function') setWorkflowMode('review');
      try {
        if (typeof global.updateChartTheme === 'function') global.updateChartTheme();
        else if (typeof updateChartTheme === 'function') updateChartTheme();
        if (typeof global.updateChart === 'function') global.updateChart();
        else if (typeof updateChart === 'function') updateChart();
      } catch (e) { /* ignore */ }
      setDrawerExpanded(false);
    } else {
      if (typeof global.setWorkflowMode === 'function') global.setWorkflowMode('capture');
      else if (typeof setWorkflowMode === 'function') setWorkflowMode('capture');
      buildDescribeUI();
      activatePatientTool('point');
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(syncAnatomyLayout);
      } else {
        syncAnatomyLayout();
      }
    }
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
    var confirm = document.getElementById('patientSaveConfirm');
    var indicator = document.getElementById('patientStepIndicator');
    var status = document.getElementById('patientStepStatus');
    var panel = document.getElementById('simplePainPanel');
    var headline = document.getElementById('simplePainHeadline');

    document.body.classList.toggle('patient-step-locate', !!(patient && step === 'locate'));
    document.body.classList.toggle('patient-step-describe', !!(patient && step === 'describe'));
    document.body.classList.toggle('patient-step-review', !!(patient && step === 'review'));
    document.body.classList.toggle('patient-describe-open', !!(patient && step === 'describe'));
    document.body.classList.toggle('simple-pain-map', patient);

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
        'patient-describe-open',
        'simple-pain-map',
        'simple-view-map',
        'simple-view-history'
      );
      return;
    }

    // Single-screen map: hide legacy funnel chrome
    if (indicator) indicator.hidden = true;
    if (locateCta) locateCta.hidden = true;
    if (describeBar) describeBar.hidden = true;
    if (sheet) sheet.hidden = true;
    if (backdrop) backdrop.hidden = true;
    if (describePane) describePane.hidden = true;
    if (reviewPane) reviewPane.hidden = true;
    if (status) status.textContent = simpleView === 'history' ? 'History' : 'Pain map';
    if (panel) panel.hidden = simpleView === 'history';
    if (headline) headline.hidden = simpleView === 'history';

    document.body.classList.toggle('simple-view-history', simpleView === 'history');
    document.body.classList.toggle('simple-view-map', simpleView === 'map');
    syncSimpleNav();

    if (simpleView === 'map') buildDescribeUI();
    if (step === 'review') updatePatientSummary();
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

    // Simple map keeps describe always available; only gate review/save on locations.
    if (next === 'review' && !opts.force && !activeHasLocations()) {
      toast('Mark at least one pain location before saving.', 'warning');
      next = 'locate';
    }

    if (st) st.patientStep = next;

    if (next === 'describe' || next === 'locate') {
      setSimpleView('map');
    }

    if (next === 'describe' || next === 'locate' || next === 'review') {
      buildDescribeUI();
    }
    if (next === 'review') {
      pushToFormAndStore();
      updatePatientSummary();
    }

    updateStepChrome();
  }

  function goDescribe() {
    lastFocusEl = document.activeElement;
    setPatientStep('describe', { force: true });
  }

  function goReview() {
    pushToFormAndStore();
    lastFocusEl = document.activeElement;
    setPatientStep('review');
  }

  function goLocate() {
    setSimpleView('map');
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
      if (!activeHasLocations()) {
        toast('Tap the body to mark where it hurts, then save.', 'warning');
        return null;
      }

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
        confirm.textContent = 'Pain map saved.';
      }
      toast('Pain map saved.', 'success');
      setPatientStep('locate', { force: true });
      try {
        var store = getStore();
        if (store && typeof store.ensureActiveEntry === 'function') {
          store.ensureActiveEntry('adult-male');
        }
        pullFromStoreToPatientUI();
        refreshMarkColors();
        updateLocationChrome();
      } catch (e) { /* ignore */ }
      return saved;
    } finally {
      saving = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        if (typeof saveBtn.removeAttribute === 'function') saveBtn.removeAttribute('aria-busy');
        saveBtn.textContent = 'Save pain map';
      }
    }
  }

  function refreshPatientFlow() {
    updateStepChrome();
    if (isPatientShell() && simpleView === 'map') buildDescribeUI();
  }

  function on(id, event, handler, capture) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(event, handler, !!capture);
  }

  function closeMoreMenu() {
    var menu = document.getElementById('simpleMoreMenu');
    var btn = document.getElementById('btnSimpleMore');
    if (menu) {
      menu.setAttribute('hidden', '');
      menu.classList.remove('open');
    }
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function initPatientFlow() {
    var st = getState();
    if (st) st.patientStep = 'locate';
    setSimpleView('map');
    updateStepChrome();
    buildDescribeUI();

    // Prefer Point tool for simple map
    placePatientDrawerChrome();
    activatePatientTool('point');
    setAssessStep('mark', { skipExpand: true });
    bindMapIntensityUI();

    // Keep summary + mark colors in sync as the patient taps the body.
    try {
      var stEngine = getState() && getState().engine;
      if (stEngine && typeof stEngine.on === 'function') {
        stEngine.on('regionplaced', function () {
          updateLocationChrome();
          refreshMarkColors();
          syncAnatomyLayout();
        });
        stEngine.on('regionchanged', function () {
          updateLocationChrome();
          refreshMarkColors();
        });
      }
    } catch (e) { /* ignore */ }

    on('btnPatientNextDescribe', 'click', goDescribe);
    on('btnPatientToReview', 'click', goReview);
    on('btnPatientDescribeReview', 'click', goReview);
    on('btnPatientBackLocate', 'click', goLocate);
    on('btnPatientBackDescribe', 'click', goDescribe);
    on('btnPatientEditLocation', 'click', goLocate);
    on('btnPatientEditDescribe', 'click', goDescribe);
    on('btnPatientSave', 'click', function () { void savePatientEntry(); });

    on('btnAssessNext', 'click', function () {
      if (assessStep === 'describe') {
        setAssessStep('mark');
        setDrawerExpanded(true);
      } else {
        setAssessStep('describe', { forceExpand: true });
      }
    });
    on('btnAssessBack', 'click', function () {
      setAssessStep('mark');
    });

    var assessNav = document.getElementById('simpleAssessNav');
    if (assessNav) {
      assessNav.addEventListener('click', function (e) {
        var tab = e.target && e.target.closest ? e.target.closest('[data-assess-step]') : null;
        if (!tab) return;
        setAssessStep(tab.getAttribute('data-assess-step'));
      });
    }

    var drawerGrab = document.getElementById('simpleDrawerGrab');
    if (drawerGrab) {
      drawerGrab.addEventListener('click', function () {
        setDrawerExpanded(!document.body.classList.contains('simple-drawer-expanded'));
      });
    }

    // Start collapsed so the figure is full-screen; green up-arrow opens the tool drawer.
    setDrawerExpanded(false);
    refreshPatientIcons();

    // Keep Recovery Timeline inside the patient workspace (regular scroll view).
    try {
      var timeline = document.getElementById('timelinePanel');
      var workspace = document.getElementById('simplePainWorkspace');
      if (timeline && workspace && timeline.parentElement !== workspace) {
        workspace.appendChild(timeline);
      }
    } catch (e) { /* ignore */ }

    on('btnSimplePainMap', 'click', function () { setSimpleView('map'); });
    on('btnSimpleHistory', 'click', function () { setSimpleView('history'); });
    on('btnSimpleShare', 'click', function () {
      if (typeof global.openShareModal === 'function') global.openShareModal();
      else if (typeof openShareModal === 'function') openShareModal();
      else if (typeof global.openExportModal === 'function') global.openExportModal();
      else if (typeof openExportModal === 'function') openExportModal();
      else {
        var exportBtn = document.getElementById('btnExport');
        if (exportBtn) exportBtn.click();
      }
    });
    on('btnSimpleMore', 'click', function (e) {
      e.stopPropagation();
      var menu = document.getElementById('simpleMoreMenu');
      var btn = document.getElementById('btnSimpleMore');
      if (!menu) return;
      var open = menu.hasAttribute('hidden');
      if (open) {
        menu.removeAttribute('hidden');
        menu.classList.add('open');
      } else {
        menu.setAttribute('hidden', '');
        menu.classList.remove('open');
      }
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    on('btnSimpleImport', 'click', function () {
      closeMoreMenu();
      var importBtn = document.getElementById('btnImport');
      if (importBtn) importBtn.click();
      else if (typeof global.openImportSessionPicker === 'function') global.openImportSessionPicker();
    });
    on('btnSimpleExport', 'click', function () {
      closeMoreMenu();
      if (typeof global.openExportModal === 'function') global.openExportModal();
      else {
        var exportBtn = document.getElementById('btnExport');
        if (exportBtn) exportBtn.click();
      }
    });
    on('btnSimpleHelp', 'click', function () {
      closeMoreMenu();
      var help = document.getElementById('btnHelpMenu');
      if (help) help.click();
    });
    on('btnSimpleTheme', 'click', function () {
      closeMoreMenu();
      if (typeof global.toggleTheme === 'function') global.toggleTheme();
      else if (typeof toggleTheme === 'function') toggleTheme();
    });
    on('btnSimpleFeedback', 'click', function () {
      closeMoreMenu();
      var fb = document.getElementById('btnFeedback');
      if (fb) fb.click();
    });

    document.addEventListener('click', function (e) {
      var wrap = document.querySelector('.simple-more-wrap');
      if (!wrap || wrap.contains(e.target)) return;
      closeMoreMenu();
    });

    var liveStore = getStore();
    if (liveStore && typeof liveStore.onChange === 'function') {
      liveStore.onChange(function () {
        if (!isPatientShell()) return;
        updateStepChrome();
        updateLocationChrome();
      });
    }

    var simpleViewBar = document.getElementById('simpleViewBar');
    if (simpleViewBar) {
      simpleViewBar.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-view]') : null;
        if (!btn) return;
        var view = btn.getAttribute('data-view');
        simpleViewBar.querySelectorAll('[data-view]').forEach(function (el) {
          el.classList.toggle('is-active', el === btn);
        });
        if (typeof global.setBodyView === 'function') global.setBodyView(view);
        else if (typeof setBodyView === 'function') setBodyView(view);
        requestAnimationFrame(function () {
          syncAnatomyLayout();
          refreshPatientIcons();
        });
      });
    }

    document.addEventListener('presentationchange', function () {
      placePatientDrawerChrome();
      if (isPatientShell()) {
        setSimpleView('map');
        setPatientStep('locate', { force: true });
        setAssessStep('mark', { skipExpand: true });
      } else {
        refreshPatientFlow();
      }
    });
  }

  global.setPatientStep = setPatientStep;
  global.refreshPatientFlow = refreshPatientFlow;
  global.initPatientFlow = initPatientFlow;
  global.savePatientEntry = savePatientEntry;
  global.setSimplePainView = setSimpleView;
  global.setAssessStep = setAssessStep;
  global.PatientSteps = PatientSteps;
  global.__patientDescribe = {
    QUALITY_CHIPS: QUALITY_CHIPS,
    PRIMARY_QUALITY: PRIMARY_QUALITY,
    MORE_QUALITY: MORE_QUALITY,
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
