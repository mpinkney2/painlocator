/**
 * Optional Faces pain scale — classic office-chart idea as one interactive face.
 * Does not replace the body map; writes the same 0–10 intensity the clinician already sees.
 */
(function (global) {
  'use strict';

  var FACE_LABELS = [
    'Feels good — no pain',
    'Almost fine — tiny twinge',
    'Hurts a little',
    'Hurts a little more',
    'Hurts more',
    'Hurts quite a bit',
    'Hurts even more',
    'Hurts a lot',
    'Hurts badly',
    'Hurts terribly',
    'Unmentionable pain'
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

  /** Soft face fill: tint toward pain color as intensity rises. */
  function faceFill(n) {
    var t = n / 10;
    // Calm cream → intense wash of the pain hue
    var r = Math.round(255 - t * 40);
    var g = Math.round(248 - t * (248 - 80));
    var b = Math.round(236 - t * (236 - 90));
    if (n >= 7) {
      r = Math.min(255, r + 20);
      g = Math.max(40, g - 30);
      b = Math.max(40, b - 20);
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function mouthPath(t) {
    // t 0 = smile, 1 = deep frown
    var leftY = lerp(78, 92, t);
    var rightY = lerp(78, 92, t);
    var midY = lerp(92, 68, t);
    var c1y = lerp(100, 58, t);
    var c2y = lerp(100, 58, t);
    return 'M 42 ' + leftY.toFixed(1) +
      ' C 55 ' + c1y.toFixed(1) + ', 85 ' + c2y.toFixed(1) + ', 98 ' + rightY.toFixed(1);
  }

  function browPath(side, t) {
    // Neutral → angled distress
    var lift = lerp(0, 6, t);
    var tilt = lerp(0, 8, t);
    if (side === 'left') {
      return 'M 38 ' + (48 + lift).toFixed(1) + ' L 58 ' + (46 - tilt).toFixed(1);
    }
    return 'M 82 ' + (46 - tilt).toFixed(1) + ' L 102 ' + (48 + lift).toFixed(1);
  }

  function eyeOpen(t) {
    // Happier: slightly squinted happy; mid: round; high: wider distressed
    return lerp(4.2, 6.5, t);
  }

  function updateFacesFace(intensity) {
    var n = clampIntensity(intensity);
    var t = n / 10;
    var svg = document.getElementById('facesPainSvg');
    var face = document.getElementById('facesPainHead');
    var mouth = document.getElementById('facesPainMouth');
    var browL = document.getElementById('facesPainBrowL');
    var browR = document.getElementById('facesPainBrowR');
    var eyeL = document.getElementById('facesPainEyeL');
    var eyeR = document.getElementById('facesPainEyeR');
    var tearL = document.getElementById('facesPainTearL');
    var tearR = document.getElementById('facesPainTearR');
    var cheekL = document.getElementById('facesPainCheekL');
    var cheekR = document.getElementById('facesPainCheekR');
    var ring = document.getElementById('facesPainRing');
    var label = document.getElementById('facesPainLabel');
    var valueEl = document.getElementById('facesPainValue');
    var accent = painColor(n);

    if (face) {
      face.setAttribute('fill', faceFill(n));
      face.setAttribute('stroke', accent);
    }
    if (ring) {
      ring.setAttribute('stroke', accent);
      ring.style.opacity = String(0.25 + t * 0.55);
    }
    if (mouth) {
      mouth.setAttribute('d', mouthPath(t));
      mouth.setAttribute('stroke', n >= 6 ? '#7f1d1d' : '#1e293b');
    }
    if (browL) browL.setAttribute('d', browPath('left', t));
    if (browR) browR.setAttribute('d', browPath('right', t));
    var r = eyeOpen(t);
    if (eyeL) {
      eyeL.setAttribute('ry', r.toFixed(1));
      eyeL.setAttribute('fill', n >= 8 ? '#1e293b' : '#0f172a');
    }
    if (eyeR) {
      eyeR.setAttribute('ry', r.toFixed(1));
      eyeR.setAttribute('fill', n >= 8 ? '#1e293b' : '#0f172a');
    }
    // Tears from ~7 upward
    var tearOpacity = n < 7 ? 0 : Math.min(1, (n - 6) / 4);
    if (tearL) tearL.style.opacity = String(tearOpacity);
    if (tearR) tearR.style.opacity = String(tearOpacity);
    // Soft cheeks fade as pain rises
    var cheekOpacity = Math.max(0, 0.45 - t * 0.45);
    if (cheekL) cheekL.style.opacity = String(cheekOpacity);
    if (cheekR) cheekR.style.opacity = String(cheekOpacity);
    if (label) label.textContent = FACE_LABELS[n] || FACE_LABELS[0];
    if (valueEl) {
      valueEl.textContent = String(n);
      valueEl.style.color = accent;
    }
    if (svg) svg.style.setProperty('--faces-accent', accent);
    var slider = document.getElementById('facesIntensitySlider');
    if (slider) {
      slider.style.setProperty('--spm-intensity-accent', accent);
      slider.setAttribute('aria-valuenow', String(n));
      slider.setAttribute('aria-valuetext', FACE_LABELS[n] + ', ' + n + ' out of 10');
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
      // Fallback: write store + sync map slider directly
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
      status.textContent = 'Saved for your doctor — intensity ' + n + ' / 10.';
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
        // Allow More dialog to close before opening Faces
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
    labels: FACE_LABELS
  };
})(typeof window !== 'undefined' ? window : globalThis);
