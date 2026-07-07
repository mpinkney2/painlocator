/**
 * Environment detection for dev vs production (Vercel).
 */
(function initEnv() {
  const hostname = window.location.hostname;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '' ||
    window.location.protocol === 'file:';

  window.PAINLOCATOR_IS_PRODUCTION = !isLocal;
})();
