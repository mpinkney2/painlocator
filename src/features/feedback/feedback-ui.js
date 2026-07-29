/**
 * Feedback form UI — professional, intentional, privacy-aware.
 */
(function initFeedbackUI() {
  function ensureDialog() {
    let dialog = document.getElementById('feedbackModal');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'feedbackModal';
    dialog.className = 'modal feedback-modal';
    dialog.setAttribute('aria-labelledby', 'feedbackModalTitle');
    dialog.innerHTML = `
      <div class="modal-head">
        <h3 id="feedbackModalTitle">Share feedback</h3>
        <button type="button" class="modal-close" data-close aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <p class="modal-note privacy-notice">
          Please do not include medical details, patient names, or other protected health information.
          Feedback helps improve PainLocator product experience only.
        </p>
        <form id="feedbackForm" class="feedback-form" novalidate>
          <fieldset class="feedback-fieldset">
            <legend>Feedback type</legend>
            <div class="pill-grid" id="feedbackTypePills" role="radiogroup" aria-label="Feedback type">
              <button type="button" class="pill active" data-value="general">General</button>
              <button type="button" class="pill" data-value="bug">Bug report</button>
              <button type="button" class="pill" data-value="feature">Feature request</button>
              <button type="button" class="pill" data-value="clinical">Clinical workflow</button>
              <button type="button" class="pill" data-value="accessibility">Accessibility</button>
              <button type="button" class="pill" data-value="demo">Demo</button>
            </div>
            <input type="hidden" name="type" id="feedbackType" value="general">
          </fieldset>

          <label class="meta-field">
            <span>Overall rating</span>
            <div class="rating-row" id="feedbackRating" role="radiogroup" aria-label="Rating 1 to 5">
              ${[1, 2, 3, 4, 5].map(n =>
                `<button type="button" class="rating-btn" data-value="${n}" aria-label="${n} of 5">${n}</button>`
              ).join('')}
            </div>
            <input type="hidden" name="rating" id="feedbackRatingValue" value="">
          </label>

          <label class="meta-field"><span>What were you trying to do?</span>
            <textarea name="tryingToDo" id="feedbackTrying" rows="2" maxlength="1500"></textarea>
          </label>
          <label class="meta-field"><span>What worked well?</span>
            <textarea name="workedWell" id="feedbackWorked" rows="2" maxlength="1500"></textarea>
          </label>
          <label class="meta-field"><span>What was confusing or difficult?</span>
            <textarea name="confusing" id="feedbackConfusing" rows="2" maxlength="1500"></textarea>
          </label>
          <label class="meta-field"><span>What should we improve?</span>
            <textarea name="improve" id="feedbackImprove" rows="2" maxlength="1500"></textarea>
          </label>

          <label class="meta-field"><span>Role (optional)</span>
            <select name="role" id="feedbackRole">
              <option value="">Select…</option>
              <option value="patient">Patient</option>
              <option value="caregiver">Caregiver</option>
              <option value="physician">Physician</option>
              <option value="nurse">Nurse</option>
              <option value="physical_therapist">Physical therapist</option>
              <option value="other_clinician">Other clinician</option>
              <option value="researcher">Researcher</option>
              <option value="product_evaluator">Product evaluator</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label class="meta-field"><span>Email for follow-up (optional)</span>
            <input type="email" name="email" id="feedbackEmail" autocomplete="email" maxlength="200">
          </label>

          <label class="check-option">
            <input type="checkbox" name="canContact" id="feedbackCanContact">
            <span>You may contact me about this feedback</span>
          </label>

          <label class="check-option" id="feedbackDiagLabel" hidden>
            <input type="checkbox" name="includeDiagnostics" id="feedbackDiagnostics" checked>
            <span>Include non-sensitive diagnostics (page, app version, browser, viewport, demo flag)</span>
          </label>

          <p class="feedback-errors" id="feedbackErrors" role="alert" hidden></p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close>Cancel</button>
            <button type="submit" class="btn btn-primary" id="feedbackSubmit">Send feedback</button>
          </div>
        </form>

        <div id="feedbackSuccess" class="feedback-success" hidden>
          <p><strong>Thank you.</strong> Reference: <code id="feedbackRefId"></code></p>
          <label class="check-option">
            <input type="checkbox" id="feedbackInterview">
            <span>Would you be willing to participate in a brief product interview?</span>
          </label>
          <div class="modal-actions">
            <button type="button" class="btn btn-primary" data-close id="feedbackDone">Done</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(dialog);

    dialog.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => dialog.close());
    });

    dialog.querySelectorAll('#feedbackTypePills .pill').forEach(pill => {
      pill.addEventListener('click', () => {
        dialog.querySelectorAll('#feedbackTypePills .pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        document.getElementById('feedbackType').value = pill.dataset.value;
        const diag = document.getElementById('feedbackDiagLabel');
        if (diag) diag.hidden = pill.dataset.value !== 'bug';
      });
    });

    dialog.querySelectorAll('#feedbackRating .rating-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        dialog.querySelectorAll('#feedbackRating .rating-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('feedbackRatingValue').value = btn.dataset.value;
      });
    });

    document.getElementById('feedbackForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('feedbackErrors');
      const submitBtn = document.getElementById('feedbackSubmit');
      const raw = {
        type: document.getElementById('feedbackType').value,
        rating: document.getElementById('feedbackRatingValue').value,
        tryingToDo: document.getElementById('feedbackTrying').value,
        workedWell: document.getElementById('feedbackWorked').value,
        confusing: document.getElementById('feedbackConfusing').value,
        improve: document.getElementById('feedbackImprove').value,
        email: document.getElementById('feedbackEmail').value,
        role: document.getElementById('feedbackRole').value,
        canContact: document.getElementById('feedbackCanContact').checked,
        includeDiagnostics: document.getElementById('feedbackDiagnostics')?.checked
      };
      submitBtn.disabled = true;
      const result = await feedbackService.submitFeedback(raw);
      submitBtn.disabled = false;
      if (!result.ok) {
        errEl.hidden = false;
        errEl.textContent = result.errors.join(' ');
        return;
      }
      errEl.hidden = true;
      document.getElementById('feedbackForm').hidden = true;
      document.getElementById('feedbackSuccess').hidden = false;
      document.getElementById('feedbackRefId').textContent = result.referenceId;
      showToast(`Feedback sent · ${result.referenceId}`, { type: 'success' });
    });

    document.getElementById('feedbackInterview')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        showToast('Thanks — if you shared an email, we may reach out about an interview.', {
          type: 'info',
          duration: 5000
        });
      }
    });

    return dialog;
  }

  function openFeedbackForm(options = {}) {
    const dialog = ensureDialog();
    document.getElementById('feedbackForm').hidden = false;
    document.getElementById('feedbackForm').reset();
    document.getElementById('feedbackSuccess').hidden = true;
    document.getElementById('feedbackErrors').hidden = true;
    document.getElementById('feedbackRatingValue').value = '';
    dialog.querySelectorAll('#feedbackRating .rating-btn').forEach(b => b.classList.remove('active'));
    const type = options.type || 'general';
    document.getElementById('feedbackType').value = type;
    dialog.querySelectorAll('#feedbackTypePills .pill').forEach(p => {
      p.classList.toggle('active', p.dataset.value === type);
    });
    const diag = document.getElementById('feedbackDiagLabel');
    if (diag) diag.hidden = type !== 'bug';
    trackEvent?.('feedback_form_opened', { type });
    dialog.showModal();
  }

  function recordAppAction(name) {
    window.__painlocatorLastAction = { name, at: new Date().toISOString() };
  }

  window.openFeedbackForm = openFeedbackForm;
  window.recordAppAction = recordAppAction;
  window.addEventListener('error', (ev) => {
    window.__painlocatorLastErrorId = `err_${Date.now().toString(36)}`;
  });
})();
