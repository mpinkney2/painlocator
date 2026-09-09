/**
 * Shared UI chrome guards — prevent anatomy mark placement while menus,
 * dialogs, sheets, or walkthrough overlays are open.
 */
(function (global) {
  'use strict';

  function isPresentationMenuOpen() {
    const menu = document.getElementById('presentationMenu');
    if (!menu) return false;
    return menu.classList.contains('open') || !menu.hasAttribute('hidden');
  }

  function isPatientSheetOpen() {
    const sheet = document.getElementById('patientSheet');
    const backdrop = document.getElementById('patientSheetBackdrop');
    if (sheet && !sheet.hasAttribute('hidden')) return true;
    if (backdrop && !backdrop.hasAttribute('hidden')) return true;
    return false;
  }

  function isWalkthroughActive() {
    const card = document.getElementById('walkthroughCard');
    if (card && !card.hasAttribute('hidden') && card.style.display !== 'none') return true;
    const spotlight = document.getElementById('walkthroughSpotlight');
    if (spotlight && !spotlight.hasAttribute('hidden') && spotlight.style.display !== 'none') return true;
    return false;
  }

  function isMarkerContextMenuOpen() {
    const menu = document.getElementById('markerContextMenu');
    return !!(menu && !menu.hidden);
  }

  /** True when chrome should block body-map mark placement. */
  function isUiChromeBlockingMarks() {
    if (document.querySelector('dialog[open]')) return true;
    if (isPresentationMenuOpen()) return true;
    if (isPatientSheetOpen()) return true;
    if (isWalkthroughActive()) return true;
    if (isMarkerContextMenuOpen()) return true;
    return false;
  }

  function closePresentationMenu() {
    const menu = document.getElementById('presentationMenu');
    const toggle = document.getElementById('btnPresentationMenu');
    if (!menu) return false;
    const wasOpen = isPresentationMenuOpen();
    menu.setAttribute('hidden', '');
    menu.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
    return wasOpen;
  }

  function closeOpenDialogs() {
    let closed = false;
    document.querySelectorAll('dialog[open]').forEach((d) => {
      try {
        d.close();
        closed = true;
      } catch (_) { /* ignore */ }
    });
    return closed;
  }

  /**
   * Close transient chrome (menus/dialogs). Returns true if anything closed.
   * Does not discard patient describe/review sheets — those need explicit Back.
   */
  function dismissTransientChrome() {
    let closed = closePresentationMenu();
    if (isMarkerContextMenuOpen()) {
      const menu = document.getElementById('markerContextMenu');
      if (menu) menu.hidden = true;
      if (typeof state !== 'undefined') state.contextMenuRegionId = null;
      closed = true;
    }
    if (closeOpenDialogs()) closed = true;
    return closed;
  }

  global.UiChrome = {
    isUiChromeBlockingMarks,
    isPresentationMenuOpen,
    isPatientSheetOpen,
    isWalkthroughActive,
    closePresentationMenu,
    dismissTransientChrome
  };
})(typeof window !== 'undefined' ? window : globalThis);
