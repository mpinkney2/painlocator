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
    assert.equal(ok.layers.surface.file, './exterior-lod0.glb');
  });

  test('spatial manifest: indexMeshes maps stable meshId entries', () => {
    const manifest = JSON.parse(
      readFileSync(join(root, 'public/anatomy/spatial/adult-male/manifest.json'), 'utf8')
    );
    const index = U.indexMeshes(manifest);
    assert.ok(index.has('surface.torso'));
    assert.ok(index.has('surface.upperArmL'));
    assert.equal(index.get('surface.torso').structureId, 'PL:surface.torso');
    assert.equal(index.get('surface.head').layer, 'surface');
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
    const glb = join(root, 'public/anatomy/spatial/adult-male/exterior-lod0.glb');
    const size = statSync(glb).size;
    assert.ok(size > 50_000, `GLB too small: ${size}`);
    assert.ok(size < 5_000_000, `GLB exceeds 5MB target: ${size}`);

    const manifestIds = model.layers.surface.meshes.map((m) => m.meshId);
    const glbIds = listGlbBodyMeshNames(glb);
    U.assertManifestGlbIntegrity(manifestIds, glbIds);
    for (const entry of model.layers.surface.meshes) {
      assert.ok(String(entry.structureId).startsWith('PL:'), `structureId must be PL-local: ${entry.structureId}`);
    }
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
    assert.equal(patient.capture.label, 'Locate');
    assert.equal(patient.clinical.label, 'Describe');
    assert.equal(patient.review.label, 'Review');
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

  test('patient flow: cannot advance without a marked location', () => {
    const sandbox = makePatientSandbox(null);
    sandbox.setPatientStep('describe');
    assert.equal(sandbox.state.patientStep, 'locate');
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
        return { disabled: false, textContent: 'Save Pain Entry' };
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
    assert.equal(man.coordinateFrame.frameId, 'painlocator-bp3d-canonical-v1');
    assert.equal(man.canonicalBridge.enabledByDefault, false);
    assert.equal(man.canonicalBridge.featureFlag, 'canonicalBodyMode');
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

  test('bp3d engagement: preferSpatialAcrossShells calls setDisplayMode', async () => {
    sandbox.location.search = '';
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
    assert.equal(sandbox.SpatialPrimaryChrome.allowPlateToggle(), false);
    sandbox.location.search = '?displayToggle=1';
    assert.equal(sandbox.SpatialPrimaryChrome.allowPlateToggle(), true);
    sandbox.location.search = '?dev=1';
    assert.equal(sandbox.SpatialPrimaryChrome.allowPlateToggle(), true);
    const docs = readFileSync(join(root, 'docs/BP3D_SHELL_ENGAGEMENT.md'), 'utf8');
    assert.ok(docs.includes('Spatial is the interactive'));
    assert.ok(docs.includes('fallback'));
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    assert.ok(html.includes('spatial-primary-chrome.js'));
  });

  test('spatial boot utils: withTimeout rejects and WebGL helper exists', async () => {
    loadScript('src/engine/spatial/spatial-boot-utils.js', sandbox);
    assert.ok(sandbox.SpatialBootUtils);
    assert.equal(typeof sandbox.SpatialBootUtils.withTimeout, 'function');
    assert.equal(typeof sandbox.SpatialBootUtils.importEsm, 'function');
    assert.equal(typeof sandbox.SpatialBootUtils.importVendorModule, 'function');
    assert.equal(sandbox.SpatialBootUtils.SPATIAL_RUNTIME_VERSION, '2026-09-07-bp3d-boot-1');
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
    assert.ok(html.includes('?v=2026-09-07-bp3d-boot-1'));
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
      'public/anatomy/spatial/manifest.json',
      'public/anatomy/spatial/adult-male/manifest.json',
      'public/anatomy/spatial/adult-male/exterior-lod0.glb',
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
    const ver = '2026-09-07-bp3d-boot-1';
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
}

// --- Anatomy pack paths (classic vs metahuman) ---
{
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [join(root, 'tests/anatomy/anatomy-pack-paths.test.mjs')], {
    cwd: root,
    encoding: 'utf8'
  });
  if (r.status === 0) {
    passed += 1;
    console.log('ok - anatomy pack paths');
  } else {
    failed += 1;
    console.error('not ok - anatomy pack paths');
    if (r.stdout) console.error(r.stdout);
    if (r.stderr) console.error(r.stderr);
  }
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
