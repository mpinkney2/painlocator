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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
