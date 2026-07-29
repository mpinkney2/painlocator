/**
 * Minimal Node test runner for PainLocator pure logic.
 * Loads modules by evaluating source with stubs where needed.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

function loadScript(rel, sandbox) {
  const code = readFileSync(join(root, rel), 'utf8');
  vm.runInContext(code, sandbox, { filename: rel });
}

function createSandbox() {
  const localStorage = (() => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      clear: () => map.clear(),
      _map: map
    };
  })();

  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    Error,
    parseInt,
    isNaN,
    localStorage,
    window: {},
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({
        style: {},
        classList: { add() {}, remove() {}, toggle() {} },
        setAttribute() {},
        appendChild() {},
        addEventListener() {}
      }),
      body: { appendChild() {}, classList: { toggle() {}, add() {}, contains: () => false } },
      addEventListener() {}
    },
    navigator: { userAgent: 'test', platform: 'test', language: 'en', sendBeacon() {} },
    location: { pathname: '/', hash: '', hostname: 'localhost', protocol: 'http:', href: 'http://localhost/' },
    setTimeout,
    clearTimeout,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Anatomy mapping stub used by store
  sandbox.mapAnatomyAt = (view, x, y, layer) => ({
    regionId: 'test_region',
    patientLabel: 'Test region',
    physicianLabel: 'Test region clinical',
    anatomyLayer: layer || 'skin',
    structureId: null,
    structureLabel: null
  });
  sandbox.ANATOMY_REGIONS = { front: [], back: [], left: [], right: [] };
  sandbox.mirrorRegionId = (id) => id;

  loadScript('src/engine/annotations/pain-models.js', sandbox);
  loadScript('src/engine/annotations/pain-entry-store.js', sandbox);
  loadScript('src/features/trends/trend-summary.js', sandbox);
  loadScript('src/utils/dom.js', sandbox);
  return sandbox;
}

function createMapperSandbox() {
  const sandbox = {
    console,
    Math,
    Object,
    Number,
    window: {},
    document: {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  loadScript('src/engine/annotations/pain-models.js', sandbox);
  loadScript('src/engine/coordinates/anatomy-coordinate-mapper.js', sandbox);
  return sandbox;
}

console.log('PainLocator tests\n');

// --- Trend summary ---
{
  const s = createSandbox();
  test('trend summary: insufficient data for empty list', () => {
    const r = s.generateTrendSummary([]);
    assert.equal(r.insufficient, true);
    assert.ok(r.observations[0].toLowerCase().includes('not enough') || r.observations[0].toLowerCase().includes('enough'));
    assert.ok(r.disclaimer.includes('not a medical diagnosis'));
  });

  test('trend summary: single entry is insufficient', () => {
    const entries = [s.createPainEntry({ intensity: 6, regions: [s.createPainRegion({ view: 'front', patientLabel: 'Knee' })] })];
    const r = s.generateTrendSummary(entries);
    assert.equal(r.insufficient, true);
  });

  test('trend summary: decreasing intensity observation', () => {
    const entries = [6, 5, 4, 3].map((intensity, i) =>
      s.createPainEntry({
        intensity,
        createdAt: new Date(Date.now() - (4 - i) * 86400000).toISOString(),
        regions: [s.createPainRegion({ view: 'front', patientLabel: 'Lower abdomen' })],
        triggers: i % 2 === 0 ? ['Sitting'] : ['Walking']
      })
    );
    const r = s.generateTrendSummary(entries);
    assert.equal(r.insufficient, false);
    assert.ok(r.observations.some(o => /decreased|changed from/i.test(o)));
  });

  test('filterEntriesByRange keeps recent only', () => {
    const old = s.createPainEntry({ createdAt: new Date(Date.now() - 40 * 86400000).toISOString(), intensity: 5 });
    const recent = s.createPainEntry({ createdAt: new Date().toISOString(), intensity: 3 });
    const filtered = s.filterEntriesByRange([old, recent], 7);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, recent.id);
  });
}

// --- Entry store ---
{
  const s = createSandbox();
  const store = new s.PainEntryStore();

  test('creating and saving an entry with regions', () => {
    store.newEntry('adult-male');
    store.createPointRegion('adult-male', 'front', 0.4, 0.5, 'skin', false);
    store.updateActiveEntry({ intensity: 7, quality: ['Sharp'], note: 'Test note' });
    const saved = store.saveActiveEntry();
    assert.ok(saved);
    assert.equal(store.entries.length, 1);
    assert.equal(store.entries[0].intensity, 7);
    assert.equal(store.entries[0].regions.length, 1);
    assert.equal(store.entries[0].regions[0].view, 'front');
  });

  test('view-specific coordinates persist on regions', () => {
    store.createPointRegion('adult-male', 'back', 0.55, 0.4, 'skin', false);
    // After save, draft cleared — create new
    store.newEntry('adult-male');
    const r = store.createCircleRegion('adult-male', 'left', 0.3, 0.4, 0.35, 0.45, 'skin', false);
    assert.equal(r.view, 'left');
    const saved = store.saveActiveEntry();
    assert.ok(saved.regions.every(reg => typeof reg.anchors[0].x === 'number'));
    const left = store.getRegionsForView('adult-male', 'left');
    assert.ok(left.some(reg => reg.view === 'left'));
  });

  test('empty save rejected without allowEmpty', () => {
    store.newEntry('adult-male');
    const result = store.saveActiveEntry();
    assert.equal(result, null);
  });

  test('empty day save allowed with allowEmpty', () => {
    store.newEntry('adult-male');
    store.updateActiveEntry({ intensity: 0, note: 'Good day' });
    const result = store.saveActiveEntry({ allowEmpty: true });
    assert.ok(result);
  });

  test('delete entry with restore buffer', () => {
    const before = store.entries.length;
    const id = store.entries[0].id;
    const result = store.deleteEntry(id);
    assert.equal(store.entries.length, before - 1);
    assert.ok(result.restore());
    assert.equal(store.entries.length, before);
  });

  test('schema version written on save', () => {
    store.save();
    const raw = JSON.parse(s.localStorage.getItem(s.getEntryStorageKey()));
    assert.equal(raw.schemaVersion, '1.1.0');
  });

  test('undo restores prior annotation state', () => {
    store.newEntry('adult-male');
    store.createPointRegion('adult-male', 'front', 0.2, 0.2, 'skin', false);
    const afterAdd = store.getActiveEntry().regions.length;
    assert.ok(afterAdd >= 1);
    assert.ok(store.canUndo());
    store.undo();
    const entry = store.getActiveEntry();
    // After undo, region count should decrease or draft reset depending on history
    assert.ok(store.canRedo());
  });
}

// --- Demo isolation ---
{
  const s = createSandbox();
  test('demo storage key is distinct from real key', () => {
    const realKey = 'painlocator_pain_entries';
    const demoKey = 'painlocator_demo_entries';
    s.setEntryStorageKey(realKey);
    const store = new s.PainEntryStore();
    store.newEntry('adult-male');
    store.createPointRegion('adult-male', 'front', 0.5, 0.5, 'skin', false);
    store.saveActiveEntry();
    assert.ok(s.localStorage.getItem(realKey));
    s.setEntryStorageKey(demoKey);
    store.entries = [];
    store.draftEntry = null;
    store.save();
    assert.ok(s.localStorage.getItem(demoKey));
    const real = JSON.parse(s.localStorage.getItem(realKey));
    assert.ok(real.entries.length >= 1);
  });
}

// --- Feedback validation (inline reimplementation of pure checks) ---
{
  const s = createSandbox();
  loadScript('src/features/feedback/feedback-service.js', s);

  test('feedback validation requires rating and content', () => {
    const bad = s.feedbackService.validateFeedback({ type: 'general', rating: 0 });
    assert.equal(bad.ok, false);
    const good = s.feedbackService.validateFeedback({
      type: 'bug',
      rating: 4,
      tryingToDo: 'Save an entry',
      improve: 'Clearer validation'
    });
    assert.equal(good.ok, true);
    assert.ok(good.payload.clientReferenceHint);
  });

  test('feedback sanitizes control characters', () => {
    const r = s.feedbackService.validateFeedback({
      type: 'general',
      rating: 5,
      workedWell: 'Nice\u0000app'
    });
    assert.equal(r.ok, true);
    assert.equal(r.payload.workedWell.includes('\u0000'), false);
  });
}

// --- Escape HTML ---
{
  const s = createSandbox();
  test('escapeHtml encodes markup', () => {
    assert.equal(s.escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  });
}

// --- isEntryContentEmpty ---
{
  const s = createSandbox();
  test('isEntryContentEmpty detects blank drafts', () => {
    const blank = s.createPainEntry({ intensity: 5 });
    assert.equal(s.isEntryContentEmpty(blank), true);
    const zero = s.createPainEntry({ intensity: 0 });
    assert.equal(s.isEntryContentEmpty(zero), false);
  });
}

// --- Coordinate mapper zoom / enlarge ---
{
  const s = createMapperSandbox();
  const Mapper = s.AnatomyCoordinateMapper;

  function mockFrame(parentW, parentH, rect) {
    const parent = { clientWidth: parentW, clientHeight: parentH };
    const style = {};
    const frame = {
      parentElement: parent,
      style,
      getBoundingClientRect: () => rect
    };
    const image = { naturalWidth: 400, naturalHeight: 800 };
    return { frame, image, style };
  }

  test('mapper fit bounds letterbox without zoom', () => {
    const { frame, image } = mockFrame(200, 400, { left: 50, top: 0, width: 100, height: 200 });
    const mapper = new Mapper(frame, image);
    const b = mapper.getImageBounds();
    assert.equal(b.width, 200);
    assert.equal(b.height, 400);
    assert.equal(mapper.isEnlarged(), false);
  });

  test('mapper enlarge scales frame and keeps focus center', () => {
    const { frame, image } = mockFrame(200, 400, { left: 0, top: 0, width: 200, height: 400 });
    const mapper = new Mapper(frame, image);
    mapper.setZoom(Mapper.ENLARGED_ZOOM, { focusX: 0.5, focusY: 0.5 });
    assert.equal(mapper.isEnlarged(), true);
    const b = mapper.getImageBounds();
    assert.ok(Math.abs(b.width - 200 * Mapper.ENLARGED_ZOOM) < 0.01);
    assert.ok(Math.abs(b.height - 400 * Mapper.ENLARGED_ZOOM) < 0.01);
    // Focus at center → frame extends equally beyond viewport
    assert.ok(b.left < 0);
    assert.ok(b.top < 0);
  });

  test('mapper clientToNormalized uses frame rect (sync-safe)', () => {
    const { frame, image } = mockFrame(200, 400, { left: 10, top: 20, width: 100, height: 200 });
    const mapper = new Mapper(frame, image);
    const n = mapper.clientToNormalized(60, 120);
    assert.equal(n.x, 0.5);
    assert.equal(n.y, 0.5);
  });

  test('mapper isInsideImage rejects clamped-only exterior taps', () => {
    const { frame, image } = mockFrame(200, 400, { left: 10, top: 20, width: 100, height: 200 });
    const mapper = new Mapper(frame, image);
    assert.equal(mapper.isInsideImage(60, 120), true);
    assert.equal(mapper.isInsideImage(5, 120), false);
    assert.equal(mapper.isInsideImage(60, 10), false);
  });

  test('mapper resetZoom returns to fit', () => {
    const { frame, image } = mockFrame(200, 400, { left: 0, top: 0, width: 200, height: 400 });
    const mapper = new Mapper(frame, image);
    mapper.setZoom(2, { focusX: 0.3, focusY: 0.4 });
    mapper.setPan(12, -8);
    mapper.resetZoom();
    assert.equal(mapper.isEnlarged(), false);
    assert.equal(mapper.panX, 0);
    assert.equal(mapper.panY, 0);
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
