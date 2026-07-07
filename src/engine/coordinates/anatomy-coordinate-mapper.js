class AnatomyCoordinateMapper {
  constructor(frameEl, imageEl) {
    this.frameEl = frameEl;
    this.imageEl = imageEl;
  }

  setElements(frameEl, imageEl) {
    this.frameEl = frameEl;
    this.imageEl = imageEl;
  }

  getImageBounds() {
    const container = this.frameEl?.parentElement;
    const frameW = container?.clientWidth || 1;
    const frameH = container?.clientHeight || 1;
    const img = this.imageEl;
    const naturalW = img?.naturalWidth || 1;
    const naturalH = img?.naturalHeight || 1;
    const scale = Math.min(frameW / naturalW, frameH / naturalH);
    const displayW = naturalW * scale;
    const displayH = naturalH * scale;
    return {
      left: (frameW - displayW) / 2,
      top: (frameH - displayH) / 2,
      width: displayW,
      height: displayH,
      scale
    };
  }

  syncFrameToImage() {
    if (!this.frameEl) return;
    const b = this.getImageBounds();
    this.frameEl.style.width = `${b.width}px`;
    this.frameEl.style.height = `${b.height}px`;
    this.frameEl.style.left = `${b.left}px`;
    this.frameEl.style.top = `${b.top}px`;
  }

  clientToNormalized(clientX, clientY) {
    const rect = this.frameEl.getBoundingClientRect();
    const x = (clientX - rect.left) / (rect.width || 1);
    const y = (clientY - rect.top) / (rect.height || 1);
    return { x: clamp01(x), y: clamp01(y) };
  }

  isInsideImage(clientX, clientY) {
    const n = this.clientToNormalized(clientX, clientY);
    return n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1;
  }
}

window.AnatomyCoordinateMapper = AnatomyCoordinateMapper;
