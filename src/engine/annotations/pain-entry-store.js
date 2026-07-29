class PainEntryStore {
  constructor() {
    this.entries = [];
    this.draftEntry = null;
    this.activeEntryId = null;
    this.selectedRegionIds = [];
    this.activeTool = "circle";
    this.dirty = false;
    this._history = [];
    this._historyIndex = -1;
    this._listeners = [];
    this._undoBuffer = null;
    this._undoTimer = null;
    this._mutating = false;
  }

  onChange(fn) { this._listeners.push(fn); }
  _notify() { this._listeners.forEach(fn => fn(this)); }

  canUndo() { return this._historyIndex > 0; }
  canRedo() { return this._historyIndex >= 0 && this._historyIndex < this._history.length - 1; }

  _snapshot() {
    return JSON.stringify({
      entries: this.entries,
      draftEntry: this.draftEntry,
      activeEntryId: this.activeEntryId,
      selectedRegionIds: this.selectedRegionIds,
      activeTool: this.activeTool
    });
  }

  _restore(snapshot) {
    const data = JSON.parse(snapshot);
    this.entries = data.entries.map(e => createPainEntry(e));
    this.draftEntry = data.draftEntry ? createPainEntry(data.draftEntry) : null;
    this.activeEntryId = data.activeEntryId;
    this.selectedRegionIds = data.selectedRegionIds || data.selectedMarkerIds || [];
    this.activeTool = data.activeTool || "circle";
  }

  _pushHistory() {
    if (this._mutating) return;
    this._history = this._history.slice(0, this._historyIndex + 1);
    this._history.push(this._snapshot());
    if (this._history.length > 50) this._history.shift();
    this._historyIndex = this._history.length - 1;
  }

  beginMutation() {
    if (!this._mutating) {
      this._pushHistory();
      this._mutating = true;
    }
  }

  endMutation({ persist = true } = {}) {
    this._mutating = false;
    this.dirty = true;
    if (persist) this.save();
    this._notify();
  }

  undo() {
    if (!this.canUndo()) return false;
    this._historyIndex--;
    this._restore(this._history[this._historyIndex]);
    this.dirty = false;
    this.save();
    this._notify();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    this._historyIndex++;
    this._restore(this._history[this._historyIndex]);
    this.dirty = false;
    this.save();
    this._notify();
    return true;
  }

  _migrateLocalEnvelope(data) {
    const version = data.schemaVersion || "1.0.0";
    // 1.0.0 → 1.1.0: add schemaVersion; ensure draft null when empty
    if (!data.schemaVersion) data.schemaVersion = "1.1.0";
    if (data.draftEntry && Array.isArray(data.draftEntry.regions) && !data.draftEntry.regions.length
        && !(data.draftEntry.note || (data.draftEntry.quality || []).length)) {
      // keep draft if user was mid-edit with intensity only; still valid
    }
    data.schemaVersion = LOCAL_SCHEMA_VERSION || "1.1.0";
    return data;
  }

  load() {
    try {
      const key = typeof getEntryStorageKey === "function" ? getEntryStorageKey() : ENTRY_STORAGE_KEY;
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = this._migrateLocalEnvelope(JSON.parse(raw));
        this.entries = (data.entries || []).map(e => createPainEntry(e));
        this.draftEntry = data.draftEntry ? createPainEntry(data.draftEntry) : null;
        this.activeEntryId = data.activeEntryId || null;
        this.selectedRegionIds = data.selectedRegionIds || data.selectedMarkerIds || [];
        this.activeTool = data.activeTool || "circle";
        if (data.schemaVersion !== (LOCAL_SCHEMA_VERSION || "1.1.0")) this.save();
      } else if (key === "painlocator_pain_entries" || key.endsWith("pain_entries")) {
        const markersRaw = localStorage.getItem(MARKER_STORAGE_KEY);
        if (markersRaw) {
          this.entries = JSON.parse(markersRaw).map(migrateLegacyMarkerToEntry);
          this.save();
        } else {
          const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            this.entries = JSON.parse(legacy).map(migrateLegacyFlatEntry);
            this.save();
          }
        }
      }
    } catch {
      this.entries = [];
    }
    this.dirty = false;
    this._history = [this._snapshot()];
    this._historyIndex = 0;
    this._notify();
  }

  save() {
    const key = typeof getEntryStorageKey === "function" ? getEntryStorageKey() : ENTRY_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify({
      schemaVersion: LOCAL_SCHEMA_VERSION || "1.1.0",
      entries: this.entries,
      draftEntry: this.draftEntry,
      activeEntryId: this.activeEntryId,
      selectedRegionIds: this.selectedRegionIds,
      activeTool: this.activeTool
    }));
    this.dirty = false;
  }

  setTool(tool) {
    if (!REGION_TOOLS.includes(tool)) return;
    this.activeTool = tool;
    this.save();
    this._notify();
  }

  getActiveEntry() {
    if (this.activeEntryId === DRAFT_KEY) return this.draftEntry;
    if (this.activeEntryId) return this.entries.find(e => e.id === this.activeEntryId) || null;
    return this.draftEntry;
  }

  isDraftActive() {
    return this.activeEntryId === DRAFT_KEY || (!!this.draftEntry && !this.entries.find(e => e.id === this.activeEntryId));
  }

  isEntrySaved(entry) {
    return entry && this.entries.some(e => e.id === entry.id);
  }

  getEntryNumber(entry) {
    const idx = this.entries.findIndex(e => e.id === entry.id);
    if (idx >= 0) return idx + 1;
    if (entry === this.draftEntry) return this.entries.length + 1;
    return 0;
  }

  getAllEntries(patientModel) {
    const model = normalizeModelType(patientModel);
    const saved = this.entries.filter(e => normalizeModelType(e.patientModel) === model);
    if (this.draftEntry && normalizeModelType(this.draftEntry.patientModel) === model && this.draftEntry.regions.length) {
      return [...saved, this.draftEntry];
    }
    return saved;
  }

  hasUnsavedDraft() {
    const d = this.draftEntry;
    if (!d) return false;
    if (d.regions.length) return true;
    if (String(d.note || "").trim()) return true;
    if ((d.quality || []).length || (d.triggers || []).length) return true;
    return false;
  }

  newEntry(patientModel, defaults = {}) {
    this._pushHistory();
    this.draftEntry = createPainEntry({ patientModel: normalizeModelType(patientModel), ...defaults, regions: [] });
    this.activeEntryId = DRAFT_KEY;
    this.selectedRegionIds = [];
    this.dirty = true;
    this.save();
    this._notify();
    return this.draftEntry;
  }

  clearActiveDraft() {
    this.draftEntry = null;
    if (this.activeEntryId === DRAFT_KEY) this.activeEntryId = null;
    this.selectedRegionIds = [];
    this.save();
    this._notify();
  }

  ensureActiveEntry(patientModel, defaults = {}) {
    let entry = this.getActiveEntry();
    const model = normalizeModelType(patientModel);
    if (entry && normalizeModelType(entry.patientModel) !== model && this.isDraftActive()) {
      entry.patientModel = model;
    }
    if (!entry) entry = this.newEntry(patientModel, defaults);
    return entry;
  }

  addRegionToActive(partial, physicianMode = false) {
    this.beginMutation();
    const entry = this.ensureActiveEntry(partial.patientModel);
    if (!this.activeEntryId) this.activeEntryId = entry === this.draftEntry ? DRAFT_KEY : entry.id;
    const mapped = partial.regionId ? partial : {
      ...partial,
      ...mapAnatomyAt(partial.view, getRegionCenter(partial).x, getRegionCenter(partial).y, partial.anatomyLayer, physicianMode)
    };
    const region = createPainRegion({ ...mapped, entryId: entry.id });
    entry.regions.push(region);
    this.selectedRegionIds = [region.id];
    entry.updatedAt = new Date().toISOString();
    this.endMutation();
    return region;
  }

  createPointRegion(patientModel, view, x, y, anatomyLayer, physicianMode) {
    const intensity = this.getActiveEntry()?.intensity ?? 5;
    const r = 0.008 + intensity * 0.0015;
    const mapped = mapAnatomyAt(view, x, y, anatomyLayer, physicianMode);
    return this.addRegionToActive({
      patientModel,
      view,
      shape: "circle",
      anchors: [{ x, y }],
      radius: r,
      ...mapped
    }, physicianMode);
  }

  createCircleRegion(patientModel, view, cx, cy, ex, ey, anatomyLayer, physicianMode) {
    const rx = Math.abs(ex - cx);
    const ry = Math.abs(ey - cy);
    const radius = Math.max(rx, ry, 0.012);
    const mapped = mapAnatomyAt(view, cx, cy, anatomyLayer, physicianMode);
    const shape = Math.abs(rx - ry) < 0.004 ? "circle" : "ellipse";
    return this.addRegionToActive({
      patientModel,
      view,
      shape,
      anchors: [{ x: cx, y: cy }],
      radius: shape === "circle" ? radius : rx,
      radiusY: shape === "ellipse" ? ry : null,
      ...mapped
    }, physicianMode);
  }

  createPolygonRegion(patientModel, view, vertices, anatomyLayer, physicianMode) {
    if (!vertices || vertices.length < 3) return null;
    const anchors = vertices.map(v => ({ x: clamp01(v.x), y: clamp01(v.y) }));
    const c = getRegionCenter({ shape: "polygon", anchors });
    const mapped = mapAnatomyAt(view, c.x, c.y, anatomyLayer, physicianMode);
    return this.addRegionToActive({
      patientModel,
      view,
      shape: "polygon",
      anchors,
      radius: 0.02,
      ...mapped
    }, physicianMode);
  }

  updateActiveEntry(patch) {
    const entry = this.getActiveEntry();
    if (!entry) return null;
    Object.assign(entry, patch, { updatedAt: new Date().toISOString() });
    this.dirty = true;
    this.save();
    this._notify();
    return entry;
  }

  updateRegion(id, patch) {
    const found = this.findRegion(id);
    if (!found) return null;
    Object.assign(found.region, patch, { updatedAt: new Date().toISOString() });
    found.entry.updatedAt = new Date().toISOString();
    this.dirty = true;
    this.save();
    this._notify();
    return found.region;
  }

  /**
   * @param {{ allowEmpty?: boolean }} options
   * allowEmpty: user confirmed a symptom-free / zero-pain day
   */
  saveActiveEntry(options = {}) {
    const entry = this.getActiveEntry();
    if (!entry) return null;
    const empty = typeof isEntryContentEmpty === "function"
      ? isEntryContentEmpty(entry)
      : !entry.regions.length;
    if (empty && !options.allowEmpty) return null;
    if (!entry.regions.length && !options.allowEmpty) return null;
    entry.updatedAt = new Date().toISOString();
    const existingIdx = this.entries.findIndex(e => e.id === entry.id);
    if (existingIdx >= 0) {
      this.entries[existingIdx] = JSON.parse(JSON.stringify(entry));
      this.activeEntryId = entry.id;
    } else {
      this.entries.push(JSON.parse(JSON.stringify(entry)));
      this.activeEntryId = entry.id;
      this.draftEntry = null;
    }
    this._pushHistory();
    this.dirty = false;
    this.save();
    this._notify();
    return entry;
  }

  selectEntry(entryId) {
    this.activeEntryId = entryId === DRAFT_KEY ? DRAFT_KEY : entryId;
    const entry = this.getActiveEntry();
    this.selectedRegionIds = entry ? entry.regions.map(r => r.id) : [];
    this._notify();
    return entry;
  }

  selectRegion(id, additive = false) {
    const found = this.findRegion(id);
    if (!found) return null;
    if (additive) {
      const idx = this.selectedRegionIds.indexOf(id);
      if (idx >= 0) this.selectedRegionIds.splice(idx, 1);
      else this.selectedRegionIds.push(id);
    } else {
      this.selectedRegionIds = [id];
    }
    this.activeEntryId = found.entry === this.draftEntry ? DRAFT_KEY : found.entry.id;
    this._notify();
    return found.region;
  }

  findRegion(id) {
    for (const entry of [...this.entries, this.draftEntry].filter(Boolean)) {
      const region = entry.regions.find(r => r.id === id);
      if (region) return { region, entry };
    }
    return null;
  }

  moveRegion(id, x, y, patch = {}) {
    const found = this.findRegion(id);
    if (!found) return null;
    if (!this._mutating) this.beginMutation();
    const c = getRegionCenter(found.region);
    const dx = x - c.x;
    const dy = y - c.y;
    found.region.anchors = found.region.anchors.map(a => ({ x: clamp01(a.x + dx), y: clamp01(a.y + dy) }));
    Object.assign(found.region, patch, { updatedAt: new Date().toISOString() });
    found.entry.updatedAt = new Date().toISOString();
    this.dirty = true;
    this._notify();
    return found.region;
  }

  resizeRegion(id, x, y) {
    const found = this.findRegion(id);
    if (!found || found.region.shape === "polygon") return null;
    if (!this._mutating) this.beginMutation();
    const c = getRegionCenter(found.region);
    const rx = Math.abs(x - c.x);
    const ry = Math.abs(y - c.y);
    found.region.radius = Math.max(rx, 0.008);
    found.region.radiusY = Math.abs(ry - rx) < 0.003 ? null : Math.max(ry, 0.008);
    found.region.shape = found.region.radiusY ? "ellipse" : "circle";
    found.region.updatedAt = new Date().toISOString();
    found.entry.updatedAt = new Date().toISOString();
    this.dirty = true;
    this._notify();
    return found.region;
  }

  commitGeometry() {
    if (this._mutating) this.endMutation({ persist: true });
    else if (this.dirty) this.save();
  }

  deleteSelectedRegions() {
    const ids = new Set(this.selectedRegionIds);
    const prune = (entry) => {
      if (!entry) return;
      entry.regions = entry.regions.filter(r => !ids.has(r.id));
      entry.updatedAt = new Date().toISOString();
    };
    prune(this.draftEntry);
    this.entries.forEach(prune);
    // Keep empty saved entries only if they were deliberately empty (intensity 0 days);
    // default: remove entries that lost all regions
    this.entries = this.entries.filter(e => e.regions.length > 0 || (e.intensity === 0 && e.note));
    if (this.draftEntry && !this.draftEntry.regions.length && this.activeEntryId === DRAFT_KEY) {
      this.draftEntry = null;
      this.activeEntryId = null;
    }
    this.selectedRegionIds = [];
    this._pushHistory();
    this.save();
    this._notify();
  }

  /**
   * Soft-delete with temporary undo buffer (~8s).
   * @returns {{ restored: Function, entry: object|null }|null}
   */
  deleteEntry(entryId) {
    let removed = null;
    let removedFrom = null;
    if (entryId === DRAFT_KEY || (this.draftEntry && this.draftEntry.id === entryId)) {
      removed = this.draftEntry ? JSON.parse(JSON.stringify(this.draftEntry)) : null;
      removedFrom = "draft";
      this.draftEntry = null;
      if (this.activeEntryId === DRAFT_KEY) this.activeEntryId = null;
    } else {
      const idx = this.entries.findIndex(e => e.id === entryId);
      if (idx >= 0) {
        removed = JSON.parse(JSON.stringify(this.entries[idx]));
        removedFrom = "entries";
        this.entries.splice(idx, 1);
      }
      if (this.activeEntryId === entryId) this.activeEntryId = null;
    }
    this.selectedRegionIds = [];
    this._pushHistory();
    this.save();
    this._notify();

    if (!removed) return null;

    if (this._undoTimer) clearTimeout(this._undoTimer);
    this._undoBuffer = { entry: removed, from: removedFrom };
    this._undoTimer = setTimeout(() => {
      this._undoBuffer = null;
      this._undoTimer = null;
    }, 8000);

    return {
      entry: removed,
      restore: () => this.restoreDeletedEntry()
    };
  }

  restoreDeletedEntry() {
    if (!this._undoBuffer) return false;
    const { entry, from } = this._undoBuffer;
    this._undoBuffer = null;
    if (this._undoTimer) {
      clearTimeout(this._undoTimer);
      this._undoTimer = null;
    }
    const restored = createPainEntry(entry);
    if (from === "draft") {
      this.draftEntry = restored;
      this.activeEntryId = DRAFT_KEY;
    } else {
      this.entries.push(restored);
      this.activeEntryId = restored.id;
    }
    this._pushHistory();
    this.save();
    this._notify();
    return true;
  }

  clearAll() {
    this._pushHistory();
    const snapshot = {
      entries: JSON.parse(JSON.stringify(this.entries)),
      draftEntry: this.draftEntry ? JSON.parse(JSON.stringify(this.draftEntry)) : null
    };
    this.entries = [];
    this.draftEntry = null;
    this.activeEntryId = null;
    this.selectedRegionIds = [];
    this.save();
    this._notify();
    this._undoBuffer = { clearSnapshot: snapshot };
    this._undoTimer = setTimeout(() => {
      this._undoBuffer = null;
      this._undoTimer = null;
    }, 8000);
    return {
      restore: () => {
        if (!this._undoBuffer?.clearSnapshot) return false;
        const s = this._undoBuffer.clearSnapshot;
        this._undoBuffer = null;
        this.entries = (s.entries || []).map(e => createPainEntry(e));
        this.draftEntry = s.draftEntry ? createPainEntry(s.draftEntry) : null;
        this._pushHistory();
        this.save();
        this._notify();
        return true;
      }
    };
  }

  duplicateRegion(id) {
    const found = this.findRegion(id);
    if (!found) return null;
    const src = found.region;
    const c = getRegionCenter(src);
    const anchors = src.shape === 'polygon' && src.anchors.length >= 3
      ? src.anchors.map(a => ({ x: clamp01(a.x + 0.02), y: clamp01(a.y + 0.02) }))
      : [{ x: clamp01(c.x + 0.02), y: clamp01(c.y + 0.02) }];
    return this.addRegionToActive({
      patientModel: found.entry.patientModel,
      view: src.view,
      shape: src.shape,
      anchors,
      radius: src.radius,
      radiusY: src.radiusY,
      regionId: src.regionId,
      patientLabel: src.patientLabel,
      physicianLabel: src.physicianLabel,
      anatomyLayer: src.anatomyLayer,
      structureId: src.structureId,
      structureLabel: src.structureLabel
    });
  }

  mirrorRegion(id, physicianMode) {
    const found = this.findRegion(id);
    if (!found) return null;
    const src = found.region;
    const c = getRegionCenter(src);
    const newView = src.view === "left" ? "right" : src.view === "right" ? "left" : src.view;
    const newRegionId = mirrorRegionId(src.regionId, src.view);
    const lib = (ANATOMY_REGIONS[newView] || []).find(r => r.id === newRegionId);
    const nx = src.view === "left" || src.view === "right" ? c.x : 1 - c.x;
    return this.addRegionToActive({
      patientModel: found.entry.patientModel,
      view: newView,
      shape: src.shape,
      anchors: [{ x: clamp01(nx), y: c.y }],
      radius: src.radius,
      radiusY: src.radiusY,
      regionId: newRegionId,
      patientLabel: lib?.patientLabel || src.patientLabel,
      physicianLabel: lib?.physicianLabel || src.physicianLabel,
      anatomyLayer: lib?.layer || src.anatomyLayer,
      structureId: src.structureId,
      structureLabel: src.structureLabel
    }, physicianMode);
  }

  getRegionsForView(patientModel, view) {
    const model = normalizeModelType(patientModel);
    const result = [];
    const collect = (entry, entryNum, isDraft) => {
      if (normalizeModelType(entry.patientModel) !== model) return;
      entry.regions.forEach((r, ri) => {
        if (r.view !== view) return;
        result.push({
          ...r,
          _entryId: entry.id,
          _entryNum: entryNum,
          _regionIndex: ri,
          _entryIntensity: entry.intensity,
          _entryLabel: regionLabel(entryNum, ri),
          _isDraft: isDraft,
          _isActiveEntry: this.getActiveEntry()?.id === entry.id
        });
      });
    };
    this.entries.forEach((e, i) => collect(e, i + 1, false));
    if (this.draftEntry) collect(this.draftEntry, this.entries.length + 1, true);
    return result;
  }

  getEntrySummary(entry, entryNum, physicianMode) {
    const labels = entry.regions.map(r => physicianMode ? (r.physicianLabel || r.patientLabel) : (r.patientLabel || r.physicianLabel)).filter(Boolean);
    const unique = [...new Set(labels)];
    const triggers = entry.triggers?.slice(0, 2).join("/") || "";
    return {
      entryNum,
      regionCount: entry.regions.length,
      regions: unique.join(", ") || "Unspecified",
      intensity: entry.intensity,
      triggers,
      time: new Date(entry.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    };
  }

  exportPainReport(patientModel, view) {
    const model = normalizeModelType(patientModel);
    const entries = this.entries.filter(e => normalizeModelType(e.patientModel) === model);
    return {
      exportedAt: new Date().toISOString(),
      patientModel: model,
      currentView: view,
      entryCount: entries.length,
      entries: entries.map((entry, i) => ({
        entryNumber: i + 1,
        id: entry.id,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        intensity: entry.intensity,
        quality: entry.quality,
        triggers: entry.triggers,
        easesAfter: entry.easesAfter,
        duration: entry.duration,
        whenOccurring: entry.whenOccurring,
        note: entry.note,
        regions: entry.regions.map((r, ri) => ({
          label: regionLabel(i + 1, ri),
          patientLabel: r.patientLabel,
          physicianLabel: r.physicianLabel,
          view: r.view,
          anatomyLayer: r.anatomyLayer,
          shape: r.shape,
          anchors: r.anchors.map(a => ({ x: +a.x.toFixed(4), y: +a.y.toFixed(4) })),
          radius: r.radius,
          radiusY: r.radiusY,
          structureLabel: r.structureLabel
        }))
      }))
    };
  }

  // Legacy aliases for renderer transition
  get selectedMarkerIds() { return this.selectedRegionIds; }
  set selectedMarkerIds(v) { this.selectedRegionIds = v; }
  getMarkersForView(m, v) { return this.getRegionsForView(m, v); }
  findMarker(id) { return this.findRegion(id); }
  selectMarker(id, a) { return this.selectRegion(id, a); }
  deleteSelectedMarkers() { return this.deleteSelectedRegions(); }
  addMarkerToActive(p) { return this.addRegionToActive(p); }
  moveMarker(id, x, y, patch) { return this.moveRegion(id, x, y, patch); }
}

window.PainEntryStore = PainEntryStore;
window.PainMarkerStore = PainEntryStore;
window.createPainRegion = createPainRegion;
window.createPainEntry = createPainEntry;
window.createPainMarker = createPainRegion;
window.normalizeModelType = normalizeModelType;
window.regionLabel = regionLabel;
window.markerLabel = regionLabel;
window.getRegionCenter = getRegionCenter;
window.getRegionRadii = getRegionRadii;
window.getRegionOpacity = getRegionOpacity;
window.DRAFT_KEY = DRAFT_KEY;
window.REGION_TOOLS = REGION_TOOLS;
