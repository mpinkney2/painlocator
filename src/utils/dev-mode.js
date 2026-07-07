/**
 * DEV_MODE enables CAE renderer debug overlay.
 * Production (Vercel): always false, even with ?dev=1.
 * Local development: enable with ?dev=1
 */
(function initDevMode() {
  const params = new URLSearchParams(window.location.search);
  const devParam = params.get('dev');
  const isProduction = window.PAINLOCATOR_IS_PRODUCTION === true;

  window.DEV_MODE = !isProduction && (devParam === '1' || devParam === 'true');

  if (window.DEV_MODE) {
    document.documentElement.classList.add('dev-mode');
  }
})();
