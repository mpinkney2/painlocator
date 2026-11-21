/**
 * Optional 0–10 pain level control with one original neutral face.
 * The face is a simple indicator: mouth and brows shift slightly with the number.
 * Intensity color stays on the slider. This does not replace the body map.
 */
(function (global) {
  'use strict';

  var LEVEL_LABELS = [
    'No pain',
    'Mild',
    'Mild',
    'Mild',
    'Moderate',
    'Moderate',
    'Moderate',
    'Severe',
    'Severe',
    'Severe',
    'Worst pain imaginable'
  ];

  function clampIntensity(value) {
    var n = Math.round(Number(value));
    if (!isFinite(n)) n = 0;
    return Math.max(0, Math.min(10, n));
  }

  function painColor(n) {
    var colors = (typeof PAIN_COLORS !== 'undefined' && PAIN_COLORS) ||
      (global.PAIN_COLORS) ||
      null;
    return (colors && colors[n]) || '#f59e0b';
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function levelText(n) {
    return LEVEL_LABELS[n] || LEVEL_LABELS[0];
  }

  /** Straight mouth at 0. Higher levels dip the center a few pixels. */
  function mouthPath(t) {
    var edge = 86;
    var mid = lerp(86, 93, t);
    return 'M 48 ' + edge.toFixed(1) +
      ' C 60 ' + mid.toFixed(1) + ', 80 ' + mid.toFixed(1) + ', 92 ' + edge.toFixed(1);
  }

  /** Level brows that tip a few pixels as the number rises. */
  function browPath(side, t) {
    var outer = lerp(54, 52.5, t);
    var inner = lerp(54, 57, t);
    if (side === 'left') {
      return 'M 40 ' + outer.toFixed(1) + ' L 58 ' + inner.toFixed(1);
    }
    return 'M 82 ' + inner.toFixed(1) + ' L 100 ' + outer.toFixed(1);
  }

  function updateFacesFace(intensity) {
    var n = clampIntensity(intensity);
    var t = n / 10;
    var mouth = document.getElementById('facesPainMouth');
    var browL = document.getElementById('facesPainBrowL');
    var browR = document.getElementById('facesPainBrowR');
    var label = document.getElementById('facesPainLabel');
    var valueEl = document.getElementById('facesPainValue');
    var accent = painColor(n);
    var text = levelText(n);

    if (mouth) mouth.setAttribute('d', mouthPath(t));
    if (browL) browL.setAttribute('d', browPath('left', t));
    if (browR) browR.setAttribute('d', browPath('right', t));
    if (label) label.textContent = text;
    if (valueEl) {
      valueEl.textContent = String(n);
      valueEl.style.color = accent;
    }
    var slider = document.getElementById('facesIntensitySlider');
    if (slider) {
      slider.style.setProperty('--spm-intensity-accent', accent);
      slider.setAttribute('aria-valuenow', String(n));
      slider.setAttribute('aria-valuetext', text + ', ' + n + ' out of 10');
    }
  }

  function syncFacesFromMap() {
    var mapSlider = document.getElementById('patientIntensitySlider');
    var facesSlider = document.getElementById('facesIntensitySlider');
    var n = mapSlider ? clampIntensity(mapSlider.value) : 5;
    if (facesSlider) facesSlider.value = String(n);
    updateFacesFace(n);
    var status = document.getElementById('facesPainStatus');
    if (status) {
      status.textContent = '';
      status.hidden = true;
    }
  }

  function openFacesScale() {
    syncFacesFromMap();
    var modal = document.getElementById('simpleFacesModal');
    if (modal && typeof modal.showModal === 'function' && !modal.open) {
      modal.showModal();
    }
  }

  function closeFacesScale() {
    var modal = document.getElementById('simpleFacesModal');
    if (modal && typeof modal.close === 'function' && modal.open) modal.close();
  }

  function saveFacesIntensity() {
    var facesSlider = document.getElementById('facesIntensitySlider');
    var n = clampIntensity(facesSlider ? facesSlider.value : 0);
    if (typeof global.applyIntensityValue === 'function') {
      global.applyIntensityValue(n);
    } else if (typeof applyIntensityValue === 'function') {
      applyIntensityValue(n);
    } else {
      var mapSlider = document.getElementById('patientIntensitySlider');
      if (mapSlider) mapSlider.value = String(n);
      try {
        var store = global.PainEntryStore || (global.state && global.state.store);
        if (store && typeof store.updateActiveEntry === 'function') {
          store.updateActiveEntry({ intensity: n });
        }
      } catch (e) { /* ignore */ }
    }
    var status = document.getElementById('facesPainStatus');
    if (status) {
      status.hidden = false;
      status.textContent = 'Saved for your doctor — pain level ' + n + ' / 10.';
    }
    setTimeout(function () {
      closeFacesScale();
    }, 700);
  }

  function bindFacesPainScale() {
    var facesSlider = document.getElementById('facesIntensitySlider');
    if (facesSlider && !facesSlider.dataset.facesBound) {
      facesSlider.dataset.facesBound = '1';
      facesSlider.addEventListener('input', function () {
        updateFacesFace(facesSlider.value);
      });
      facesSlider.addEventListener('change', function () {
        updateFacesFace(facesSlider.value);
      });
    }
    var saveBtn = document.getElementById('btnFacesSave');
    if (saveBtn && !saveBtn.dataset.facesBound) {
      saveBtn.dataset.facesBound = '1';
      saveBtn.addEventListener('click', function () {
        saveFacesIntensity();
      });
    }
    var cancelBtn = document.getElementById('btnFacesCancel');
    if (cancelBtn && !cancelBtn.dataset.facesBound) {
      cancelBtn.dataset.facesBound = '1';
      cancelBtn.addEventListener('click', function () {
        closeFacesScale();
      });
    }
    var openBtns = document.querySelectorAll('[data-open-faces-scale]');
    openBtns.forEach(function (btn) {
      if (btn.dataset.facesBound) return;
      btn.dataset.facesBound = '1';
      btn.addEventListener('click', function () {
        if (typeof global.closeMoreMenu === 'function') global.closeMoreMenu();
        else {
          var more = document.getElementById('simpleMoreModal');
          if (more && more.open && typeof more.close === 'function') more.close();
        }
        var open = function () { openFacesScale(); };
        if (typeof queueMicrotask === 'function') queueMicrotask(open);
        else setTimeout(open, 0);
      });
    });
    updateFacesFace(facesSlider ? facesSlider.value : 5);
  }

  global.FacesPainScale = {
    bind: bindFacesPainScale,
    open: openFacesScale,
    close: closeFacesScale,
    update: updateFacesFace,
    labels: LEVEL_LABELS
  };
})(typeof window !== 'undefined' ? window : globalThis);
