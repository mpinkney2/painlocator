/**
 * First-use welcome / onboarding and first-use anatomy tip.
 */
(function initOnboarding() {
  const WELCOME_DISMISSED_KEY = 'painlocator_welcome_dismissed';
  const FIRST_TIP_KEY = 'painlocator_anatomy_tip_dismissed';

  function hasUserData() {
    return Boolean(entryStore?.entries?.length || (entryStore?.draftEntry?.regions?.length));
  }

  function ensureWelcome() {
    let el = document.getElementById('welcomeOverlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'welcomeOverlay';
    el.className = 'welcome-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'welcomeTitle');
    el.innerHTML = `
      <div class="welcome-card">
        <p class="welcome-brand"><span class="brand-pain">Pain</span><span class="brand-locator">Locator</span></p>
        <h2 id="welcomeTitle">Record where pain occurs, track how it changes, and share a clear summary with your clinician.</h2>
        <p class="welcome-sub">Your entries stay on this device unless you export or share them.</p>
        <div class="welcome-actions">
          <button type="button" class="btn btn-primary" id="welcomeStart">Start a pain entry</button>
          <button type="button" class="btn btn-secondary" id="welcomeDemo">Try the demo</button>
          <button type="button" class="btn btn-ghost" id="welcomeImport">Import existing data</button>
          <button type="button" class="btn btn-ghost" id="welcomeLearn">Learn how it works</button>
        </div>
        <p class="welcome-safety">PainLocator is not for emergencies. Seek immediate medical care for severe or sudden symptoms.</p>
      </div>`;
    document.body.appendChild(el);

    document.getElementById('welcomeStart').addEventListener('click', () => {
      dismissWelcome();
      startNewEntry?.();
      applyWorkflowMode?.('capture');
      showAnatomyTip(true);
    });
    document.getElementById('welcomeDemo').addEventListener('click', () => {
      dismissWelcome();
      demoMode?.enter({ startWalkthrough: true });
    });
    document.getElementById('welcomeImport').addEventListener('click', () => {
      dismissWelcome();
      openImportSessionPicker?.();
    });
    document.getElementById('welcomeLearn').addEventListener('click', () => {
      dismissWelcome();
      walkthrough?.start();
    });
    return el;
  }

  function dismissWelcome() {
    try { localStorage.setItem(WELCOME_DISMISSED_KEY, '1'); } catch { /* ignore */ }
    const el = document.getElementById('welcomeOverlay');
    if (el) el.hidden = true;
  }

  function maybeShowWelcome() {
    if (demoMode?.isActive?.()) return;
    if (hasUserData()) return;
    try {
      if (localStorage.getItem(WELCOME_DISMISSED_KEY) === '1') return;
    } catch { /* ignore */ }
    const el = ensureWelcome();
    el.hidden = false;
  }

  function ensureAnatomyTip() {
    let tip = document.getElementById('anatomyFirstTip');
    if (tip) return tip;
    tip = document.createElement('div');
    tip.id = 'anatomyFirstTip';
    tip.className = 'anatomy-first-tip';
    tip.setAttribute('role', 'status');
    tip.innerHTML = `
      <p>Choose a tool, mark where you feel pain, then describe the intensity and symptoms.</p>
      <button type="button" class="tip-dismiss" id="anatomyTipDismiss" aria-label="Dismiss tip">Got it</button>`;
    const wrap = document.getElementById('avatarWrap') || document.getElementById('avatarStage')?.parentElement;
    wrap?.appendChild(tip);
    document.getElementById('anatomyTipDismiss')?.addEventListener('click', () => {
      try { localStorage.setItem(FIRST_TIP_KEY, '1'); } catch { /* ignore */ }
      tip.hidden = true;
    });
    return tip;
  }

  function showAnatomyTip(force = false) {
    try {
      if (!force && localStorage.getItem(FIRST_TIP_KEY) === '1') return;
    } catch { /* ignore */ }
    if (hasUserData() && !force) return;
    const tip = ensureAnatomyTip();
    tip.hidden = false;
  }

  function hideAnatomyTip() {
    const tip = document.getElementById('anatomyFirstTip');
    if (tip) tip.hidden = true;
  }

  window.maybeShowWelcome = maybeShowWelcome;
  window.showAnatomyTip = showAnatomyTip;
  window.hideAnatomyTip = hideAnatomyTip;
  window.dismissWelcome = dismissWelcome;
})();
