/**
 * Feedback service abstraction.
 * Production: POST to Vercel /api/feedback or PAINLOCATOR_FEEDBACK_ENDPOINT.
 * Fallback: download / copy structured JSON when no endpoint is available.
 */
(function initFeedbackService() {
  const RATE_LIMIT_MS = 60_000;
  const MAX_PAYLOAD_CHARS = 12_000;
  let lastSubmitAt = 0;
  let inFlight = false;
  let lastPayloadHash = '';

  function sanitizeText(value, max = 2000) {
    return String(value || '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .trim()
      .slice(0, max);
  }

  function collectDiagnostics(includeDiagnostics) {
    if (!includeDiagnostics) return null;
    const dm = window.demoMode;
    const demoActive = dm && typeof dm.isActive === 'function' ? Boolean(dm.isActive()) : false;
    return {
      route: (typeof location !== 'undefined' ? location.pathname + location.hash : '/'),
      appVersion: window.PAINLOCATOR_APP_VERSION || '5.4.0',
      userAgent: (navigator.userAgent || '').slice(0, 240),
      platform: navigator.platform || '',
      language: navigator.language || '',
      viewport: { w: window.innerWidth || 0, h: window.innerHeight || 0 },
      demoMode: demoActive,
      lastAction: window.__painlocatorLastAction || null,
      errorId: window.__painlocatorLastErrorId || null
      // Intentionally omits notes, names, regions, intensities, report content
    };
  }

  function validateFeedback(raw) {
    const errors = [];
    const types = ['general', 'bug', 'feature', 'clinical', 'accessibility', 'demo'];
    const roles = [
      'patient', 'caregiver', 'physician', 'nurse', 'physical_therapist',
      'other_clinician', 'researcher', 'product_evaluator', 'other', ''
    ];
    const type = types.includes(raw.type) ? raw.type : 'general';
    const rating = Number(raw.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      errors.push('Please choose a rating from 1 to 5.');
    }
    const payload = {
      type,
      rating,
      tryingToDo: sanitizeText(raw.tryingToDo, 1500),
      workedWell: sanitizeText(raw.workedWell, 1500),
      confusing: sanitizeText(raw.confusing, 1500),
      improve: sanitizeText(raw.improve, 1500),
      email: sanitizeText(raw.email, 200),
      role: roles.includes(raw.role) ? raw.role : 'other',
      canContact: Boolean(raw.canContact),
      interviewOptIn: Boolean(raw.interviewOptIn),
      diagnostics: collectDiagnostics(raw.type === 'bug' || raw.includeDiagnostics),
      createdAt: new Date().toISOString(),
      clientReferenceHint: `fb_${Date.now().toString(36)}`
    };
    if (!payload.tryingToDo && !payload.workedWell && !payload.confusing && !payload.improve) {
      errors.push('Please fill in at least one feedback field.');
    }
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      errors.push('Email looks invalid. Leave it blank or correct it.');
    }
    if (payload.canContact && !payload.email) {
      errors.push('Add an email if you allow follow-up contact.');
    }
    const size = JSON.stringify(payload).length;
    if (size > MAX_PAYLOAD_CHARS) errors.push('Feedback is too long. Please shorten your comments.');
    return { ok: !errors.length, errors, payload };
  }

  function hashPayload(payload) {
    return `${payload.type}|${payload.rating}|${payload.tryingToDo}|${payload.improve}|${payload.email}`;
  }

  async function postToEndpoint(payload) {
    const endpoint = window.PAINLOCATOR_FEEDBACK_ENDPOINT || '/api/feedback';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = new Error(`Feedback endpoint returned ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json().catch(() => ({ referenceId: payload.clientReferenceHint }));
  }

  function localFallback(payload) {
    const referenceId = payload.clientReferenceHint;
    const blob = new Blob([JSON.stringify({ ...payload, referenceId }, null, 2)], {
      type: 'application/json'
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `painlocator-feedback-${referenceId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    try {
      navigator.clipboard?.writeText?.(JSON.stringify({ referenceId, ...payload }, null, 2));
    } catch { /* ignore */ }
    return { referenceId, delivery: 'local_download' };
  }

  async function submitFeedback(raw) {
    const { ok, errors, payload } = validateFeedback(raw);
    if (!ok) return { ok: false, errors };

    const now = Date.now();
    if (inFlight) return { ok: false, errors: ['Submission already in progress.'] };
    if (now - lastSubmitAt < RATE_LIMIT_MS) {
      return { ok: false, errors: ['Please wait a minute before sending more feedback.'] };
    }
    const hash = hashPayload(payload);
    if (hash === lastPayloadHash) {
      return { ok: false, errors: ['This feedback was already submitted.'] };
    }

    inFlight = true;
    setSaveStatus?.('saving', 'Sending feedback…');
    try {
      let result;
      try {
        result = await postToEndpoint(payload);
      } catch (err) {
        // Retry once
        try {
          await new Promise(r => setTimeout(r, 400));
          result = await postToEndpoint(payload);
        } catch (err2) {
          result = localFallback(payload);
          setSaveStatus?.('offline', 'Endpoint unavailable — feedback file downloaded');
          showToast?.(
            'Feedback endpoint unavailable. A copy was downloaded so you can send it manually.',
            { type: 'warning', duration: 6000 }
          );
        }
      }
      lastSubmitAt = Date.now();
      lastPayloadHash = hash;
      const referenceId = result.referenceId || payload.clientReferenceHint;
      setSaveStatus?.('feedback', `Feedback sent · ${referenceId}`);
      trackEvent?.('feedback_submitted', { type: payload.type });
      return { ok: true, referenceId, delivery: result.delivery || 'http' };
    } finally {
      inFlight = false;
    }
  }

  window.feedbackService = {
    submitFeedback,
    validateFeedback,
    sanitizeText
  };
})();
