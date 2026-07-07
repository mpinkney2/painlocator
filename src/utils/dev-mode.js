/**
 * Production builds must keep DEV_MODE false.
 * Enable locally with ?dev=1 in the URL.
 */
(function initDevMode() {
  const params = new URLSearchParams(window.location.search);
  const devParam = params.get('dev');
  window.DEV_MODE = devParam === '1' || devParam === 'true';
  if (window.DEV_MODE) {
    document.documentElement.classList.add('dev-mode');
  }
})();
