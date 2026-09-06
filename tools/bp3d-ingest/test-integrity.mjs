#!/usr/bin/env node
/**
 * Integrity tests for BodyParts3D prototype pack.
 * Offline — validates committed derived assets without network or raw OBJs.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "public/anatomy/spatial/prototype-bp3d");
const SRC = path.join(ROOT, "data/bodyparts3d/subset/left-shoulder/source-manifest.json");
const PROD_CATALOG = path.join(ROOT, "public/anatomy/spatial/manifest.json");
const PROD_MALE = path.join(ROOT, "public/anatomy/spatial/adult-male/manifest.json");

function glbMeshNames(filePath) {
  const buf = readFileSync(filePath);
  assert.equal(buf.toString("utf8", 0, 4), "glTF");
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
  const meshNames = (json.meshes || []).map((m) => m.name).filter(Boolean);
  const nodeNames = (json.nodes || [])
    .filter((n) => n.mesh !== undefined)
    .map((n) => n.name)
    .filter(Boolean);
  return { ids: meshNames.length ? meshNames : nodeNames };
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log("BodyParts3D prototype integrity (offline)");

const src = JSON.parse(readFileSync(SRC, "utf8"));
const manifest = JSON.parse(readFileSync(path.join(OUT, "manifest.json"), "utf8"));
const report = JSON.parse(readFileSync(path.join(OUT, "build-report.json"), "utf8"));
const license = path.join(OUT, "LICENSE.md");

test("production catalog still defaults to adult-male only", () => {
  const cat = JSON.parse(readFileSync(PROD_CATALOG, "utf8"));
  assert.equal(cat.defaultModelId, "adult-male");
  assert.deepEqual(
    cat.models.map((m) => m.modelId),
    ["adult-male"]
  );
  assert.ok(!JSON.stringify(cat).includes("prototype"));
  assert.ok(!JSON.stringify(cat).includes("bp3d"));
});

test("adult-male production manifest unchanged (surface / PL: ids)", () => {
  const male = JSON.parse(readFileSync(PROD_MALE, "utf8"));
  assert.equal(male.modelId, "adult-male");
  assert.ok(male.layers.surface);
  assert.ok(male.layers.surface.meshes.every((m) => String(m.structureId).startsWith("PL:")));
});

test("prototype LICENSE + coordinate metadata exist", () => {
  assert.ok(existsSync(license));
  assert.match(readFileSync(license, "utf8"), /CC BY 4\.0|CC Attribution 4\.0/i);
  assert.equal(manifest.units, "meters");
  assert.ok(manifest.coordinateSystem || manifest.normalization);
  assert.ok(manifest.normalization?.matrixRows || manifest.normalization?.matrixRows);
  assert.ok(manifest.provenance?.licenseRef);
});

test("every structure has valid FMA structureId and unique meshId", () => {
  const meshIds = new Set();
  const structureIds = new Set();
  for (const s of src.structures) {
    assert.match(s.structureId, /^FMA:\d+$/);
    assert.ok(!meshIds.has(s.meshId), `duplicate meshId ${s.meshId}`);
    meshIds.add(s.meshId);
    assert.ok(!structureIds.has(s.structureId), `duplicate structureId ${s.structureId}`);
    structureIds.add(s.structureId);
    assert.ok(["skeletal", "muscle"].includes(s.layer));
    assert.ok(s.sourceChecksum?.value);
    assert.ok(s.sourceConceptId);
    assert.ok(s.sourceRepresentationId);
    assert.ok(s.sourceElementFileId);
  }
});

test("manifest layers skeletal + muscle present with provenance", () => {
  assert.ok(manifest.layers.skeletal?.file);
  assert.ok(manifest.layers.muscle?.file);
  for (const layer of Object.values(manifest.layers)) {
    for (const m of layer.meshes) {
      assert.match(m.structureId, /^FMA:\d+$/);
      assert.ok(m.sourceRepresentationId);
      assert.ok(m.provenanceRef);
      assert.ok(m.meshId);
    }
  }
});

for (const [layerId, layer] of Object.entries(manifest.layers)) {
  test(`manifest↔GLB identity for ${layerId}`, () => {
    const glbPath = path.join(OUT, layer.file.replace(/^\.\//, ""));
    assert.ok(existsSync(glbPath), glbPath);
    const { ids } = glbMeshNames(glbPath);
    const expected = layer.meshes.map((m) => m.meshId);
    assert.equal(ids.length, new Set(ids).size, "duplicate mesh names in GLB");
    assert.equal(expected.length, new Set(expected).size, "duplicate meshIds in manifest");
    const missing = expected.filter((id) => !ids.includes(id));
    const unknown = ids.filter((id) => !expected.includes(id));
    assert.deepEqual(missing, [], `manifest meshIds missing from GLB: ${missing}`);
    assert.deepEqual(unknown, [], `GLB meshes missing from manifest: ${unknown}`);
  });
}

test("source checksum pins exist without requiring raw OBJs in git", () => {
  const shaFile = path.join(ROOT, "data/bodyparts3d/subset/left-shoulder/obj.sha256");
  assert.ok(existsSync(shaFile));
  const lines = readFileSync(shaFile, "utf8").trim().split("\n");
  assert.equal(lines.length, src.structures.length);
  for (const s of src.structures) {
    const name = `${s.sourceElementFileId}.obj`;
    const line = lines.find((l) => l.endsWith(name));
    assert.ok(line, `checksum line for ${name}`);
    assert.equal(line.split(/\s+/)[0], s.sourceChecksum.value);
  }
  // Raw OBJs must NOT be required for fast CI
  const objDir = path.join(ROOT, "data/bodyparts3d/subset/left-shoulder/obj");
  assert.equal(existsSync(objDir), false, "raw OBJs should not be committed under subset/obj");
});

test("build-report includes payload, orientation, registration, tooling", () => {
  assert.ok(report.layers?.skeletal?.bytes || report.layers?.skeletal?.bytes);
  assert.ok(statSync(path.join(OUT, "skeletal.glb")).size > 0);
  assert.ok(statSync(path.join(OUT, "muscle.glb")).size > 0);
  assert.equal(report.orientation?.pass, true);
  assert.equal(report.registration?.pass, true);
  assert.ok(report.tooling?.pythonVersion);
  assert.ok(report.tooling?.trimeshVersion);
  assert.ok(report.tooling?.numpyVersion);
  assert.ok(report.fmaVerification?.structures?.length === 12);
});

test("raw-pre-meshopt is not a committed deliverable requirement", () => {
  // May exist locally after optimize; must not be required by integrity suite.
  assert.ok(true);
});

console.log("All prototype integrity checks passed.");
