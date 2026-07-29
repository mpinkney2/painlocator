window.showMarkerContextMenu = function(x, y, id) {
  state.contextMenuRegionId = id;
  const menu = document.getElementById('markerContextMenu');
  menu.hidden = false;
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
};

function hideContextMenu() {
  document.getElementById('markerContextMenu').hidden = true;
  state.contextMenuRegionId = null;
}

function initMarkerContextMenu() {
  document.getElementById('markerContextMenu').addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    const id = state.contextMenuRegionId;
    if (!action || !id) return;
    hideContextMenu();
    if (action === 'edit') selectRegionOnly(id);
    if (action === 'duplicate') { entryStore.duplicateRegion(id); refreshUI(); }
    if (action === 'mirror') { entryStore.mirrorRegion(id, useClinicalLabels()); refreshUI(); }
    if (action === 'note') { selectRegionOnly(id); document.getElementById('notesInput').focus(); }
    if (action === 'delete') { entryStore.selectRegion(id); removeSelectedRegions(); }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#markerContextMenu')) hideContextMenu();
  });
}

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'Escape') {
      entryStore.selectedRegionIds = [];
      refreshUI();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (entryStore.selectedRegionIds.length) {
        e.preventDefault();
        removeSelectedRegions();
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (typeof performUndo === 'function') performUndo();
      else { entryStore.undo(); refreshUI(); }
    }
    if ((e.metaKey || e.ctrlKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
      e.preventDefault();
      if (typeof performRedo === 'function') performRedo();
      else { entryStore.redo(); refreshUI(); }
    }
    if (entryStore.selectedRegionIds.length !== 1) return;
    const id = entryStore.selectedRegionIds[0];
    const found = entryStore.findRegion(id);
    if (!found) return;
    const step = e.shiftKey ? 0.01 : 0.003;
    const c = getRegionCenter(found.region);
    if (e.key === 'ArrowLeft') { e.preventDefault(); entryStore.moveRegion(id, Math.max(0, c.x - step), c.y); refreshUI(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); entryStore.moveRegion(id, Math.min(1, c.x + step), c.y); refreshUI(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); entryStore.moveRegion(id, c.x, Math.max(0, c.y - step)); refreshUI(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); entryStore.moveRegion(id, c.x, Math.min(1, c.y + step)); refreshUI(); }
  });
}

// ==========================================================================
// FORM HELPERS
