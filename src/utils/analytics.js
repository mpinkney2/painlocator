/**
 * Privacy-conscious analytics abstraction.
 * Disabled by default unless window.PAINLOCATOR_ANALYTICS_ENDPOINT
 * or localStorage painlocator_analytics_enabled === '1'.
 * Never includes PHI, pain values, symptoms, notes, or regions.
 */
(function initAnalytics() {
  const ENABLED_KEY = 'painlocator_analytics_enabled';
  const ALLOWED = new Set([
    'demo_started',
    'demo_completed',
    'demo_reset',
    'scenario_selected',
    'entry_saved',
    'report_opened',
    'report_exported',
    'feedback_form_opened',
    'feedback_submitted',
    'walkthrough_skipped',
    'walkthrough_completed',
    'walkthrough_started'
  ]);

  function isEnabled() {
    if (window.PAINLOCATOR_ANALYTICS_FORCE_OFF) return false;
    if (localStorage.getItem(ENABLED_KEY) === '1') return true;
    return Boolean(window.PAINLOCATOR_ANALYTICS_ENDPOINT);
  }

  function trackEvent(name, props = {}) {
    if (!ALLOWED.has(name) || !isEnabled()) return;
    const payload = {
      event: name,
      ts: new Date().toISOString(),
      appVersion: window.PAINLOCATOR_APP_VERSION || '5.4.0',
      demoMode: Boolean(window.demoMode?.isActive?.()),
      // Explicitly strip any accidental sensitive keys
      props: Object.fromEntries(
        Object.entries(props || {}).filter(([k]) =>
          !/pain|symptom|note|region|patient|intensity|trigger|diagnos/i.test(k)
        )
      )
    };
    const endpoint = window.PAINLOCATOR_ANALYTICS_ENDPOINT;
    if (endpoint) {
      try {
        navigator.sendBeacon?.(endpoint, JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    } else if (!window.PAINLOCATOR_IS_PRODUCTION) {
      console.debug('[analytics]', payload.event);
    }
  }

  window.analyticsService = { trackEvent, isEnabled, ALLOWED };
  window.trackEvent = trackEvent;
})();
