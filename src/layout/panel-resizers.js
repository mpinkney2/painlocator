function initPanelResizers() {
  const root = document.documentElement;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) || "{}"); } catch { /* */ }
  root.style.setProperty("--left-panel-width", `${saved.left || 290}px`);
  root.style.setProperty("--right-panel-width", `${saved.right || 310}px`);

  function setup(handleId, cssVar, min, max, invert) {
    const handle = document.getElementById(handleId);
    if (!handle) return;
    let startX = 0, startW = 0;
    const onMove = (e) => {
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      handle.classList.add("active");
      document.body.classList.add("col-resizing");
      const delta = invert ? startX - clientX : clientX - startX;
      root.style.setProperty(cssVar, `${Math.max(min, Math.min(max, startW + delta))}px`);
      window.dispatchEvent(new Event("resize"));
    };
    const onEnd = () => {
      handle.classList.remove("active");
      document.body.classList.remove("col-resizing");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({
        left: parseInt(getComputedStyle(root).getPropertyValue("--left-panel-width"), 10),
        right: parseInt(getComputedStyle(root).getPropertyValue("--right-panel-width"), 10)
      }));
    };
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startX = e.clientX;
      startW = parseInt(getComputedStyle(root).getPropertyValue(cssVar), 10);
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onEnd);
    });
    handle.addEventListener("touchstart", (e) => {
      e.preventDefault();
      startX = e.touches[0].clientX;
      startW = parseInt(getComputedStyle(root).getPropertyValue(cssVar), 10);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onEnd);
    }, { passive: false });
  }
  setup("leftResizeHandle", "--left-panel-width", 240, 380, false);
  setup("rightResizeHandle", "--right-panel-width", 240, 420, true);
}

window.initPanelResizers = initPanelResizers;

