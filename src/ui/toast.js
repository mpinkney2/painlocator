/**
 * Accessible toast / status notifications (aria-live).
 */
(function initToast() {
  const QUEUE_LIMIT = 4;
  let host = null;
  let saveStatusEl = null;

  function ensureHost() {
    if (host) return host;
    host = document.getElementById('toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      host.className = 'toast-host';
      host.setAttribute('aria-live', 'polite');
      host.setAttribute('aria-relevant', 'additions');
      document.body.appendChild(host);
    }
    return host;
  }

  function showToast(message, options = {}) {
    const {
      type = 'info',
      duration = 4200,
      actionLabel = null,
      onAction = null,
      assertive = false
    } = options;

    const root = ensureHost();
    root.setAttribute('aria-live', assertive ? 'assertive' : 'polite');

    while (root.children.length >= QUEUE_LIMIT) {
      root.firstElementChild?.remove();
    }

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'status');

    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = message;
    el.appendChild(text);

    if (actionLabel && typeof onAction === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action';
      btn.textContent = actionLabel;
      btn.addEventListener('click', () => {
        onAction();
        el.remove();
      });
      el.appendChild(btn);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-dismiss';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '×';
    close.addEventListener('click', () => el.remove());
    el.appendChild(close);

    root.appendChild(el);

    if (duration > 0) {
      window.setTimeout(() => el.remove(), duration);
    }
    return el;
  }

  function setSaveStatus(status, detail = '') {
    saveStatusEl = saveStatusEl || document.getElementById('saveStatus');
    if (!saveStatusEl) return;
    const labels = {
      idle: '',
      new: 'New entry',
      unsaved: 'Unsaved changes',
      saving: 'Saving…',
      saved: 'Saved',
      failed: 'Save failed',
      imported: 'Imported successfully',
      exported: 'Export created',
      report: 'Report ready',
      offline: 'Offline or endpoint unavailable'
    };
    const text = detail || labels[status] || '';
    saveStatusEl.textContent = text;
    saveStatusEl.dataset.status = status;
    saveStatusEl.hidden = !text;
    saveStatusEl.className = `save-status save-status-${status}`;
  }

  window.showToast = showToast;
  window.setSaveStatus = setSaveStatus;
})();
