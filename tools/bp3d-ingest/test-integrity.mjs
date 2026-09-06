#!/usr/bin/env node
/**
 * Integrity tests for BodyParts3D prototype pack (offline; not production catalog).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "public/anatomy/spatial/prototype-bp3d");
const SRC = path.join(ROOT, "data/bodyparts3d/subset/left-shoulder/source-manifest.json");
const PROD_CATALOG = path.join(ROOT, "public/anatomy/spatial/manifest.json");
const PROD_MALE = path.join(ROOT, "public/anatomy/spatial/adult-male/manifest.json");

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

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
  // Prefer mesh.name; fall back to node.name if exporters omit mesh.name
  const ids = meshNames.length ? meshNames : nodeNames;
  return { ids, meshNames, nodeNames, json };
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

console.log("BodyParts3D prototype integrity");

const src = JSON.parse(readFileSync(SRC, "utf8"));
const manifest = JSON.parse(readFileSync(path.join(OUT, "manifest.json"), "utf8"));
const license = path.join(OUT, "LICENSE.md");
const report = JSON.parse(readFileSync(path.join(OUT, "build-report.json"), "utf8"));

test("production catalog still defaults to adult-male only", () => {
  const cat = JSON.parse(readFileSync(PROD_CATALOG, "utf8"));
  assert.equal(cat.defaultModelId, "adult-male");
  assert.deepEqual(
    cat.models.map((m) => m.modelId),
    ["adult-male"]
  );
  assert.ok(!JSON.stringify(cat).includes("prototype"));
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
  assert.ok(manifest.coordinateSystem);
  assert.ok(manifest.normalization?.matrixRows);
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

test("source OBJ checksums recorded and files present", () => {
  const shaFile = path.join(ROOT, "data/bodyparts3d/subset/left-shoulder/obj.sha256");
  const lines = readFileSync(shaFile, "utf8").trim().split("\n");
  assert.ok(lines.length >= src.structures.length);
  for (const s of src.structures) {
    const obj = path.join(ROOT, "data/bodyparts3d/subset/left-shoulder", s.sourceFile);
    assert.ok(existsSync(obj), obj);
    const digest = sha256(obj);
    const line = lines.find((l) => l.endsWith(path.basename(obj)));
    assert.ok(line, `checksum line for ${obj}`);
    assert.equal(line.split(/\s+/)[0], digest);
  }
});

test("build-report includes payload sizes", () => {
  assert.ok(report.layers?.skeletal?.bytes || report.optimization?.layers);
  assert.ok(statSync(path.join(OUT, "skeletal.glb")).size > 0);
  assert.ok(statSync(path.join(OUT, "muscle.glb")).size > 0);
});

console.log("All prototype integrity checks passed.");
