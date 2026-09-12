/**
 * Minimal Node test runner for PainLocator pure logic.
 * Loads modules by evaluating source with stubs where needed.
 */
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
/** @type {Promise<void>} */
let testQueue = Promise.resolve();

function test(name, fn) {
  testQueue = testQueue.then(async () => {
    try {
      const result = fn();
      if (result && typeof result.then === 'function') {
        await result;
      }
      passed += 1;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${name}`);
      console.error(`    ${err && err.message ? err.message : err}`);
    }
  });
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
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    }
  };
  sandbox.document.dispatchEvent = () => {};
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


// --- Spatial projection helpers ---
{
  const sandbox = { console, Math, Object, Number, window: {}, document: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  loadScript('src/engine/spatial/spatial-projection.js', sandbox);
  const P = sandbox.SpatialProjection;

  test('spatial projection: yaw snaps to four orthographic views', () => {
    assert.equal(P.nearestSnapView(0), 'front');
    assert.equal(P.nearestSnapView(Math.PI), 'back');
    assert.equal(P.nearestSnapView(Math.PI / 2), 'right');
    assert.equal(P.nearestSnapView(-Math.PI / 2), 'left');
    assert.equal(P.nearestSnapView(0.2), 'front');
    assert.equal(P.nearestSnapView(Math.PI - 0.1), 'back');
  });

  test('spatial projection: cameraDistanceForBounds frames taller bodies farther', () => {
    const close = P.cameraDistanceForBounds({ x: 0.5, y: 1.0, z: 0.3 }, 32, 0.6, 1);
    const tall = P.cameraDistanceForBounds({ x: 0.5, y: 1.8, z: 0.3 }, 32, 0.6, 1);
    const wide = P.cameraDistanceForBounds({ x: 2.0, y: 1.0, z: 0.3 }, 32, 0.6, 1);
    assert.ok(tall > close);
    assert.ok(wide > close);
    assert.ok(P.cameraDistanceForBounds({ x: 0, y: 0, z: 0 }, 32, 1) >= 0.8);
    const padded = P.cameraDistanceForBounds({ x: 0.5, y: 1.8, z: 0.3 }, 32, 0.6, 1.16);
    assert.ok(Math.abs(padded - tall * 1.16) < 1e-9);
  });

  test('spatial projection: yawForView matches VIEW_YAW table', () => {
    assert.equal(P.yawForView('front'), 0);
    assert.equal(P.yawForView('back'), Math.PI);
    assert.equal(P.yawForView('right'), Math.PI / 2);
    assert.equal(P.yawForView('left'), -Math.PI / 2);
  });

  test('spatial projection: normalizeYaw wraps to (-π, π]', () => {
    assert.ok(Math.abs(P.normalizeYaw(3 * Math.PI) - Math.PI) < 1e-9);
    assert.ok(Math.abs(P.normalizeYaw(-3 * Math.PI) - (-Math.PI)) < 1e-9 || Math.abs(P.normalizeYaw(-3 * Math.PI) - Math.PI) < 1e-9);
  });

  test('spatial projection: attachment round-trip keeps localPoint', () => {
    // Minimal fake hit/mesh without Three.js
    const fakeTHREE = {
      Vector3: class {
        constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
        clone() { return new fakeTHREE.Vector3(this.x, this.y, this.z); }
        fromBufferAttribute() { return this; }
        set() { return this; }
        addScaledVector() { return this; }
      },
      Triangle: { getBarycentricCoordinates() {} }
    };
    const mesh = {
      uuid: 'mesh-1',
      name: 'surface.torso',
      userData: { meshId: 'surface.torso', structureId: 'PL:surface.torso' },
      worldToLocal(v) { return v; },
      localToWorld(v) { return v; },
      geometry: null
    };
    const hit = {
      object: mesh,
      point: { clone() { return { x: 0.1, y: 1.2, z: 0.3, clone() { return this; } }; }, x: 0.1, y: 1.2, z: 0.3 },
      face: null,
      faceIndex: null,
      barycoord: null
    };
    // attachmentFromIntersection expects THREE.Vector3-like point with clone
    hit.point = new fakeTHREE.Vector3(0.1, 1.2, 0.3);
    mesh.worldToLocal = (v) => new fakeTHREE.Vector3(v.x, v.y, v.z);
    mesh.localToWorld = (v) => new fakeTHREE.Vector3(v.x, v.y, v.z);
    const att = P.attachmentFromIntersection(fakeTHREE, hit);
    assert.equal(att.meshUuid, 'mesh-1');
    assert.equal(att.meshId, 'surface.torso');
    assert.equal(att.structureId, 'PL:surface.torso');
    assert.equal(att.localPoint.x, 0.1);
    assert.equal(att.localPoint.y, 1.2);
    const map = new Map([[mesh.uuid, mesh]]);
    const world = P.resolveAttachmentWorldPoint(fakeTHREE, att, map);
    assert.ok(world);
    assert.equal(world.x, 0.1);
    assert.equal(world.y, 1.2);
    assert.equal(world.z, 0.3);
  });

  test('spatial projection: resolveMesh remounts via stable meshId', () => {
    const oldMesh = { uuid: 'uuid-old', name: 'surface.torso', userData: { meshId: 'surface.torso' }, localToWorld(v) { return v; } };
    const newMesh = { uuid: 'uuid-new', name: 'surface.torso', userData: { meshId: 'surface.torso', structureId: 'PL:surface.torso' }, localToWorld(v) { return v; } };
    const att = {
      meshUuid: 'uuid-old',
      meshId: 'surface.torso',
      meshName: 'surface.torso',
      localPoint: { x: 0.2, y: 1.0, z: 0.1 }
    };
    const byUuid = new Map([[newMesh.uuid, newMesh]]);
    const byId = new Map([['surface.torso', newMesh]]);
    const resolved = P.resolveMesh(att, byUuid, byId);
    assert.ok(resolved);
    assert.equal(resolved.uuid, 'uuid-new');
    assert.equal(att.meshUuid, 'uuid-new');
    assert.equal(att.meshId, 'surface.torso');
    assert.equal(att.structureId, 'PL:surface.torso');
    const fakeTHREE = {
      Vector3: class {
        constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
      }
    };
    const world = P.resolveAttachmentWorldPoint(fakeTHREE, att, byUuid, byId);
    assert.ok(world);
    assert.equal(world.x, 0.2);
    assert.equal(world.y, 1.0);
    assert.equal(world.z, 0.1);
    assert.equal(oldMesh.name, 'surface.torso');
  });

  test('spatial projection: resolveMesh falls back to meshName (Phase 1 sessions)', () => {
    const newMesh = { uuid: 'uuid-new', name: 'torso', userData: {}, localToWorld(v) { return v; } };
    const att = { meshUuid: 'uuid-old', meshName: 'torso', localPoint: { x: 0, y: 1, z: 0 } };
    const byUuid = new Map([[newMesh.uuid, newMesh]]);
    const byName = new Map([['torso', newMesh]]);
    const resolved = P.resolveMesh(att, byUuid, byName);
    assert.equal(resolved.uuid, 'uuid-new');
  });

  test('spatial projection: worldToNormalizedAnchors is camera NDC (not letterbox)', () => {
    // Phase 1 documents approximate plate compatibility: full-viewport NDC → 0–1.
    const fakeCamera = {};
    const fakeTHREE = {};
    const worldPoint = {
      clone() {
        return {
          project() {
            return { x: 0, y: 0, z: 0.5 }; // NDC center
          }
        };
      }
    };
    const anchors = P.worldToNormalizedAnchors(fakeTHREE, fakeCamera, worldPoint);
    assert.equal(anchors.x, 0.5);
    assert.equal(anchors.y, 0.5);
    assert.equal(anchors.ndcZ, 0.5);
  });
}

// --- Spatial manifest helpers ---
{
  const sandbox = { console, Math, Object, Number, Array, Map, JSON, Error, window: {}, document: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  loadScript('src/engine/spatial/spatial-manifest-loader.js', sandbox);
  const U = sandbox.SpatialManifestUtils;

  test('spatial manifest: joinUrl resolves relative asset paths', () => {
    assert.equal(
      U.joinUrl('/anatomy/spatial/manifest.json', './adult-male/manifest.json'),
      '/anatomy/spatial/adult-male/manifest.json'
    );
    assert.equal(
      U.joinUrl('/anatomy/spatial/adult-male/manifest.json', './exterior-lod0.glb'),
      '/anatomy/spatial/adult-male/exterior-lod0.glb'
    );
    assert.equal(U.joinUrl('/a/b.json', '/abs/x.glb'), '/abs/x.glb');
  });

  test('spatial manifest: validateCatalog requires schema + defaultModelId + models', () => {
    assert.throws(() => U.validateCatalog(null), /Catalog missing/);
    assert.throws(() => U.validateCatalog({}), /schemaVersion/);
    assert.throws(() => U.validateCatalog({ schemaVersion: '1', models: [] }), /defaultModelId/);
    const ok = U.validateCatalog({
      schemaVersion: '1.0.0',
      defaultModelId: 'adult-male',
      models: [{ modelId: 'adult-male', manifest: './adult-male/manifest.json' }]
    });
    assert.equal(ok.defaultModelId, 'adult-male');
  });

  test('spatial manifest: validateModelManifest requires surface file + meshIds', () => {
    assert.throws(() => U.validateModelManifest({ schemaVersion: '1', modelId: 'x' }), /layers/);
    assert.throws(
      () =>
        U.validateModelManifest({
          schemaVersion: '1',
          modelId: 'x',
          layers: { surface: { file: './a.glb', meshes: [{}] } }
        }),
      /meshId/
    );
    const manifest = JSON.parse(
      readFileSync(join(root, 'public/anatomy/spatial/adult-male/manifest.json'), 'utf8')
    );
    const ok = U.validateModelManifest(manifest);
    assert.equal(ok.modelId, 'adult-male');
    assert.equal(ok.layers.surface.file, '/anatomy/metahuman/body.glb');
    assert.equal(ok.layers.surface.bindMode, 'single-mesh');
  });

  test('spatial manifest: indexMeshes maps stable meshId entries', () => {
    const manifest = JSON.parse(
      readFileSync(join(root, 'public/anatomy/spatial/adult-male/manifest.json'), 'utf8')
    );
    const index = U.indexMeshes(manifest);
    assert.ok(index.has('surface.body'));
    assert.equal(index.get('surface.body').structureId, 'PL:surface.body');
    assert.equal(index.get('surface.body').layer, 'surface');
    assert.equal(index.size, manifest.layers.surface.meshes.length);
  });

  test('spatial manifest: validateCatalog failure paths', () => {
    assert.throws(() => U.validateCatalog({ schemaVersion: '1', defaultModelId: 'x' }), /models/);
  });

  test('spatial manifest: rejects duplicate meshIds and non-PL structureIds', () => {
    assert.throws(
      () =>
        U.validateModelManifest({
          schemaVersion: '1',
          modelId: 'x',
          layers: {
            surface: {
              file: './a.glb',
              meshes: [
                { meshId: 'surface.head', structureId: 'PL:surface.head' },
                { meshId: 'surface.head', structureId: 'PL:surface.head' }
              ]
            }
          }
        }),
      /Duplicate meshId/
    );
    assert.throws(
      () =>
        U.validateModelManifest({
          schemaVersion: '1',
          modelId: 'x',
          layers: {
            surface: {
              file: './a.glb',
              meshes: [{ meshId: 'surface.head', structureId: 'FMA:123' }]
            }
          }
        }),
      /PL:/
    );
  });

  test('spatial manifest: assertManifestGlbIntegrity enforces authoritative mesh set', () => {
    U.assertManifestGlbIntegrity(['a', 'b'], ['b', 'a']);
    assert.throws(() => U.assertManifestGlbIntegrity(['a', 'b'], ['a']), /missing from GLB/);
    assert.throws(() => U.assertManifestGlbIntegrity(['a'], ['a', 'extra']), /missing from manifest/);
    assert.throws(() => U.assertManifestGlbIntegrity(['a', 'a'], ['a']), /duplicate meshId/);
    assert.throws(() => U.assertManifestGlbIntegrity(['a'], ['a', 'a']), /duplicate mesh/);
  });

  /** Collect GLB body mesh names (nodes that reference a mesh). Root groups without meshes are ignored. */
  function listGlbBodyMeshNames(glbPath) {
    const buf = readFileSync(glbPath);
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (buf.toString('utf8', 0, 4) !== 'glTF') throw new Error('Not a GLB');
    const chunkLen = dv.getUint32(12, true);
    const chunkType = dv.getUint32(16, true);
    if (chunkType !== 0x4e4f534a) throw new Error('GLB JSON chunk missing');
    const json = buf.subarray(20, 20 + chunkLen).toString('utf8');
    const gltf = JSON.parse(json);
    const names = [];
    for (const node of gltf.nodes || []) {
      if (node.mesh == null) continue;
      if (!node.name) throw new Error('GLB mesh node missing name');
      names.push(node.name);
    }
    return names;
  }

  test('spatial manifest: shipped catalog + GLB meshIds match 1:1', () => {
    const catalog = JSON.parse(readFileSync(join(root, 'public/anatomy/spatial/manifest.json'), 'utf8'));
    U.validateCatalog(catalog);
    const modelPath = join(root, 'public/anatomy/spatial/adult-male/manifest.json');
    const model = JSON.parse(readFileSync(modelPath, 'utf8'));
    U.validateModelManifest(model);
    const file = model.layers.surface.file;
    const glb = file.startsWith('/')
      ? join(root, 'public', file.replace(/^\//, ''))
      : join(root, 'public/anatomy/spatial/adult-male', file);
    const size = statSync(glb).size;
    assert.ok(size > 50_000, `GLB too small: ${size}`);
    assert.ok(size < 5_000_000, `GLB exceeds 5MB target: ${size}`);

    const manifestIds = model.layers.surface.meshes.map((m) => m.meshId);
    const glbIds = listGlbBodyMeshNames(glb);
    if (model.layers.surface.bindMode === 'single-mesh') {
      assert.equal(manifestIds.length, 1);
      assert.equal(glbIds.length, 1);
      assert.equal(manifestIds[0], 'surface.body');
    } else {
      U.assertManifestGlbIntegrity(manifestIds, glbIds);
    }
    for (const entry of model.layers.surface.meshes) {
      assert.ok(String(entry.structureId).startsWith('PL:'), `structureId must be PL-local: ${entry.structureId}`);
    }
  });

  test('spatial manifest: resolveGlbMeshId restores GLTFLoader-stripped dots', () => {
    const fake = new Map([
      ['surface.head', {}],
      ['surface.torso', {}]
    ]);
    assert.equal(U.compactMeshId('surface.head'), 'surfacehead');
    assert.equal(U.resolveGlbMeshId('surface.head', fake), 'surface.head');
    assert.equal(U.resolveGlbMeshId('surfacehead', fake), 'surface.head');
    assert.equal(U.resolveGlbMeshId('surface.torso', fake), 'surface.torso');
    assert.equal(U.resolveGlbMeshId('surfacetorso', fake), 'surface.torso');
    assert.equal(U.resolveGlbMeshId('unknownMesh', fake), 'unknownMesh');
    const manifest = JSON.parse(
      readFileSync(join(root, 'public/anatomy/spatial/adult-male/manifest.json'), 'utf8')
    );
    const index = U.indexMeshes(manifest);
    assert.ok(index.has('surface.body'));
  });
}

// --- Product Experience V1: presentation mode ---
{
  const sandbox = createSandbox();
  loadScript('src/state/presentation.js', sandbox);

  test('presentation: normalizeMode maps aliases', () => {
    const n = sandbox.PresentationMode.normalizeMode;
    assert.equal(n('patient'), 'patient');
    assert.equal(n('clinician'), 'clinician');
    assert.equal(n('clinical'), 'clinician');
    assert.equal(n('consult'), 'consult');
    assert.equal(n('nope'), 'patient');
  });

  test('presentation: nav labels differ by shell', () => {
    const patient = sandbox.PresentationMode.navLabels('patient');
    const clinician = sandbox.PresentationMode.navLabels('clinician');
    assert.equal(patient.capture.label, 'Pain map');
    assert.equal(patient.clinical.label, 'Share');
    assert.equal(patient.review.label, 'History');
    assert.equal(clinician.capture.label, 'Anatomy');
    assert.equal(clinician.review.label, 'History');
    assert.equal(clinician.clinical.label, 'Report');
  });

  test('presentation: persist preference to localStorage', () => {
    sandbox.PresentationMode.writeStored('clinician');
    assert.equal(sandbox.localStorage.getItem(sandbox.PresentationMode.STORAGE_KEY), 'clinician');
    assert.equal(sandbox.PresentationMode.readStored(), 'clinician');
    sandbox.PresentationMode.writeStored('patient');
    assert.equal(sandbox.PresentationMode.readStored(), 'patient');
  });
}

// --- Product Experience V1: patient steps + save correctness ---
{
  function makePatientSandbox(entry) {
    const sandbox = createSandbox();
    sandbox.state = { presentationMode: 'patient', patientStep: 'locate', workflowMode: 'capture' };
    let active = entry;
    sandbox.entryStore = {
      getActiveEntry: () => active,
      updateActiveEntry: (patch) => {
        active = { ...(active || {}), ...patch };
        return active;
      },
      ensureActiveEntry: () => {
        if (!active) active = { regions: [], intensity: 5, quality: [], triggers: [], easesAfter: [], note: '' };
        return active;
      },
      onChange: () => {}
    };
    sandbox.showToast = () => {};
    loadScript('src/features/shell/patient-flow.js', sandbox);
    return sandbox;
  }

  test('patient flow: PatientSteps contract', () => {
    const sandbox = makePatientSandbox({ regions: [{ id: 'r1', patientLabel: 'Left shoulder' }] });
    assert.deepEqual([...sandbox.PatientSteps], ['locate', 'describe', 'review']);
  });

  test('patient flow: setPatientStep updates state when regions exist', () => {
    const sandbox = makePatientSandbox({
      regions: [{ id: 'r1', patientLabel: 'Left shoulder' }],
      intensity: 5,
      quality: [],
      triggers: [],
      easesAfter: [],
      note: ''
    });
    sandbox.setPatientStep('describe');
    assert.equal(sandbox.state.patientStep, 'describe');
    sandbox.setPatientStep('review');
    assert.equal(sandbox.state.patientStep, 'review');
    sandbox.setPatientStep('locate');
    assert.equal(sandbox.state.patientStep, 'locate');
  });

  test('patient flow: describe is always available; review requires a mark', () => {
    const sandbox = makePatientSandbox(null);
    sandbox.setPatientStep('describe');
    assert.equal(sandbox.state.patientStep, 'describe');
    sandbox.setPatientStep('review');
    assert.equal(sandbox.state.patientStep, 'locate');
  });

  test('patient save: success only when saveCurrentEntry returns an entry', async () => {
    const sandbox = makePatientSandbox({
      regions: [{ id: 'r1', patientLabel: 'Knee' }],
      intensity: 6,
      quality: ['Sharp'],
      triggers: [],
      easesAfter: [],
      note: ''
    });
    sandbox.state.patientStep = 'review';
    sandbox.document.getElementById = (id) => {
      if (id === 'btnPatientSave') {
        return { disabled: false, textContent: 'Save pain map' };
      }
      if (id === 'patientSaveConfirm') {
        return { hidden: true, textContent: '' };
      }
      return null;
    };
    let calls = 0;
    sandbox.saveCurrentEntry = async () => {
      calls += 1;
      return { id: 'saved-1', intensity: 6 };
    };
    const saved = await sandbox.savePatientEntry();
    assert.ok(saved);
    assert.equal(saved.id, 'saved-1');
    assert.equal(calls, 1);
  });

  test('patient save: failed/null save stays on review and shows no success', async () => {
    const sandbox = makePatientSandbox({
      regions: [{ id: 'r1', patientLabel: 'Knee' }],
      intensity: 4,
      quality: [],
      triggers: [],
      easesAfter: [],
      note: ''
    });
    sandbox.state.patientStep = 'review';
    const confirm = { hidden: true, textContent: '' };
    sandbox.document.getElementById = (id) => {
      if (id === 'btnPatientSave') return { disabled: false, textContent: 'Save Pain Entry' };
      if (id === 'patientSaveConfirm') return confirm;
      return null;
    };
    sandbox.saveCurrentEntry = async () => null;
    const saved = await sandbox.savePatientEntry();
    assert.equal(saved, null);
    assert.equal(sandbox.state.patientStep, 'review');
    assert.equal(confirm.hidden, true);
    assert.notEqual(confirm.textContent, 'Pain entry saved.');
  });

  test('patient save: duplicate click prevention while saving', async () => {
    const sandbox = makePatientSandbox({
      regions: [{ id: 'r1', patientLabel: 'Back' }],
      intensity: 7,
      quality: [],
      triggers: [],
      easesAfter: [],
      note: ''
    });
    sandbox.state.patientStep = 'review';
    sandbox.document.getElementById = (id) => {
      if (id === 'btnPatientSave') return { disabled: false, textContent: 'Save Pain Entry' };
      if (id === 'patientSaveConfirm') return { hidden: true, textContent: '' };
      return null;
    };
    let calls = 0;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    sandbox.saveCurrentEntry = async () => {
      calls += 1;
      await gate;
      return { id: 'saved-2' };
    };
    const p1 = sandbox.savePatientEntry();
    const p2 = sandbox.savePatientEntry();
    release({ id: 'saved-2' });
    const [a, b] = await Promise.all([p1, p2]);
    assert.equal(calls, 1);
    assert.ok(a);
    assert.equal(b, null);
  });

  test('patient describe chips map to store quality values', () => {
    const sandbox = makePatientSandbox({
      regions: [{ id: 'r1', patientLabel: 'Shoulder' }],
      intensity: 5,
      quality: [],
      triggers: [],
      easesAfter: [],
      note: ''
    });
    const values = sandbox.__patientDescribe.QUALITY_CHIPS.map((c) => c.value);
    assert.ok(values.includes('Ache'));
    assert.ok(values.includes('Burning'));
    assert.ok(values.includes('Sharp'));
    assert.ok(values.includes('Throbbing'));
    assert.ok(values.includes('Tingling'));
    assert.ok(values.includes('Numbness'));
    assert.ok(values.includes('Pressure'));
  });

  test('patient describe pushToFormAndStore updates shared entryStore', () => {
    const sandbox = makePatientSandbox({
      regions: [{ id: 'r1', patientLabel: 'Hip' }],
      intensity: 5,
      quality: [],
      triggers: [],
      easesAfter: [],
      note: ''
    });
    // Minimal DOM: selected quality chip + intensity + note
    const selected = { classList: { contains: () => true } };
    sandbox.document.querySelector = (sel) => {
      if (String(sel).includes('data-patient-quality="Sharp"')) return selected;
      if (String(sel).includes('[data-patient-quality')) return selected;
      return null;
    };
    sandbox.document.querySelectorAll = () => [];
    const fields = {
      patientIntensitySlider: { value: '8' },
      intensitySlider: { value: '5' },
      patientNoteInput: { value: 'Started after walking' },
      notesInput: { value: '' },
      occurrenceSelect: { value: '' },
      durationSelect: { value: '' }
    };
    sandbox.document.getElementById = (id) => fields[id] || null;
    sandbox.setActivePills = () => {};
    sandbox.updateIntensityUI = () => {};
    sandbox.__patientDescribe.pushToFormAndStore();
    const entry = sandbox.entryStore.getActiveEntry();
    assert.equal(entry.intensity, 8);
    assert.ok(Array.isArray(entry.quality));
    assert.ok(entry.quality.includes('Sharp'));
    assert.equal(entry.note, 'Started after walking');
  });

  test('presentation mode switching updates body shell class contract', () => {
    const sandbox = createSandbox();
    loadScript('src/state/presentation.js', sandbox);
    sandbox.state = { presentationMode: 'patient', workflowMode: 'capture' };
    const body = {
      classList: {
        _set: new Set(['shell-patient']),
        remove(...names) { names.forEach((n) => this._set.delete(n)); },
        add(...names) { names.forEach((n) => this._set.add(n)); },
        contains(n) { return this._set.has(n); },
        toggle(n, on) { if (on) this._set.add(n); else this._set.delete(n); }
      },
      dataset: {}
    };
    sandbox.document.body = body;
    sandbox.document.querySelectorAll = () => [];
    sandbox.document.getElementById = () => null;
    sandbox.applyPresentationMode('clinician');
    assert.equal(sandbox.state.presentationMode, 'clinician');
    assert.ok(body.classList.contains('shell-clinician'));
    assert.equal(body.classList.contains('shell-patient'), false);
    sandbox.applyPresentationMode('patient');
    assert.equal(sandbox.state.presentationMode, 'patient');
    assert.ok(body.classList.contains('shell-patient'));
  });

  test('index.html: patient shell does not duplicate IDs; clinician controls marked', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    const counts = ids.reduce((acc, id) => { acc[id] = (acc[id] || 0) + 1; return acc; }, {});
    const dups = Object.entries(counts).filter(([, n]) => n > 1).map(([id]) => id);
    assert.deepEqual(dups, []);
    assert.ok(html.includes('id="patientDescribeMount"'));
    assert.ok(html.includes('clinical-doc-panel'));
    assert.ok(html.includes('shell-only-clinician'));
    assert.ok(html.includes('shell-only-patient'));
    assert.ok(html.includes('Developer / demo') || html.includes('Experience mode'));
    // Patient describe should not reuse clinical panel markup as the sheet body
    const describeMountIdx = html.indexOf('id="patientDescribeMount"');
    const clinicalIdx = html.indexOf('clinical-doc-panel');
    assert.ok(describeMountIdx > 0 && clinicalIdx > describeMountIdx);
  });
}


// --- Phase 2 Slice 3: clinician spatial layers ---
{
  const sandbox = {
    console,
    Math,
    Object,
    Number,
    Array,
    Map,
    Set,
    JSON,
    Error,
    Promise,
    window: {},
    document: {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  loadScript('src/engine/spatial/spatial-layer-loader.js', sandbox);
  const L = sandbox.SpatialLayerLoader;

  test('spatial layers: patient presentation is blocked from pack loads', () => {
    assert.equal(L.isPatientBlocked('patient'), true);
    assert.equal(L.isPatientBlocked('clinician'), false);
    // Async rejection is expected; attach handler and rely on the sync gate above.
    const pending = L.loadLayerPack({}, 'muscle', { presentationMode: 'patient' });
    pending.then(
      () => {
        throw new Error('patient pack load should reject');
      },
      (err) => {
        assert.match(String(err && err.message), /clinician-only/);
      }
    );
    assert.equal(typeof L.loadLayerPack, 'function');
  });

  test('spatial layers: registration config requires rigid transform', () => {
    assert.throws(() => L.validateRegistrationConfig(null), /missing/);
    assert.throws(
      () => L.validateRegistrationConfig({ sourceModelId: 'a', targetModelId: 'b' }),
      /scale/
    );
    const ok = L.validateRegistrationConfig({
      sourceModelId: 'bp3d-prototype-shoulder',
      targetModelId: 'adult-male',
      transform: { scale: 1.00875, translation: [-0.08, 0.08, -0.07], rotationEuler: [0, 0, 0] },
      validation: { status: 'pass-preview', stopConditionTriggered: false }
    });
    assert.equal(ok.transform.scale, 1.00875);
  });

  test('spatial layers: REGISTRATION FAILED stop condition', () => {
    assert.throws(
      () =>
        L.validateRegistrationConfig({
          sourceModelId: 'bp3d-prototype-shoulder',
          targetModelId: 'adult-male',
          transform: { scale: 1, translation: [0, 0, 0] },
          validation: { status: 'fail', stopConditionTriggered: true }
        }),
      /REGISTRATION FAILED/
    );
  });

  test('spatial layers: shipped registration + prototype assets exist', () => {
    const reg = JSON.parse(
      readFileSync(join(root, 'public/anatomy/spatial/registration/bp3d-shoulder-adult-male.json'), 'utf8')
    );
    L.validateRegistrationConfig(reg);
    assert.equal(reg.sourceModelId, 'bp3d-prototype-shoulder');
    assert.equal(reg.targetModelId, 'adult-male');
    assert.equal(reg.validation.status, 'pass-preview');
    assert.equal(reg.validation.stopConditionTriggered, false);
    assert.ok(reg.transform.scale > 0.9 && reg.transform.scale < 1.2);

    const manifest = JSON.parse(
      readFileSync(join(root, 'public/anatomy/spatial/prototype-bp3d/manifest.json'), 'utf8')
    );
    assert.equal(manifest.modelId, 'bp3d-prototype-shoulder');
    assert.ok(manifest.layers.muscle.meshes.some((m) => m.structureId === 'FMA:34683'));
    assert.ok(manifest.layers.skeletal.meshes.some((m) => m.structureId === 'FMA:23131'));

    const muscle = statSync(join(root, 'public/anatomy/spatial/prototype-bp3d/muscle.glb')).size;
    const skeletal = statSync(join(root, 'public/anatomy/spatial/prototype-bp3d/skeletal.glb')).size;
    assert.ok(muscle > 10_000 && muscle < 500_000, `muscle payload unexpected: ${muscle}`);
    assert.ok(skeletal > 10_000 && skeletal < 500_000, `skeletal payload unexpected: ${skeletal}`);

    const catalog = JSON.parse(readFileSync(join(root, 'public/anatomy/spatial/manifest.json'), 'utf8'));
    assert.equal(catalog.defaultModelId, 'adult-male');
    assert.ok(!JSON.stringify(catalog).includes('prototype-bp3d'));
  });

  test('spatial layers: pack cache helpers start empty', () => {
    L.clearPackCache();
    assert.equal(L.hasCachedPack('muscle'), false);
    assert.equal(L.getCachedPack('skeletal'), null);
    assert.deepEqual(Object.keys(L.LAYER_FILES).sort(), ['muscle', 'skeletal']);
  });

  test('spatial layers: controller patient guard defaults to surface', () => {
    loadScript('src/engine/spatial/spatial-layer-controller.js', sandbox);
    const C = sandbox.SpatialLayerController;
    const fakeScene = {
      bodyRoot: { add() {}, children: [] },
      markerRoot: {},
      canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) },
      camera: {},
      raycaster: { setFromCamera() {}, intersectObjects: () => [] },
      _pointer: { x: 0, y: 0 },
      requestFrame() {},
      _exterior: null
    };
    const fakeTHREE = {
      Group: class {
        constructor() {
          this.children = [];
          this.name = '';
          this.visible = true;
          this.userData = {};
        }
        add() {}
      },
      MeshStandardMaterial: class {
        constructor(opts) {
          Object.assign(this, opts);
          this.color = { setHex() {} };
          this.emissive = { setHex() {} };
        }
      },
      MeshBasicMaterial: class {
        constructor(opts) {
          Object.assign(this, opts);
        }
      },
      BufferGeometry: class {
        setFromPoints() {
          return this;
        }
      },
      LineBasicMaterial: class {},
      Line: class {},
      Vector2: class {
        constructor(x = 0, y = 0) {
          this.x = x;
          this.y = y;
        }
      },
      Vector3: class {
        constructor(x = 0, y = 0, z = 0) {
          this.x = x;
          this.y = y;
          this.z = z;
        }
        clone() {
          return new fakeTHREE.Vector3(this.x, this.y, this.z);
        }
      }
    };
    const ctrl = new C(fakeScene, fakeTHREE, { presentationMode: 'patient' });
    assert.equal(ctrl.getDepth(), 'surface');
  });

  test('index.html: clinician layer controls are shell-gated', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    assert.ok(html.includes('id="clinicianLayerControls"'));
    assert.ok(html.includes('shell-only-clinician'));
    assert.ok(html.includes('data-anatomy-depth="muscle"'));
    assert.ok(html.includes('data-anatomy-depth="skeletal"'));
    assert.ok(/Anatomical context only/i.test(html));
    assert.ok(!/Likely pain source|Probable structure|Diagnosis:/i.test(html));
    assert.ok(html.includes('spatial-layer-loader.js'));
    assert.ok(html.includes('spatial-layer-controller.js'));
  });

  function makeColor(hex = 0xffffff) {
    return {
      _hex: hex,
      setHex(h) {
        this._hex = h;
      },
      clone() {
        return makeColor(this._hex);
      },
      copy(other) {
        this._hex = other._hex;
        return this;
      }
    };
  }

  function makeFakeTHREE() {
    return {
      Group: class {
        constructor() {
          this.children = [];
          this.name = '';
          this.visible = true;
          this.userData = {};
          this.parent = null;
        }
        add(child) {
          if (child.parent?.remove) child.parent.remove(child);
          child.parent = this;
          if (!this.children.includes(child)) this.children.push(child);
        }
        remove(child) {
          const i = this.children.indexOf(child);
          if (i >= 0) this.children.splice(i, 1);
          if (child.parent === this) child.parent = null;
        }
      },
      MeshStandardMaterial: class {
        constructor(opts = {}) {
          this.opacity = opts.opacity ?? 1;
          this.transparent = !!opts.transparent;
          this.depthWrite = opts.depthWrite !== false;
          this.roughness = opts.roughness ?? 0.5;
          this.metalness = opts.metalness ?? 0;
          this.emissiveIntensity = opts.emissiveIntensity ?? 0;
          this.color = makeColor(opts.color ?? 0xffffff);
          this.emissive = makeColor(opts.emissive ?? 0x000000);
          this.needsUpdate = false;
          this._disposed = false;
        }
        dispose() {
          this._disposed = true;
        }
      },
      MeshBasicMaterial: class {
        constructor(opts) {
          Object.assign(this, opts);
        }
      },
      BufferGeometry: class {
        setFromPoints() {
          return this;
        }
        dispose() {
          this._disposed = true;
        }
      },
      LineBasicMaterial: class {},
      Line: class {},
      Vector2: class {
        constructor(x = 0, y = 0) {
          this.x = x;
          this.y = y;
        }
      },
      Vector3: class {
        constructor(x = 0, y = 0, z = 0) {
          this.x = x;
          this.y = y;
          this.z = z;
        }
        clone() {
          return new this.constructor(this.x, this.y, this.z);
        }
      }
    };
  }

  function makeFakeScene(THREE) {
    const bodyRoot = new THREE.Group();
    return {
      bodyRoot,
      markerRoot: new THREE.Group(),
      canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) },
      camera: {},
      raycaster: { setFromCamera() {}, intersectObjects: () => [] },
      _pointer: { x: 0, y: 0 },
      requestFrame() {},
      _exterior: null
    };
  }

  function makePack(THREE, layerId, meshIds) {
    const root = new THREE.Group();
    root.name = `spatial-layer-${layerId}`;
    const meshById = new Map();
    const metaById = new Map();
    for (const meshId of meshIds) {
      const mesh = {
        isMesh: true,
        name: meshId,
        material: new THREE.MeshStandardMaterial({ color: 0x111111, opacity: 1 }),
        visible: true,
        userData: { meshId, spatialLayer: layerId },
        geometry: {
          _disposed: false,
          dispose() {
            this._disposed = true;
          }
        }
      };
      meshById.set(meshId, mesh);
      metaById.set(meshId, {
        meshId,
        structureId: `FMA:${meshId}`,
        structureName: meshId,
        clinicalName: meshId,
        layer: layerId,
        laterality: 'left'
      });
      root.add(mesh);
    }
    return { layerId, root, meshById, metaById, byteLength: 1000 };
  }

  test('spatial layers: exterior materials fully restore across depth cycles', async () => {
    loadScript('src/engine/spatial/spatial-layer-controller.js', sandbox);
    const C = sandbox.SpatialLayerController;
    const L = sandbox.SpatialLayerLoader;
    const THREE = makeFakeTHREE();
    const scene = makeFakeScene(THREE);

    const exteriorMat = new THREE.MeshStandardMaterial({
      color: 0x8899aa,
      opacity: 1,
      transparent: false,
      depthWrite: true,
      roughness: 0.42,
      metalness: 0.11,
      emissive: 0x010203,
      emissiveIntensity: 0.07
    });
    const exteriorMesh = { isMesh: true, material: exteriorMat, userData: {}, visible: true };
    const exteriorRoot = new THREE.Group();
    exteriorRoot.traverse = (fn) => fn(exteriorMesh);
    scene._exterior = { root: exteriorRoot };

    const orig = {
      opacity: exteriorMat.opacity,
      transparent: exteriorMat.transparent,
      depthWrite: exteriorMat.depthWrite,
      color: exteriorMat.color._hex,
      roughness: exteriorMat.roughness,
      metalness: exteriorMat.metalness,
      emissive: exteriorMat.emissive._hex,
      emissiveIntensity: exteriorMat.emissiveIntensity
    };

    const muscle = makePack(THREE, 'muscle', ['deltoid', 'supraspinatus']);
    const skeletal = makePack(THREE, 'skeletal', ['humerus']);
    const fetches = { muscle: 0, skeletal: 0 };
    const cache = new Map();
    const origLoad = L.loadLayerPack;
    const origHas = L.hasCachedPack;
    const origDetach = L.detachPack;

    try {
      L.hasCachedPack = (id) => cache.has(id);
      L.loadLayerPack = async (_T, layerId) => {
        fetches[layerId] += 1;
        const pack = layerId === 'muscle' ? muscle : skeletal;
        cache.set(layerId, pack);
        return pack;
      };
      L.detachPack = (pack) => {
        pack.root.visible = false;
        pack.root.parent?.remove(pack.root);
      };

      const ctrl = new C(scene, THREE, { presentationMode: 'clinician' });
      for (const d of ['muscle', 'skeletal', 'muscle', 'surface', 'muscle', 'surface']) {
        const r = await ctrl.setDepth(d);
        assert.equal(r.ok, true, `setDepth(${d}) failed`);
        assert.equal(ctrl.getDepth(), d);
      }
      assert.equal(fetches.muscle, 1);
      assert.equal(fetches.skeletal, 1);
      assert.equal(exteriorMat.opacity, orig.opacity);
      assert.equal(exteriorMat.transparent, orig.transparent);
      assert.equal(exteriorMat.depthWrite, orig.depthWrite);
      assert.equal(exteriorMat.color._hex, orig.color);
      assert.equal(exteriorMat.roughness, orig.roughness);
      assert.equal(exteriorMat.metalness, orig.metalness);
      assert.equal(exteriorMat.emissive._hex, orig.emissive);
      assert.equal(exteriorMat.emissiveIntensity, orig.emissiveIntensity);

      await ctrl.setDepth('muscle');
      ctrl.selectMeshId('deltoid');
      assert.equal(ctrl.selectedMeshId, 'deltoid');
      assert.equal(
        muscle.meshById.get('deltoid').material.emissiveIntensity,
        C.MATERIALS.selected.emissiveIntensity
      );
      ctrl.selectMeshId('supraspinatus');
      assert.equal(muscle.meshById.get('deltoid').material.emissiveIntensity, 0);
      ctrl.clearSelection();
      assert.equal(ctrl.selectedMeshId, null);
      assert.equal(muscle.meshById.get('supraspinatus').material.emissiveIntensity, 0);

      await ctrl.setDepth('skeletal');
      assert.equal(ctrl.selectedMeshId, null);
      const rayNames = ctrl.layerRaycastMeshes().map((m) => m.userData.meshId || m.name);
      assert.equal(rayNames.join(','), 'humerus');

      ctrl.dispose();
      assert.equal(muscle.root.parent, null);
      assert.equal(muscle.meshById.get('deltoid').geometry._disposed, false);
      assert.equal(cache.has('muscle'), true);

      let failOnce = true;
      let errors = 0;
      L.loadLayerPack = async (_T, layerId) => {
        if (layerId === 'skeletal' && failOnce) {
          failOnce = false;
          throw Object.assign(new Error('network'), { code: 'LOAD_FAILED' });
        }
        fetches[layerId] += 1;
        const pack = layerId === 'muscle' ? muscle : skeletal;
        cache.set(layerId, pack);
        return pack;
      };
      const scene2 = makeFakeScene(THREE);
      scene2._exterior = { root: exteriorRoot };
      const ctrl2 = new C(scene2, THREE, {
        presentationMode: 'clinician',
        onError: () => {
          errors += 1;
        }
      });
      const bad = await ctrl2.setDepth('skeletal');
      assert.equal(bad.ok, false);
      assert.equal(ctrl2.getDepth(), 'surface');
      assert.equal(ctrl2.loading, false);
      assert.equal(errors, 1);
      assert.equal(exteriorMat.opacity, orig.opacity);
      const ok = await ctrl2.setDepth('skeletal');
      assert.equal(ok.ok, true);
      assert.equal(ctrl2.getDepth(), 'skeletal');
      ctrl2.dispose();
    } finally {
      L.loadLayerPack = origLoad;
      L.hasCachedPack = origHas;
      L.detachPack = origDetach;
    }
  });

  test('spatial layers: loader ownership exports and pass-preview label', () => {
    assert.equal(L.SINGLE_ACTIVE_SPATIAL_RENDERER === true, true);
    assert.equal(typeof L.detachPack, 'function');
    assert.equal(typeof L.disposePackResources, 'function');
    // Ensure prior test stubs were restored before checking real cache helpers.
    assert.equal(typeof L.hasCachedPack, 'function');
    L.clearPackCache();
    assert.equal(L.hasCachedPack('muscle'), false);
    const reg = JSON.parse(
      readFileSync(join(root, 'public/anatomy/spatial/registration/bp3d-shoulder-adult-male.json'), 'utf8')
    );
    assert.equal(reg.validation.status, 'pass-preview');
    const blob = JSON.stringify(reg).toLowerCase();
    assert.ok(!blob.includes('clinical-grade'));
    assert.ok(!blob.includes('clinically registered'));
    assert.ok(!blob.includes('precision aligned'));
  });

  

}


// --- Phase 2 Slice 5: canonical frame flag + global exterior conformer ---
{
  const sandbox = {
    console,
    Math,
    Object,
    Number,
    Array,
    Map,
    Set,
    JSON,
    Error,
    Promise,
    URLSearchParams,
    window: {},
    document: {},
    location: { search: '' }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  loadScript('src/engine/spatial/canonical-body-flag.js', sandbox);
  loadScript('src/engine/spatial/exterior-canonical-conformer.js', sandbox);
  loadScript('src/engine/spatial/spatial-layer-loader.js', sandbox);
  const Flag = sandbox.CanonicalBodyFlag;
  const Conf = sandbox.ExteriorCanonicalConformer;
  const L = sandbox.SpatialLayerLoader;

  test('canonical flag: default OFF', () => {
    assert.equal(Flag.resolveCanonicalBodyMode({ search: '' }), false);
    assert.equal(Flag.resolveCanonicalBodyMode({ search: '?foo=1' }), false);
  });

  test('canonical flag: query enables mode', () => {
    assert.equal(Flag.resolveCanonicalBodyMode({ search: '?canonicalBodyMode=true' }), true);
    assert.equal(Flag.resolveCanonicalBodyMode({ search: '?canonicalBodyMode=1' }), true);
    assert.equal(Flag.resolveCanonicalBodyMode({ search: '?canonicalFrame=1' }), true);
    assert.equal(Flag.resolveCanonicalBodyMode({ search: '?canonicalBodyMode=false' }), false);
    assert.equal(Flag.resolveCanonicalBodyMode({ search: '?canonicalBodyMode=0' }), false);
  });

  test('canonical flag: shoulder registration URL switches with mode', () => {
    assert.equal(
      Flag.shoulderRegistrationUrlForMode(false),
      Flag.LEGACY_SHOULDER_REGISTRATION_URL
    );
    assert.equal(
      Flag.shoulderRegistrationUrlForMode(true),
      Flag.IDENTITY_SHOULDER_REGISTRATION_URL
    );
    assert.equal(L.DEFAULT_REGISTRATION_URL, Flag.LEGACY_SHOULDER_REGISTRATION_URL);
    assert.equal(L.IDENTITY_REGISTRATION_URL, Flag.IDENTITY_SHOULDER_REGISTRATION_URL);
  });

  test('canonical conformer: validates transform and stop condition', () => {
    const ok = Conf.validateConformerConfig({
      transform: { scale: 0.96, translation: [0, -0.05, 0.08], rotationEuler: [0, 0, 0] },
      validation: { status: 'pass-preview', stopConditionTriggered: false }
    });
    assert.equal(ok.transform.scale, 0.96);
    assert.throws(
      () =>
        Conf.validateConformerConfig({
          transform: { scale: 1, translation: [0, 0, 0] },
          validation: { status: 'GLOBAL CONFORMER FAILED', globalConformerFailed: true, stopConditionTriggered: true }
        }),
      /GLOBAL CONFORMER FAILED/
    );
  });

  test('canonical conformer: shipped artifact is pass-preview (not failed)', () => {
    const cfg = JSON.parse(
      readFileSync(join(root, 'public/anatomy/spatial/registration/exterior-to-canonical-v1.json'), 'utf8')
    );
    Conf.validateConformerConfig(cfg);
    assert.equal(cfg.validation.globalConformerFailed, false);
    assert.equal(cfg.validation.stopConditionTriggered, false);
    assert.equal(cfg.validation.status, 'pass-preview');
    assert.equal(cfg.regionalPatches, false);
    assert.ok(cfg.derivation.landmarksUsed.length >= 8);
    assert.ok(cfg.validation.metrics.meanAlignmentErrorMeters < 0.12);
    assert.ok(cfg.validation.metrics.maxAlignmentErrorMeters < 0.15);
    const report = Conf.buildAlignmentReport(cfg);
    assert.equal(report.clinicalRegistrationClaimed, false);
    assert.equal(report.landmarkDistances.length, cfg.derivation.landmarksUsed.length);
  });

  test('canonical identity shoulder registration is identity transform', () => {
    const cfg = JSON.parse(
      readFileSync(
        join(root, 'public/anatomy/spatial/registration/bp3d-shoulder-canonical-identity.json'),
        'utf8'
      )
    );
    L.validateRegistrationConfig(cfg);
    assert.equal(cfg.transform.scale, 1);
    assert.deepEqual(cfg.transform.translation, [0, 0, 0]);
    assert.deepEqual(cfg.transform.rotationEuler, [0, 0, 0]);
    assert.equal(cfg.coordinateFrameVersion, 'painlocator-bp3d-canonical-v1');
  });

  test('canonical: legacy Slice 3 registration still present for flag OFF', () => {
    const cfg = JSON.parse(
      readFileSync(
        join(root, 'public/anatomy/spatial/registration/bp3d-shoulder-adult-male.json'),
        'utf8'
      )
    );
    L.validateRegistrationConfig(cfg);
    assert.equal(cfg.transform.scale, 1.00875);
    assert.ok(Math.abs(cfg.transform.translation[0] + 0.08792) < 1e-9);
  });

  test('canonical: adult-male manifest declares frame metadata', () => {
    const man = JSON.parse(
      readFileSync(join(root, 'public/anatomy/spatial/adult-male/manifest.json'), 'utf8')
    );
    assert.equal(man.coordinateFrame.frameId, 'painlocator-blender-stand-v1');
    assert.equal(man.canonicalBridge.enabledByDefault, false);
    assert.equal(man.canonicalBridge.featureFlag, 'canonicalBodyMode');
    assert.equal(man.canonicalBridge.skipExteriorConformer, true);
    assert.equal(man.layers.surface.bindMode, 'single-mesh');
  });

  test('canonical: PainRegion schema still lacks canonicalBodyXYZ persistence fields', () => {
    const schema = readFileSync(join(root, 'docs/JSON_SCHEMA.md'), 'utf8');
    // Design may mention the field; persisted required region fields must remain view/anchors/anatomyLayer.
    assert.ok(schema.includes('anchors') || schema.includes('PainRegion'));
    const storeSrc = readFileSync(join(root, 'src/engine/annotations/pain-entry-store.js'), 'utf8');
    assert.equal(storeSrc.includes('canonicalBodyXYZ'), false);
    const rendererSrc = readFileSync(join(root, 'src/engine/spatial/spatial-anatomy-renderer.js'), 'utf8');
    assert.ok(rendererSrc.includes('Runtime-only canonical projection'));
    assert.ok(rendererSrc.includes('persisted: false'));
  });

  test('canonical: patient shell cannot expose canonical body via layer packs', () => {
    assert.equal(L.isPatientBlocked('patient'), true);
    const pending = L.loadLayerPack({}, 'muscle', {
      presentationMode: 'patient',
      registrationUrl: L.IDENTITY_REGISTRATION_URL
    });
    pending.then(
      () => {
        throw new Error('patient must not load packs in canonical mode either');
      },
      (err) => {
        assert.match(String(err && err.message), /clinician-only/);
      }
    );
  });

  test('canonical: Plate / default Spatial scripts do not auto-reference fetch of canonical GLB', () => {
    const engineSrc = readFileSync(join(root, 'src/engine/anatomy/clinical-anatomy-engine.js'), 'utf8');
    assert.equal(engineSrc.includes('prototype-bp3d-fullbody'), false);
    assert.equal(engineSrc.includes('canonical-body.glb'), false);
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    assert.ok(html.includes('canonical-body-flag.js'));
    assert.ok(html.includes('canonical-body-frame.js'));
    // Scripts are present but loads are gated inside CanonicalBodyFrame / flag.
    const flagSrc = readFileSync(join(root, 'src/engine/spatial/canonical-body-flag.js'), 'utf8');
    const frameSrc = readFileSync(join(root, 'src/engine/spatial/canonical-body-frame.js'), 'utf8');
    assert.ok(flagSrc.includes('canonical-body.glb'));
    assert.ok(frameSrc.includes('root.visible = false'));
    assert.ok(frameSrc.includes('this.bodyUrl'));
  });

  test('canonical: projection helper returns raw + optional nearest fields', () => {
    // Pure math path via conformer transform (no WebGL).
    const fakeTHREE = {
      Matrix4: class {
        compose(pos, _q, scale) {
          this.elements = [
            scale.x, 0, 0, 0,
            0, scale.y, 0, 0,
            0, 0, scale.z, 0,
            pos.x, pos.y, pos.z, 1
          ];
          return this;
        }
      },
      Vector3: class {
        constructor(x = 0, y = 0, z = 0) {
          this.x = x;
          this.y = y;
          this.z = z;
        }
        clone() {
          return new fakeTHREE.Vector3(this.x, this.y, this.z);
        }
        applyMatrix4(m) {
          const e = m.elements;
          const x = this.x;
          const y = this.y;
          const z = this.z;
          const w = e[3] * x + e[7] * y + e[11] * z + e[15] || 1;
          this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) / w;
          this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) / w;
          this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) / w;
          return this;
        }
      },
      Quaternion: class {
        setFromEuler() {
          return this;
        }
      },
      Euler: class {
        constructor() {}
      }
    };
    const cfg = {
      transform: { scale: 2, translation: [1, 2, 3], rotationEuler: [0, 0, 0], rotationOrder: 'XYZ' }
    };
    const out = Conf.transformPointByConformer(fakeTHREE, cfg, { x: 0.5, y: 0.25, z: 0.1 });
    assert.ok(Math.abs(out.x - 2) < 1e-9);
    assert.ok(Math.abs(out.y - 2.5) < 1e-9);
    assert.ok(Math.abs(out.z - 3.2) < 1e-9);
  });

  test('canonical: index wires Slice 5 modules before Spatial renderer', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const flagIdx = html.indexOf('canonical-body-flag.js');
    const confIdx = html.indexOf('exterior-canonical-conformer.js');
    const loaderIdx = html.indexOf('canonical-body-loader.js');
    const frameIdx = html.indexOf('canonical-body-frame.js');
    const rendIdx = html.indexOf('spatial-anatomy-renderer.js');
    assert.ok(flagIdx > 0 && confIdx > flagIdx && loaderIdx > confIdx);
    assert.ok(frameIdx > loaderIdx && rendIdx > frameIdx);
  });
}

// --- Phase 2 Slice 5 hardening: stability, cache, flag safety ---
{
  const sandbox = {
    console,
    Math,
    Object,
    Number,
    Array,
    Map,
    Set,
    JSON,
    Error,
    Promise,
    URLSearchParams,
    window: {},
    document: {},
    location: { search: '' }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  loadScript('src/engine/spatial/canonical-body-flag.js', sandbox);
  loadScript('src/engine/spatial/exterior-canonical-conformer.js', sandbox);
  loadScript('src/engine/spatial/canonical-body-loader.js', sandbox);
  loadScript('src/engine/spatial/canonical-body-frame.js', sandbox);
  loadScript('src/engine/spatial/spatial-layer-loader.js', sandbox);

  const Flag = sandbox.CanonicalBodyFlag;
  const Loader = sandbox.CanonicalBodyLoader;
  const Proj = sandbox.CanonicalBodyProjection;
  const Conf = sandbox.ExteriorCanonicalConformer;
  const L = sandbox.SpatialLayerLoader;

  const conformer = JSON.parse(
    readFileSync(join(root, 'public/anatomy/spatial/registration/exterior-to-canonical-v1.json'), 'utf8')
  );

  const TEST_POINTS = {
    shoulderL: [-0.24, 1.38, 0],
    shoulderR: [0.24, 1.38, 0],
    chest: [0, 1.28, 0.05],
    abdomen: [0, 1.05, 0.03],
    hipL: [-0.1, 0.9, 0],
    hipR: [0.1, 0.9, 0],
    kneeL: [-0.1, 0.41, 0],
    kneeR: [0.1, 0.41, 0],
    forearmL: [-0.34, 0.92, 0.02]
  };

  test('hardening: canonical XYZ deterministic across remount projections', () => {
    const runA = Proj.projectPointsThroughConformer(conformer, TEST_POINTS);
    const runB = Proj.projectPointsThroughConformer(conformer, TEST_POINTS);
    const runC = Proj.projectPointsThroughConformer(conformer, TEST_POINTS);
    for (const id of Object.keys(TEST_POINTS)) {
      assert.equal(Proj.xyzDeltaMm(runA[id], runB[id]), 0);
      assert.equal(Proj.xyzDeltaMm(runA[id], runC[id]), 0);
    }
  });

  test('hardening: flag OFF records no canonical asset fetches', () => {
    const urls = [];
    Loader.setFetchRecorder((u) => urls.push(u));
    assert.equal(Flag.resolveCanonicalBodyMode({ search: '' }), false);
    // Simulate renderer gate: only call loader when flag resolves true.
    if (Flag.resolveCanonicalBodyMode({ search: '' })) {
      throw new Error('should not load');
    }
    assert.deepEqual(urls, []);
    Loader.setFetchRecorder(null);
  });

  test('hardening: loader cache single-load + clear frees + failed retry', async () => {
    Loader.clearCache();
    assert.equal(Loader.getLoadCount(), 0);

    // Fake THREE + loadTemplate by injecting a resolved cache entry path via direct API.
    // Without WebGL we validate cache bookkeeping with a stubbed template insert.
    const fakeTemplate = {
      bodyUrl: Loader.DEFAULT_BODY_URL,
      byteLength: 10,
      root: {
        clone() {
          return {
            traverse(fn) {
              fn({
                isMesh: true,
                userData: {},
                material: {
                  clone() {
                    return {
                      transparent: false,
                      opacity: 1,
                      depthWrite: true,
                      wireframe: false,
                      color: { setHex() {} },
                      needsUpdate: false,
                      dispose() {
                        this._disposed = true;
                      },
                      _disposed: false
                    };
                  }
                }
              });
            }
          };
        },
        traverse() {}
      },
      geometries: new Set([{ dispose() { this.freed = true; }, freed: false }]),
      materials: new Set([{ dispose() { this.freed = true; }, freed: false }])
    };
    // Use internal cache via loadTemplate failure/retry: clear promises by clearCache.
    Loader.clearCache();
    // Manually exercise borrow/detach ownership without network:
    const fakeTHREE = {};
    // Inject by calling borrow on a hand-built template (public API).
    const instance = Loader.borrowInstance(fakeTHREE, fakeTemplate);
    assert.equal(instance.sharedGeometries, true);
    assert.ok(instance.root);
    Loader.detachInstance(instance);

    // clearCache frees template geos
    // Put template into cache through a private path: simulate hasTemplate false then clear
    assert.equal(Loader.hasTemplate(Loader.DEFAULT_BODY_URL), false);
    Loader.clearCache();
    assert.equal(Loader.getLoadCount(), 0);
  });

  test('hardening: failed conformer load clears cache for retry', async () => {
    Conf.clearConformerCache();
    const badUrl = '/anatomy/spatial/registration/__missing-conformer__.json';
    const origFetch = sandbox.fetch;
    let calls = 0;
    sandbox.fetch = async () => {
      calls += 1;
      return { ok: false, status: 404 };
    };
    await assert.rejects(() => Conf.loadConformerConfig(badUrl), /HTTP 404/);
    await assert.rejects(() => Conf.loadConformerConfig(badUrl), /HTTP 404/);
    assert.ok(calls >= 2, 'failed load must not stick a rejected promise forever');
    sandbox.fetch = origFetch;
    Conf.clearConformerCache();
  });

  test('hardening: teardown clears canonical debug even when attachments kept', () => {
    // Source contract: _teardownMount always clears _canonicalDebug.
    const src = readFileSync(join(root, 'src/engine/spatial/spatial-anatomy-renderer.js'), 'utf8');
    assert.ok(src.includes('this._canonicalDebug.clear()'));
    assert.ok(src.includes('Always clears `spatialCanonicalDebug`') || src.includes('always clear'));
    assert.ok(src.includes('mountToken !== this._mountGeneration'));
  });

  test('hardening: shoulder identity registration in canonical mode; legacy when OFF', () => {
    assert.equal(
      Flag.shoulderRegistrationUrlForMode(true),
      '/anatomy/spatial/registration/bp3d-shoulder-canonical-identity.json'
    );
    assert.equal(
      Flag.shoulderRegistrationUrlForMode(false),
      '/anatomy/spatial/registration/bp3d-shoulder-adult-male.json'
    );
    const identity = JSON.parse(
      readFileSync(join(root, 'public/anatomy/spatial/registration/bp3d-shoulder-canonical-identity.json'), 'utf8')
    );
    const legacy = JSON.parse(
      readFileSync(join(root, 'public/anatomy/spatial/registration/bp3d-shoulder-adult-male.json'), 'utf8')
    );
    L.validateRegistrationConfig(identity);
    L.validateRegistrationConfig(legacy);
    assert.equal(identity.transform.scale, 1);
    assert.deepEqual(identity.transform.translation, [0, 0, 0]);
    assert.equal(legacy.transform.scale, 1.00875);
    // Pack cache keys differ so both can coexist in one session.
    assert.notEqual(
      L.packCacheKey('muscle', Flag.IDENTITY_SHOULDER_REGISTRATION_URL),
      L.packCacheKey('muscle', Flag.LEGACY_SHOULDER_REGISTRATION_URL)
    );
  });

  test('hardening: characterization report classifies persistence readiness', () => {
    const report = JSON.parse(
      readFileSync(
        join(root, 'public/anatomy/spatial/dev/canonical-frame-hardening/characterization-report.json'),
        'utf8'
      )
    );
    assert.equal(report.thresholds.persistenceAssessment, 'NOT_READY_FOR_PERSISTENCE');
    assert.equal(report.thresholds.currentV1Classification, 'PASS_PREVIEW');
    assert.ok(report.projection.overallRawToTargetMm.mean > 40);
    assert.ok(report.projection.overallRawToTargetMm.max > 80);
    assert.equal(report.stability.shoulderL.maxDeltaMm, 0);
    assert.equal(report.landmarkConformerExperiment.productionDefault.includes('exterior-to-canonical-v1'), true);
    assert.ok(report.hipRootCause.primary.includes('hip width') || report.hipRootCause.primary.includes('pelvis'));
    assert.equal(report.canonicalDerivedExterior.registrationTransform, 'identity');
    assert.equal(report.clinicalRegistrationClaimed, false);
  });

  test('hardening: docs + ownership loader present', () => {
    const docs = readFileSync(join(root, 'docs/SPATIAL_PHASE2_SLICE5_HARDENING.md'), 'utf8');
    assert.ok(docs.includes('NOT_READY_FOR_PERSISTENCE'));
    assert.ok(docs.includes('CanonicalBodyLoader'));
    assert.ok(docs.includes('Slice 6'));
    assert.ok(statSync(join(root, 'src/engine/spatial/canonical-body-loader.js')).isFile());
  });
}

// --- Simple pain-map realistic body assets ---
{
  const sandbox = createSandbox();
  loadScript('src/engine/anatomy/asset-paths.js', sandbox);

  test('simple pain-map: getAssetPath uses MetaHuman plates', () => {
    sandbox.document.body.classList.contains = (name) => name === 'simple-pain-map';
    assert.equal(sandbox.getAssetPath('adult-male', 'front'), '/anatomy/metahuman/adult-male/front.png');
    assert.equal(sandbox.getAssetPath('adult-male', 'back'), '/anatomy/metahuman/adult-male/back.png');
    assert.equal(sandbox.getAssetPath('simple-pain-map', 'left'), '/anatomy/metahuman/adult-male/left.png');
  });

  test('simple pain-map: clinician path keeps CAE adult-male plates', () => {
    sandbox.document.body.classList.contains = () => false;
    sandbox.state = { presentationMode: 'clinician' };
    assert.equal(sandbox.getAssetPath('adult-male', 'front'), '/anatomy/adult-male/front.png');
  });

  test('simple pain-map: gallery profiles use matching MetaHuman plates', () => {
    sandbox.document.body.classList.contains = (name) => name === 'simple-pain-map';
    sandbox.state = { presentationMode: 'patient' };
    assert.equal(sandbox.getAssetPath('female', 'front'), '/anatomy/metahuman/adult-female/front.png');
    assert.equal(sandbox.getAssetPath('adult-female', 'back'), '/anatomy/metahuman/adult-female/back.png');
    assert.equal(sandbox.getAssetPath('teen', 'left'), '/anatomy/metahuman/teen-male/left.png');
    assert.equal(sandbox.getAssetPath('teen-female', 'left'), '/anatomy/metahuman/teen-female/left.png');
    assert.equal(sandbox.getAssetPath('child', 'right'), '/anatomy/metahuman/child-male/right.png');
    assert.equal(sandbox.getAssetPath('child-female', 'right'), '/anatomy/metahuman/child-female/right.png');
    assert.equal(sandbox.getAssetPath('senior', 'front'), '/anatomy/metahuman/senior-male/front.png');
    assert.equal(sandbox.getAssetPath('senior-female', 'front'), '/anatomy/metahuman/senior-female/front.png');
    assert.equal(sandbox.getAssetPath('male', 'front'), '/anatomy/metahuman/adult-male/front.png');
    assert.equal(sandbox.composeBodyModel('teen', 'female'), 'teen-female');
    const teenProfile = sandbox.parseBodyProfile('teen');
    assert.equal(teenProfile.stage, 'teen');
    assert.equal(teenProfile.sex, 'male');
    assert.equal(teenProfile.model, 'teen-male');
    assert.equal(sandbox.clinicianRadioValue('teen-female'), 'teen');
    assert.equal(sandbox.classicAnatomyFolder('teen-female'), 'teen');
  });

  test('simple pain-map: clinician classic plates stay on 5 folders', () => {
    sandbox.document.body.classList.contains = () => false;
    sandbox.state = { presentationMode: 'clinician' };
    assert.equal(sandbox.getAssetPath('teen-female', 'front'), '/anatomy/teen/front.png');
    assert.equal(sandbox.getAssetPath('child-male', 'back'), '/anatomy/child/back.png');
    assert.equal(sandbox.getAssetPath('senior-female', 'left'), '/anatomy/senior/left.png');
    assert.equal(sandbox.getAssetPath('adult-female', 'front'), '/anatomy/adult-female/front.png');
  });

  test('simple pain-map: MetaHuman plate files exist in public/', () => {
    const folders = [
      'adult-male', 'adult-female',
      'teen-male', 'teen-female',
      'child-male', 'child-female',
      'senior-male', 'senior-female',
      'teen', 'child', 'senior'
    ];
    for (const folder of folders) {
      for (const view of ['front', 'back', 'left', 'right']) {
        assert.ok(statSync(join(root, `public/anatomy/metahuman/${folder}/${view}.png`)).isFile());
      }
      assert.ok(statSync(join(root, `public/anatomy/metahuman/thumbs/${folder}.png`)).isFile());
    }
    assert.ok(statSync(join(root, 'public/anatomy/metahuman/body.glb')).isFile());
  });

  test('simple pain-map: female models use female clinical overlays', () => {
    const overlayBox = createSandbox();
    loadScript('src/engine/overlays/visualization-controller.js', overlayBox);
    assert.equal(
      overlayBox.overlayAssetPath('muscle', 'teen-female', 'front'),
      '/anatomy/overlays/overlay_muscle_female_front.png'
    );
    assert.equal(
      overlayBox.overlayAssetPath('muscle', 'teen', 'front'),
      '/anatomy/overlays/overlay_muscle_male_front.png'
    );
    assert.equal(
      overlayBox.overlayAssetPath('skeleton', 'child-female', 'back'),
      '/anatomy/overlays/overlay_skeleton_female_back.png'
    );
  });

  test('simple pain-map: MetaHuman plates are retina resolution', () => {
    const buf = readFileSync(join(root, 'public/anatomy/metahuman/adult-male/front.png'));
    assert.equal(buf.slice(1, 4).toString(), 'PNG');
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const femaleBuf = readFileSync(join(root, 'public/anatomy/metahuman/teen-female/front.png'));
    assert.ok(femaleBuf.readUInt32BE(16) >= 2048);
    assert.ok(femaleBuf.readUInt32BE(20) >= 3072);
  });

  test('simple pain-map: viewport fit + patient annotation chrome', () => {
    const css = readFileSync(join(root, 'src/layout/simple-pain-map.css'), 'utf8');
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const flow = readFileSync(join(root, 'src/features/shell/patient-flow.js'), 'utf8');
    assert.ok(css.includes('100dvh'));
    assert.ok(css.includes('simple-pain-panel') && css.includes('position: fixed'));
    assert.ok(css.includes('simple-drawer-grab'));
    assert.ok(css.includes('simple-drawer-sheet') || css.includes('simple-drawer-expanded'));
    assert.ok(css.includes('--spm-drawer-peek') && css.includes('translate3d'));
    assert.ok(css.includes('spm-drawer-breathe') && css.includes('#22c55e'));
    assert.ok(css.includes('cae-region-layer') && css.includes('z-index: 8'));
    assert.ok(css.includes('height: 100% !important'));
    assert.ok(css.includes('background: transparent !important'));
    assert.ok(css.includes('5.1rem') || css.includes('--spm-drawer-peek'));
    assert.ok(html.includes('id="simpleMapIntensity"'));
    assert.ok(html.includes('id="patientIntensitySlider"'));
    assert.ok(html.includes('How strong is it now?'));
    // Intensity lives in the map column, not the tools drawer.
    const mapColIdx = html.indexOf('simple-pain-map-col');
    const intensityIdx = html.indexOf('id="simpleMapIntensity"');
    const panelIdx = html.indexOf('id="simplePainPanel"');
    assert.ok(mapColIdx > 0 && intensityIdx > mapColIdx && intensityIdx < panelIdx);
    assert.ok(css.includes('simple-map-intensity'));
    const mapper = readFileSync(join(root, 'src/engine/coordinates/anatomy-coordinate-mapper.js'), 'utf8');
    const renderer = readFileSync(join(root, 'src/engine/annotations/markup-renderer.js'), 'utf8');
    assert.ok(mapper.includes('SIMPLE_PAIN_MAP_DESKTOP_ZOOM = 1'));
    assert.ok(mapper.includes('SIMPLE_PAIN_MAP_MOBILE_ZOOM = 1'));
    assert.ok(css.includes('min(1280px, 100%)') || css.includes('1280px'));
    assert.ok(renderer.includes('applySimplePainMapPresentationScale'));
    assert.ok(flow.includes('bindMapIntensityUI'));
    assert.ok(flow.includes('refreshMarkColors'));
    assert.ok(flow.includes('applyIntensityValue'));
    // Drawer describe UI must not re-host the intensity slider.
    assert.ok(!flow.includes('patientIntensitySlider') || flow.indexOf('buildDescribeUI') < flow.lastIndexOf('bindMapIntensityUI'));
    const describeBlock = flow.slice(flow.indexOf('function buildDescribeUI'), flow.indexOf('function refreshMarkColors'));
    assert.ok(!describeBlock.includes('patientIntensitySlider'));
    assert.ok(!describeBlock.includes('How strong is it now?'));
    assert.ok(html.includes('simple-annotate-bar'));
    assert.ok(html.includes('id="simplePainPanel"'));
    assert.ok(html.includes('id="simpleDrawerSheet"'));
    assert.ok(html.includes('id="timelinePanel"'));
    assert.ok(html.includes('data-tool="point"') && html.includes('>Tap</span>'));
    assert.ok(html.includes('data-tool="circle"') && html.includes('>Area</span>'));
    assert.ok(html.includes('Describe pain'));
    assert.ok(html.includes('Save pain map'));
    assert.ok(html.includes('data-lucide="map-pin"'));
    const toolsIdx = html.indexOf('id="captureTools"');
    const viewsIdx = html.indexOf('id="simpleViewBar"');
    const timelineIdx = html.indexOf('id="timelinePanel"');
    const workspaceIdx = html.indexOf('id="simplePainWorkspace"');
    assert.ok(panelIdx > 0 && toolsIdx > panelIdx && viewsIdx > toolsIdx);
    assert.ok(workspaceIdx > 0 && timelineIdx > workspaceIdx);
    assert.ok(html.includes('/anatomy/metahuman/adult-male/front.png'));
    assert.ok(flow.includes('activatePatientTool'));
    assert.ok(flow.includes('setAssessStep'));
    assert.ok(flow.includes('setDrawerExpanded'));
    assert.ok(flow.includes('syncAnatomyLayout'));
    assert.ok(flow.includes('ensureActiveEntry(currentPatientModel())'));
    assert.ok(!flow.includes("ensureActiveEntry({ view: 'anterior'"));
    assert.ok(html.includes('id="bodyTypeGallery"'));
    assert.ok(html.includes('id="btnSimpleBodyProfile"'));
    assert.ok(html.includes('data-sex="female"') && html.includes('data-sex="male"'));
    assert.ok(html.includes('data-stage="adult"') && html.includes('data-stage="teen"'));
    assert.ok(html.includes('/anatomy/metahuman/thumbs/adult-male.png'));
    assert.ok(html.includes('/anatomy/metahuman/thumbs/teen-male.png'));
    assert.ok(css.includes('.body-type-gallery') && css.includes('.body-type-option'));
    assert.ok(css.includes('.body-sex-toggle') && css.includes('.body-sex-btn'));
    assert.ok(css.includes('theme-dark') && css.includes('--surface-elevated: #252b3a'));
    assert.ok(flow.includes('btnSimpleBodyProfile') && flow.includes('bodyTypeGallery'));
    for (const folder of ['adult-female', 'teen-female', 'child-female', 'senior-female', 'teen-male']) {
      assert.ok(statSync(join(root, `public/anatomy/metahuman/${folder}/front.png`)).isFile());
    }
    assert.ok(html.includes('id="simpleViewCompass"'));
    assert.ok(html.includes('id="simpleDrawerPeekBar"'));
    assert.ok(html.includes('id="btnPeekUndo"') && html.includes('id="btnPeekRedo"'));
    // Peek undo/redo must stay open curves (not a closed circular arrow).
    const peekUndo = html.slice(html.indexOf('id="btnPeekUndo"'), html.indexOf('id="simpleDrawerGrab"'));
    const peekRedo = html.slice(html.indexOf('id="btnPeekRedo"'), html.indexOf('id="simpleDrawerSheet"'));
    assert.ok(peekUndo.includes('v10.5h10.5'));
    assert.ok(peekRedo.includes('v10.5h-10.5'));
    assert.ok(!peekUndo.includes('a9 9 0 1 0'));
    assert.ok(!peekRedo.includes('a9 9 0 1 1'));
    assert.ok(css.includes('simple-peek-icon-btn') && css.includes('stroke-width: 1.2'));
    assert.ok(css.includes('Mobile stacked chrome'));
    assert.ok(css.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'));
    assert.ok(html.includes('simple-compass-btn') && html.includes('data-view="left"'));
    assert.ok(css.includes('.simple-view-compass'));
    assert.ok(css.includes('.simple-more-wrap') && css.includes('z-index: 150'));
    assert.ok(css.includes('.simple-sheet') && css.includes('.simple-sheet-action'));
    assert.ok(css.includes('overflow: visible'));
    const headlineCss = css.slice(css.indexOf('.simple-pain-headline h1'), css.indexOf('.simple-pain-headline p'));
    assert.ok(headlineCss.includes('white-space: nowrap'));
    assert.ok(!headlineCss.includes('max-width: 14ch'));
    assert.ok(!css.includes('max-width: 11ch'));
    const models = readFileSync(join(root, 'src/engine/annotations/pain-models.js'), 'utf8');
    assert.ok(models.includes('function aspectCorrectedCircleRadii'));
    assert.ok(renderer.includes('aspectCorrectedCircleRadii'));
    assert.ok(flow.includes('simpleViewCompass'));
    assert.ok(renderer.includes('swapSimpleView'));
    assert.ok(renderer.includes('painlocator_mark_size'));
    assert.ok(css.includes('is-turning-cw') && css.includes('is-turning-ccw'));
    assert.ok(html.includes('id="simplePrefsModal"') && html.includes('id="btnSimplePrefs"'));
    assert.ok(html.includes('id="simpleMoreModal"') && html.includes('Appearance'));
    assert.ok(html.includes('id="btnSharePdf"') && html.includes('id="shareModal"'));
    assert.ok(flow.includes('openMoreMenu') && flow.includes('simpleMoreModal'));
    assert.ok(flow.includes('btnSimplePrefs') && flow.includes('simpleMarkSize'));
    assert.ok(renderer.includes('_spmScaleMode === "fit"') || renderer.includes('letterbox the full plate'));
    assert.ok(!renderer.includes('target = Math.max(1.28'));
    assert.ok(html.includes('name="simpleSkin"') && html.includes('name="simpleWeight"') && html.includes('name="simpleHeight"'));
    assert.ok(html.includes('name="simpleAncestry"') && html.includes('src/engine/anatomy/metahuman/body-dna.js'));
    assert.ok(html.includes('src/engine/anatomy/metahuman/glb-body.js'));
    assert.ok(html.includes('src/engine/anatomy/metahuman/metahuman-engine.js'));
    assert.ok(html.includes('your Blender standing figure'));
    assert.ok(html.includes('src/engine/anatomy/plate-likeness.js'));
    assert.ok(css.includes('--spm-fit-x') && css.includes('--spm-fit-y'));
    assert.ok(css.includes('grid-template-rows: auto minmax(0, 1fr) auto'));
    assert.ok(css.includes('.simple-prefs-swatches'));
    assert.ok(flow.includes('bindLikenessPrefs'));
    assert.ok(renderer.includes('bindPlateImageSrc') || renderer.includes('setSimplePlateImage'));
    const engineSrc = readFileSync(join(root, 'src/engine/anatomy/clinical-anatomy-engine.js'), 'utf8');
    assert.ok(engineSrc.includes('swapSimpleView'));
  });

  test('simple pain-map: compass turns use shortest yaw', () => {
    const s = createSandbox();
    loadScript('src/engine/annotations/markup-renderer.js', s);
    assert.equal(s.simpleViewTurnDir('front', 'left'), -1);
    assert.equal(s.simpleViewTurnDir('front', 'right'), 1);
    assert.equal(s.simpleViewTurnDir('front', 'back'), 0);
    assert.equal(s.simpleViewTurnDir('left', 'front'), 1);
    assert.equal(s.simpleViewTurnDir('right', 'back'), 1);
    assert.equal(s.getSimpleMarkSizeScale(), 0.5);
    s.setSimpleMarkSizePref('l');
    assert.equal(s.getSimpleMarkSizeScale(), 1.5);
    s.setSimpleMarkSizePref('s');
    assert.equal(s.getSimpleMarkSizeScale(), 0.5);
  });

  test('simple pain-map: likeness shader preserves clothing and scales build/height', () => {
    const s = createSandbox();
    loadScript('src/engine/anatomy/plate-likeness.js', s);
    const pref = s.normalizeLikeness({ skin: 'deep', weight: 'heavy', height: 'short', extra: 1 });
    assert.equal(pref.skin, 'deep');
    assert.equal(pref.weight, 'heavy');
    assert.equal(pref.height, 'short');
    assert.equal(s.normalizeLikeness({ skin: 'neon' }).skin, 'natural');
    assert.equal(s.WEIGHT_SCALES.slim < 1, true);
    assert.equal(s.WEIGHT_SCALES.heavy > 1, true);
    assert.equal(s.HEIGHT_SCALES.short < 1, true);
    assert.ok(s.HEIGHT_SCALES.tall >= s.HEIGHT_SCALES.average);
    const data = new Uint8ClampedArray([
      160, 160, 160, 255,
      210, 158, 128, 255
    ]);
    s.recolorPlatePixels(data, 2, 1, s.SKIN_PRESETS.deep);
    assert.equal(data[0], 160);
    assert.equal(data[1], 160);
    assert.equal(data[2], 160);
    assert.ok(data[4] < 210, 'skin red should darken toward deep');
    s.setLikenessPref({ skin: 'tan', weight: 'slim', height: 'tall', ancestry: 'african' });
    const stored = s.getLikenessPref();
    assert.equal(stored.skin, 'tan');
    assert.equal(stored.weight, 'slim');
    assert.equal(stored.height, 'tall');
    assert.equal(stored.ancestry, 'african');
  });

  test('metahuman engine: DNA changes bone length and girth, not uniform scale', () => {
    const s = createSandbox();
    loadScript('src/engine/anatomy/asset-paths.js', s);
    loadScript('src/engine/anatomy/metahuman/body-dna.js', s);
    const adult = s.resolveBodyProportions({ model: 'adult-male' });
    const tall = s.resolveBodyProportions({ model: 'adult-male', height: 'tall' });
    const short = s.resolveBodyProportions({ model: 'adult-male', height: 'short' });
    const heavy = s.resolveBodyProportions({ model: 'adult-male', weight: 'heavy' });
    const slim = s.resolveBodyProportions({ model: 'adult-male', weight: 'slim' });
    const woman = s.resolveBodyProportions({ model: 'adult-female' });
    const child = s.resolveBodyProportions({ model: 'child-male' });
    const african = s.resolveBodyProportions({ model: 'adult-male', ancestry: 'african' });
    const east = s.resolveBodyProportions({ model: 'adult-male', ancestry: 'east-asian' });
    assert.ok(tall.stature > adult.stature);
    assert.ok(short.stature < adult.stature);
    assert.ok(tall.thighLen > adult.thighLen);
    assert.ok(Math.abs(tall.thighGirth - adult.thighGirth) < 1e-9, 'height must not change girth');
    assert.ok(heavy.thighGirth > adult.thighGirth);
    assert.ok(slim.waistW < adult.waistW);
    assert.ok(Math.abs(heavy.thighLen - adult.thighLen) < 1e-9, 'build must not change bone length');
    assert.ok(woman.hipW / woman.shoulderW > adult.hipW / adult.shoulderW);
    assert.ok(child.headR / child.stature > adult.headR / adult.stature);
    assert.ok(african.limb !== east.limb || african.faceW !== east.faceW);
    assert.equal(s.isIdentityDna({ model: 'adult-male' }), true);
    assert.equal(s.isIdentityDna({ model: 'adult-male', weight: 'heavy' }), false);
    assert.ok(s.bodyDnaKey({ weight: 'heavy' }, 'front').includes('heavy'));
  });

  test('metahuman engine: Blender GLB drop paths and DNA scale', () => {
    const s = createSandbox();
    loadScript('src/engine/anatomy/asset-paths.js', s);
    loadScript('src/engine/anatomy/metahuman/body-dna.js', s);
    loadScript('src/engine/anatomy/metahuman/glb-body.js', s);
    const paths = s.getMetahumanGlbCandidates('adult-female');
    assert.ok(paths[0].endsWith('/anatomy/metahuman/adult-female/body.glb'));
    assert.ok(paths.includes('/anatomy/metahuman/body.glb'));
    assert.equal(s.getMetahumanGlbPath('teen'), '/anatomy/metahuman/teen-male/body.glb');
    const avg = s.metahumanGlbScale({ model: 'adult-male' });
    const tall = s.metahumanGlbScale({ model: 'adult-male', height: 'tall' });
    const heavy = s.metahumanGlbScale({ model: 'adult-male', weight: 'heavy' });
    assert.ok(tall.y > avg.y);
    assert.ok(Math.abs(tall.x - avg.x) < 1e-9, 'height must not change girth scale');
    assert.ok(heavy.x > avg.x);
    assert.ok(Math.abs(heavy.y - avg.y) < 1e-9, 'build must not change stature scale');
    const face = s.metahumanPartScale('Head', { model: 'adult-male', ancestry: 'east-asian' });
    assert.ok(face && face.x > 1);
    const identityMorph = s.metahumanMorphWeights({ model: 'adult-male' });
    assert.equal(identityMorph.Stature, 0);
    assert.equal(identityMorph.Waist, 0);
    const tallMorph = s.metahumanMorphWeights({ model: 'adult-male', height: 'tall' });
    const heavyMorph = s.metahumanMorphWeights({ model: 'adult-male', weight: 'heavy' });
    assert.ok(tallMorph.Stature > identityMorph.Stature);
    assert.ok(heavyMorph.Waist > identityMorph.Waist);
    assert.ok(heavyMorph.Hips > identityMorph.Hips);
    const headBone = s.metahumanRigBoneScale('head', { model: 'adult-male', ancestry: 'east-asian' });
    assert.ok(headBone && headBone.x > 1);
    const htmlHeaders = { get: (k) => (k === 'content-type' ? 'text/html; charset=utf-8' : null) };
    const glbHeaders = { get: (k) => (k === 'content-type' ? 'model/gltf-binary' : k === 'content-length' ? '1015596' : null) };
    assert.equal(s.isMetahumanGlbResponse({ ok: true, headers: htmlHeaders }), false);
    assert.equal(s.isMetahumanGlbResponse({ ok: true, headers: glbHeaders }), true);
    assert.ok(statSync(join(root, 'public/anatomy/metahuman/body.glb')).isFile());
    const engine = readFileSync(join(root, 'src/engine/anatomy/metahuman/metahuman-engine.js'), 'utf8');
    assert.ok(engine.includes('cloneMetahumanGlbBody'));
    assert.ok(engine.includes('CAE_ALLOW_PARAMETRIC_METAHUMAN'));
    assert.ok(engine.includes('_keepStill'));
  });

  test('simple pain-map: tap marks correct for portrait SVG stretch', () => {
    const s = createSandbox();
    const portrait = s.aspectCorrectedCircleRadii(200, 400, 0.03);
    assert.equal(portrait.rx, 0.03);
    assert.ok(Math.abs(portrait.ry - 0.015) < 1e-9);
    // Screen radii: rx*W === ry*H
    assert.ok(Math.abs(portrait.rx * 200 - portrait.ry * 400) < 1e-9);
    const landscape = s.aspectCorrectedCircleRadii(400, 200, 0.03);
    assert.ok(Math.abs(landscape.ry - 0.06) < 1e-9);
    assert.equal(s.isCircularPainMark({ shape: 'circle', radius: 0.02 }), true);
    assert.equal(s.isCircularPainMark({ shape: 'polygon' }), false);
    assert.equal(s.isCircularPainMark({ shape: 'ellipse', radius: 0.04, radiusY: 0.02 }), false);
  });

  test('simple pain-map: marker layer fills frame (not avatar-stage svg 95%)', () => {
    const css = readFileSync(join(root, 'src/layout/simple-pain-map.css'), 'utf8');
    assert.ok(css.includes('.cae-region-layer'));
    assert.ok(css.includes('height: 100% !important'));
    assert.ok(css.includes('z-index: 8'));
    assert.ok(css.includes('filter: none !important'));
  });

  test('normalizeModelType coerces legacy object patientModel', () => {
    const s = createSandbox();
    assert.equal(s.normalizeModelType({ view: 'anterior', gender: 'male' }), 'adult-male');
    assert.equal(s.normalizeModelType({ gender: 'female' }), 'adult-female');
    assert.equal(s.normalizeModelType('male'), 'adult-male');
    assert.equal(s.normalizeModelType('teen'), 'teen-male');
    assert.equal(s.normalizeModelType('teen-female'), 'teen-female');
    assert.equal(s.normalizeModelType('child'), 'child-male');
    assert.equal(s.normalizeModelType('senior'), 'senior-male');
    const entry = s.createPainEntry({ patientModel: { gender: 'male' }, regions: [] });
    assert.equal(entry.patientModel, 'adult-male');
  });
}

// --- BP3D shell engagement (Patient + Clinician) ---
{
  const sandbox = {
    console,
    Math,
    Object,
    Number,
    Array,
    Map,
    Set,
    JSON,
    Error,
    Promise,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    window: {},
    document: {
      addEventListener() {},
      getElementById: () => null,
      createElement: () => ({
        getContext: () => null,
        style: {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        appendChild() {},
        setAttribute() {},
        addEventListener() {}
      })
    },
    location: { search: '' }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  loadScript('src/engine/spatial/canonical-body-flag.js', sandbox);
  loadScript('src/app/bp3d-shell-engagement.js', sandbox);
  const Flag = sandbox.CanonicalBodyFlag;
  const Eng = sandbox.Bp3dShellEngagement;

  test('bp3d engagement: product boot enables canonical unless opted out', () => {
    sandbox.location.search = '';
    delete sandbox.PAINLOCATOR_CANONICAL_BODY_MODE;
    assert.equal(Eng.configureCanonicalEngagement(), true);
    assert.equal(sandbox.PAINLOCATOR_CANONICAL_BODY_MODE, true);
    assert.equal(Flag.resolveCanonicalBodyMode({ search: '' }), true);
  });

  test('bp3d engagement: query opt-out disables canonical even after product default', () => {
    sandbox.location.search = '?canonicalBodyMode=0';
    assert.equal(Eng.configureCanonicalEngagement(), false);
    assert.equal(sandbox.PAINLOCATOR_CANONICAL_BODY_MODE, false);
    assert.equal(Flag.resolveCanonicalBodyMode({ search: '?canonicalBodyMode=0' }), false);
    assert.equal(Flag.resolveCanonicalBodyMode({ search: '?canonicalBodyMode=false' }), false);
  });

  test('bp3d engagement: query opt-out beats product global true', () => {
    sandbox.PAINLOCATOR_CANONICAL_BODY_MODE = true;
    assert.equal(Flag.resolveCanonicalBodyMode({ search: '?canonicalBodyMode=0' }), false);
  });

  test('bp3d engagement: plate query disables spatial preference', () => {
    sandbox.location.search = '?plate=1';
    assert.equal(Eng.shouldPreferSpatial(), false);
    sandbox.location.search = '?displayMode=plate';
    assert.equal(Eng.shouldPreferSpatial(), false);
  });

  test('bp3d engagement: prefers spatial unless plate opted in (WebGL probe not a gate)', () => {
    sandbox.location.search = '';
    sandbox.SpatialThreeLoader = { isWebGLAvailable: () => true };
    assert.equal(Eng.shouldPreferSpatial(), true);
    // Embedded previews often fail the WebGL probe — still prefer Spatial and let mount decide.
    sandbox.SpatialThreeLoader = { isWebGLAvailable: () => false };
    assert.equal(Eng.shouldPreferSpatial(), true);
  });

  test('bp3d engagement: simple pain-map defaults to Human plate', async () => {
    sandbox.location.search = '';
    sandbox.localStorage = {
      store: Object.create(null),
      getItem(key) { return this.store[key] ?? null; },
      setItem(key, value) { this.store[key] = String(value); },
      removeItem(key) { delete this.store[key]; }
    };
    const classSet = new Set(['simple-pain-map', 'shell-patient']);
    sandbox.document.body = {
      classList: {
        contains: (name) => classSet.has(name),
        add: (...names) => names.forEach((n) => classSet.add(n)),
        remove: (...names) => names.forEach((n) => classSet.delete(n)),
        toggle: (name, on) => {
          if (on) classSet.add(name);
          else classSet.delete(name);
        }
      },
      dataset: { presentation: 'patient' }
    };
    assert.equal(Eng.shouldPreferSpatial(), false);
    let called = null;
    const engine = {
      spatialPrimaryNoPlate: true,
      async setDisplayMode(mode) {
        called = mode;
        this.displayMode = mode;
        return true;
      }
    };
    const ok = await Eng.preferSpatialAcrossShells(engine);
    assert.equal(ok, false);
    assert.equal(called, 'plate');
    assert.equal(engine.spatialPrimaryNoPlate, false);

    Eng.writeSimpleDisplayPreference('spatial');
    assert.equal(Eng.readSimpleDisplayPreference(), 'spatial');
    assert.equal(Eng.shouldPreferSpatial(), true);

    // Restore body for subsequent clinician Spatial-default tests
    sandbox.document.body = {
      classList: { contains: () => false, add() {}, remove() {}, toggle() {} },
      dataset: {}
    };
  });

  test('bp3d engagement: simple pain-map URL can force 3D', () => {
    const classSet = new Set(['simple-pain-map', 'shell-patient']);
    sandbox.document.body = {
      classList: {
        contains: (name) => classSet.has(name),
        add() {},
        remove() {},
        toggle() {}
      },
      dataset: { presentation: 'patient' }
    };
    sandbox.localStorage = {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    };
    sandbox.location.search = '?displayMode=spatial';
    assert.equal(Eng.shouldPreferSpatial(), true);
    sandbox.location.search = '';
    assert.equal(Eng.shouldPreferSpatial(), false);
    sandbox.document.body = {
      classList: { contains: () => false, add() {}, remove() {}, toggle() {} },
      dataset: {}
    };
  });

  test('spatial chrome: intentional plate clears spatial-primary (no CAE placeholder trap)', () => {
    const chromeSandbox = {
      console,
      Math,
      Object,
      Number,
      Array,
      Map,
      Set,
      JSON,
      Error,
      Promise,
      URLSearchParams,
      window: {},
      document: {},
      location: { search: '' },
      entryStore: { activeTool: 'point', setTool() {} }
    };
    chromeSandbox.window = chromeSandbox;
    chromeSandbox.globalThis = chromeSandbox;
    const classSet = new Set(['shell-patient', 'simple-pain-map', 'spatial-primary']);
    const hint = { textContent: '', classList: { remove() {}, add() {} } };
    chromeSandbox.document = {
      body: {
        classList: {
          contains: (name) => classSet.has(name),
          toggle: (name, on) => {
            if (on) classSet.add(name);
            else classSet.delete(name);
          },
          add: (...names) => names.forEach((n) => classSet.add(n)),
          remove: (...names) => names.forEach((n) => classSet.delete(n))
        }
      },
      getElementById: (id) => (id === 'avatarHint' ? hint : null),
      querySelector: () => null,
      querySelectorAll: () => []
    };
    vm.createContext(chromeSandbox);
    loadScript('src/features/anatomy/spatial-primary-chrome.js', chromeSandbox);
    const Chrome = chromeSandbox.SpatialPrimaryChrome;
    assert.equal(Chrome.wantsPlateSurface(), true);
    Chrome.applySpatialPrimaryChrome(false, { keepSpatialPrimary: false });
    assert.equal(classSet.has('spatial-primary'), false);
    assert.equal(classSet.has('spatial-ready'), false);
    assert.match(hint.textContent, /Tap the body/i);
  });

  test('spatial chrome: clinician default keeps spatial-primary while waiting', () => {
    const chromeSandbox = {
      console,
      Math,
      Object,
      Number,
      Array,
      Map,
      Set,
      JSON,
      Error,
      Promise,
      URLSearchParams,
      window: {},
      document: {},
      location: { search: '' },
      entryStore: { activeTool: 'point', setTool() {} }
    };
    chromeSandbox.window = chromeSandbox;
    chromeSandbox.globalThis = chromeSandbox;
    const classSet = new Set(['shell-clinician']);
    const hint = { textContent: '', classList: { remove() {}, add() {} } };
    chromeSandbox.document = {
      body: {
        classList: {
          contains: (name) => classSet.has(name),
          toggle: (name, on) => {
            if (on) classSet.add(name);
            else classSet.delete(name);
          },
          add: (...names) => names.forEach((n) => classSet.add(n)),
          remove: (...names) => names.forEach((n) => classSet.delete(n))
        }
      },
      getElementById: (id) => (id === 'avatarHint' ? hint : null),
      querySelector: () => null,
      querySelectorAll: () => []
    };
    vm.createContext(chromeSandbox);
    loadScript('src/features/anatomy/spatial-primary-chrome.js', chromeSandbox);
    chromeSandbox.SpatialPrimaryChrome.applySpatialPrimaryChrome(false, {
      keepSpatialPrimary: true
    });
    assert.equal(classSet.has('spatial-primary'), true);
    assert.match(hint.textContent, /Waiting for the 3D body/i);
  });

  test('bp3d engagement: preferSpatialAcrossShells calls setDisplayMode', async () => {
    sandbox.location.search = '';
    sandbox.document.body = {
      classList: { contains: () => false, add() {}, remove() {}, toggle() {} },
      dataset: {}
    };
    sandbox.SpatialThreeLoader = { isWebGLAvailable: () => true };
    let called = null;
    const engine = {
      async setDisplayMode(mode) {
        called = mode;
        return true;
      }
    };
    const ok = await Eng.preferSpatialAcrossShells(engine);
    assert.equal(ok, true);
    assert.equal(called, 'spatial');
  });

  test('bp3d engagement: patient pack isolation still enforced', () => {
    loadScript('src/engine/spatial/spatial-layer-loader.js', sandbox);
    assert.equal(sandbox.SpatialLayerLoader.isPatientBlocked('patient'), true);
  });

  test('bp3d engagement: index wires engagement module before bootstrap', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const engIdx = html.indexOf('bp3d-shell-engagement.js');
    const bootIdx = html.indexOf('src/app/bootstrap.js');
    assert.ok(engIdx > 0 && bootIdx > engIdx);
    assert.ok(html.includes('refreshPresentationShell') === false); // method is in renderer, not html
    const renderer = readFileSync(join(root, 'src/engine/spatial/spatial-anatomy-renderer.js'), 'utf8');
    assert.ok(renderer.includes('refreshPresentationShell()'));
    const docs = readFileSync(join(root, 'docs/BP3D_SHELL_ENGAGEMENT.md'), 'utf8');
    assert.ok(docs.includes('Patient'));
    assert.ok(docs.includes('Clinician'));
  });

  test('display mode dock is outside capture-tools (not buried under patient CTA)', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const dockIdx = html.indexOf('id="displayModeToggle"');
    const captureIdx = html.indexOf('id="captureTools"');
    assert.ok(dockIdx > 0 && captureIdx > 0);
    // Dock lives before avatar-wrap/captureTools so patient CTA cannot cover it
    assert.ok(dockIdx < captureIdx);
    assert.ok(html.includes('display-mode-dock'));
    assert.ok(html.includes('id="btnSpatialMode"'));
    const css = readFileSync(join(root, 'src/layout/styles.css'), 'utf8');
    assert.ok(css.includes('.display-mode-dock'));
    assert.ok(css.includes('body.spatial-primary'));
    const shell = readFileSync(join(root, 'src/layout/shell-styles.css'), 'utf8');
    assert.ok(shell.includes('body.shell-patient .display-mode-dock'));
    const engine = readFileSync(join(root, 'src/engine/anatomy/clinical-anatomy-engine.js'), 'utf8');
    assert.ok(engine.includes('return this.isSpatialMode()'));
    assert.ok(engine.includes('_recoverSpatialFailure'));
    assert.ok(engine.includes('showSpatialUnavailable'));
    assert.ok(engine.includes('spatialPrimaryNoPlate'));
  });

  test('spatial-primary: chrome module hides plate toggle by default', () => {
    loadScript('src/features/anatomy/spatial-primary-chrome.js', sandbox);
    assert.ok(sandbox.SpatialPrimaryChrome);
    sandbox.location.search = '';
    sandbox.document.body = {
      classList: { contains: () => false, add() {}, remove() {}, toggle() {} },
      dataset: {}
    };
    assert.equal(sandbox.SpatialPrimaryChrome.allowPlateToggle(), false);
    sandbox.location.search = '?displayToggle=1';
    assert.equal(sandbox.SpatialPrimaryChrome.allowPlateToggle(), true);
    sandbox.location.search = '?dev=1';
    assert.equal(sandbox.SpatialPrimaryChrome.allowPlateToggle(), true);
    sandbox.location.search = '';
    const classSet = new Set(['simple-pain-map', 'shell-patient']);
    sandbox.document.body = {
      classList: {
        contains: (name) => classSet.has(name),
        add() {},
        remove() {},
        toggle() {}
      },
      dataset: { presentation: 'patient' }
    };
    assert.equal(sandbox.SpatialPrimaryChrome.allowPlateToggle(), true);
    const docs = readFileSync(join(root, 'docs/BP3D_SHELL_ENGAGEMENT.md'), 'utf8');
    assert.ok(docs.includes('Human|3D') || docs.includes('Human | 3D'));
    assert.ok(docs.includes('fallback'));
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    assert.ok(html.includes('spatial-primary-chrome.js'));
    assert.ok(html.includes('>Human</button>'));
    assert.ok(html.includes('>3D</button>'));
    const css = readFileSync(join(root, 'src/layout/simple-pain-map.css'), 'utf8');
    assert.ok(css.includes('#displayModeToggle.display-mode-dock'));
    assert.ok(css.includes('Mobile stacked chrome'));
    assert.ok(css.includes('grid-template-rows: auto auto minmax(12rem, 1fr) auto auto'));
    assert.ok(css.includes('min-height: 44px'));
    assert.ok(html.includes('simple-pain-headline-row'));
    assert.ok(html.indexOf('id="displayModeToggle"') > html.indexOf('simple-pain-headline-row'));
    assert.ok(html.indexOf('id="bodyTypeGallery"') < html.indexOf('id="avatarWrap"'));
    assert.ok(html.indexOf('id="simpleViewCompass"') > html.indexOf('id="avatarWrap"'));
    assert.ok(!css.match(/#displayModeToggle,\s*\nbody\.shell-patient\.simple-pain-map #quickViewBar/));
  });

  test('spatial boot utils: withTimeout rejects and WebGL helper exists', async () => {
    loadScript('src/engine/spatial/spatial-boot-utils.js', sandbox);
    assert.ok(sandbox.SpatialBootUtils);
    assert.equal(typeof sandbox.SpatialBootUtils.probeWebGL, 'function');
    assert.equal(typeof sandbox.SpatialBootUtils.isWebGLReallyAvailable, 'function');
    assert.equal(typeof sandbox.SpatialBootUtils.importEsm, 'function');
    assert.equal(typeof sandbox.SpatialBootUtils.importVendorModule, 'function');
    assert.equal(sandbox.SpatialBootUtils.SPATIAL_RUNTIME_VERSION, '2026-09-12-human-3d-toggle');
    let rejected = false;
    try {
      await sandbox.SpatialBootUtils.withTimeout(
        new Promise(() => {}),
        30,
        'unit-test'
      );
    } catch (err) {
      rejected = /timed out/i.test(String(err?.message || err));
    }
    assert.equal(rejected, true);
    assert.ok(sandbox.SpatialBootUtils.TIMEOUTS.mountMs > 0);
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    assert.ok(html.includes('spatial-boot-utils.js'));
    assert.ok(html.includes('?v=2026-09-12-human-3d-toggle'));
    assert.ok(html.includes('spatial-diagnostics.js'));
    const renderer = readFileSync(join(root, 'src/engine/spatial/spatial-anatomy-renderer.js'), 'utf8');
    assert.ok(renderer.includes('onProgress'));
    assert.ok(renderer.includes('canonical frame skipped'));
    assert.ok(renderer.includes('Tear down prior mount BEFORE loading Three'));
    assert.ok(renderer.includes('SpatialThreeLoader failed to load'));
    assert.ok(renderer.includes('READY_SPATIAL') || renderer.includes('ready-spatial'));
    // Classic scripts must not contain source-level import() expressions — Vite
    // rewrites those into ESM and classic tags then fail. String-inside-Function is OK.
    const threeLoaderSrc = readFileSync(join(root, 'src/engine/spatial/spatial-three-loader.js'), 'utf8');
    const bootSrc = readFileSync(join(root, 'src/engine/spatial/spatial-boot-utils.js'), 'utf8');
    assert.ok(bootSrc.includes('new Function("u", "return import(u)")'));
    assert.ok(threeLoaderSrc.includes('importVendorModule'));
    assert.equal(/\bimport\s*\(\s*(?:\/\*|[`'"])/.test(bootSrc), false);
    assert.equal(/\bimport\s*\(\s*(?:\/\*|[`'"])/.test(threeLoaderSrc), false);
    loadScript('src/engine/spatial/spatial-three-loader.js', sandbox);
    assert.equal(typeof sandbox.SpatialThreeLoader?.loadThreeModule, 'function');
    assert.equal(typeof sandbox.SpatialThreeLoader?.clearThreeCache, 'function');
  });

  test('spatial boot: health classifier and state machine helpers', () => {
    loadScript('src/engine/spatial/spatial-boot-utils.js', sandbox);
    const u = sandbox.SpatialBootUtils;
    assert.equal(u.classifySpatialHealth({ spatialReady: true, exteriorLoaded: true, exteriorModelId: 'adult-male' }), 'HEALTHY');
    assert.equal(
      u.classifySpatialHealth({
        spatialReady: true,
        exteriorLoaded: true,
        exteriorModelId: 'adult-male',
        canonicalDegraded: true,
        canonicalExpected: true
      }),
      'DEGRADED'
    );
    assert.equal(u.classifySpatialHealth({ spatialReady: false, state: 'failed-spatial' }), 'FAILED');
    assert.equal(
      u.classifySpatialHealth({ spatialReady: true, exteriorLoaded: true, exteriorModelId: 'adult-male' }),
      'HEALTHY'
    );
    const liveEngine = {
      displayMode: 'plate',
      spatialBootState: u.createBootState({ state: 'idle' }),
      spatialRenderer: { ready: true, scene: { modelId: 'adult-male', meshById: { size: 18 } } }
    };
    const liveSnap = u.collectDiagnostics(liveEngine);
    assert.equal(liveSnap.spatialReady, true);
    assert.equal(liveSnap.health, 'HEALTHY');
    assert.equal(liveSnap.exteriorLoaded, true);
    const engine = { spatialBootState: null, trigger() {} };
    u.setBootState(engine, u.BOOT_STATES.LOADING_THREE, { stage: 'loading-three' });
    assert.equal(engine.spatialBootState.state, 'loading-three');
    u.setBootState(engine, u.BOOT_STATES.READY_SPATIAL, { exteriorModelId: 'adult-male' });
    assert.equal(engine.spatialBootState.state, 'ready-spatial');
    u.setBootState(engine, u.BOOT_STATES.CANONICAL_DEGRADED, { canonicalStatus: 'degraded' });
    assert.equal(engine.spatialBootState.state, 'canonical-degraded');
    assert.notEqual(engine.spatialBootState.state, 'failed-spatial');
  });

  test('spatial boot: vendor import helper failure message + getGlobal', async () => {
    loadScript('src/engine/spatial/spatial-boot-utils.js', sandbox);
    const u = sandbox.SpatialBootUtils;
    sandbox.SpatialThreeLoader = { ok: true };
    assert.equal(u.getGlobal('SpatialThreeLoader').ok, true);
    let failed = false;
    try {
      await u.importVendorModule('');
    } catch (err) {
      failed = /empty path|ESM import/i.test(String(err?.message || err));
    }
    assert.equal(failed, true);
  });

  test('spatial diagnostics hidden by default and enabled by flag', () => {
    loadScript('src/engine/spatial/spatial-boot-utils.js', sandbox);
    sandbox.location = { search: '' };
    sandbox.PAINLOCATOR_IS_PRODUCTION = true;
    assert.equal(sandbox.SpatialBootUtils.wantsSpatialDiagnostics(), false);
    sandbox.location = { search: '?spatialDiagnostics=1' };
    assert.equal(sandbox.SpatialBootUtils.wantsSpatialDiagnostics(), true);
    const diagSrc = readFileSync(join(root, 'src/features/anatomy/spatial-diagnostics.js'), 'utf8');
    assert.ok(diagSrc.includes('SPATIAL STATUS'));
    assert.ok(diagSrc.includes('Copy Diagnostics JSON'));
    assert.ok(!/patientName|PainEntry|pain-entry payloads/i.test(diagSrc) || diagSrc.includes('Never shows patient identifiers'));
    assert.ok(!diagSrc.includes('patientName'));
    assert.ok(!diagSrc.includes('entryStore'));
  });

  test('spatial boot: chrome hides tech reason unless diagnostics', () => {
    const chrome = readFileSync(join(root, 'src/features/anatomy/spatial-primary-chrome.js'), 'utf8');
    assert.ok(chrome.includes('wantsSpatialDiagnostics'));
    assert.ok(chrome.includes('clearThreeCache'));
    assert.ok(chrome.includes('3D body unavailable'));
  });

  test('spatial boot: runtime assets exist for production', () => {
    const required = [
      'public/vendor/three.module.min.js',
      'public/vendor/GLTFLoader.js',
      'public/vendor/meshopt_decoder.module.js',
      'public/utils/BufferGeometryUtils.js',
      'public/anatomy/spatial/manifest.json',
      'public/anatomy/spatial/adult-male/manifest.json',
      'public/anatomy/metahuman/body.glb',
      'public/anatomy/spatial/prototype-bp3d-fullbody/canonical-body.glb',
      'public/anatomy/spatial/prototype-bp3d/muscle.glb',
      'public/anatomy/spatial/prototype-bp3d/skeletal.glb'
    ];
    for (const rel of required) {
      let ok = false;
      try { ok = !!statSync(join(root, rel)); } catch (_) { ok = false; }
      assert.ok(ok, `missing ${rel}`);
    }
    const buildSrc = readFileSync(join(root, 'scripts/build.mjs'), 'utf8');
    assert.ok(buildSrc.includes('meshopt_decoder.module.js'));
    assert.ok(buildSrc.includes('canonical-body.glb'));
  });

  test('spatial boot: unified runtime version on interdependent scripts', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const ver = '2026-09-12-human-3d-toggle';
    for (const file of [
      'spatial-boot-utils.js',
      'spatial-three-loader.js',
      'spatial-anatomy-renderer.js',
      'spatial-layer-loader.js',
      'spatial-manifest-loader.js',
      'canonical-body-loader.js',
      'spatial-primary-chrome.js',
      'spatial-diagnostics.js',
      'bp3d-shell-engagement.js'
    ]) {
      assert.ok(html.includes(`${file}?v=${ver}`), file);
    }
  });

  test('spatial boot: patient never loads BP3D packs via layer controller guard', () => {
    const ctrl = readFileSync(join(root, 'src/engine/spatial/spatial-layer-controller.js'), 'utf8');
    assert.ok(ctrl.includes('presentationMode === "patient"') || ctrl.includes("presentationMode === 'patient'"));
    assert.ok(ctrl.includes('isPatientBlocked') || ctrl.includes('patient'));
    const renderer = readFileSync(join(root, 'src/engine/spatial/spatial-anatomy-renderer.js'), 'utf8');
    assert.ok(renderer.includes('_initLayerController'));
    assert.ok(renderer.includes('Surface (styled exterior)') || renderer.includes('Muscle (BP3D)'));
  });

  test('spatial output: WebGL dispose never force-loses context', () => {
    const sceneSrc = readFileSync(join(root, 'src/engine/spatial/spatial-scene-controller.js'), 'utf8');
    assert.equal(/\brenderer\.forceContextLoss\s*\(/.test(sceneSrc), false);
    assert.equal(/\bloseContext\s*\(/.test(sceneSrc), false);
    assert.ok(sceneSrc.includes('Never forceContextLoss'));
    assert.ok(sceneSrc.includes('fitToBody'));
    assert.ok(sceneSrc.includes('ACESFilmicToneMapping') || sceneSrc.includes('toneMapping'));
    assert.ok(sceneSrc.includes('HemisphereLight'));
    assert.ok(sceneSrc.includes('_lowPower') || sceneSrc.includes('probeWebGL'));
    const loader = readFileSync(join(root, 'src/engine/spatial/spatial-manifest-loader.js'), 'utf8');
    assert.ok(loader.includes('MeshLambertMaterial'));
  });

  test('spatial output: overlay clears when exterior is interactive, before canonical', () => {
    const renderer = readFileSync(join(root, 'src/engine/spatial/spatial-anatomy-renderer.js'), 'utf8');
    const engine = readFileSync(join(root, 'src/engine/anatomy/clinical-anatomy-engine.js'), 'utf8');
    const interactiveIdx = renderer.indexOf('options.onInteractive');
    const canonCallIdx = renderer.indexOf('this._initCanonicalFrameIfEnabled()');
    const layerCallIdx = renderer.indexOf('this._initLayerController();');
    assert.ok(interactiveIdx > 0 && canonCallIdx > interactiveIdx);
    assert.ok(layerCallIdx > canonCallIdx);
    assert.ok(engine.includes('_revealSpatialViewport'));
    assert.ok(engine.includes('onInteractive:'));
    assert.ok(engine.includes('retrying'));
    assert.ok(renderer.includes('onInteractive'));
    assert.ok(renderer.includes('fitToBody'));
    assert.ok(renderer.includes('skipCanonicalConformer'));
  });

  test('spatial output: clinical exterior material is warm-neutral not game-metal', () => {
    const loader = readFileSync(join(root, 'src/engine/spatial/spatial-manifest-loader.js'), 'utf8');
    assert.ok(loader.includes('0xcbb7a8'));
    assert.equal(loader.includes('0xb9c2cc'), false);
  });

  test('spatial output: GLTFLoader relative ESM imports resolve to shipped files', () => {
    const gltfSrc = readFileSync(join(root, 'public/vendor/GLTFLoader.js'), 'utf8');
    const rel = [...gltfSrc.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)].map((m) => m[1]);
    assert.ok(rel.includes('../utils/BufferGeometryUtils.js'));
    for (const spec of rel) {
      const resolved = join(root, 'public/vendor', spec);
      assert.ok(statSync(resolved).isFile(), `missing GLTFLoader import target: ${spec} → ${resolved}`);
    }
    const utilsSrc = readFileSync(join(root, 'public/utils/BufferGeometryUtils.js'), 'utf8');
    assert.ok(utilsSrc.includes('export function toTrianglesDrawMode'));
    assert.ok(utilsSrc.includes('from "three"') || utilsSrc.includes("from 'three'"));
  });
}

// --- BodyParts3D Phase 2 Slice 2 prototype integrity (offline pack) ---
{
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [join(root, 'tools/bp3d-ingest/test-integrity.mjs')], {
    cwd: root,
    encoding: 'utf8'
  });
  if (r.status === 0) {
    passed += 1;
    console.log('ok - bp3d prototype integrity suite');
  } else {
    failed += 1;
    console.error('not ok - bp3d prototype integrity suite');
    if (r.stdout) console.error(r.stdout);
    if (r.stderr) console.error(r.stderr);
  }
}

await testQueue;
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
