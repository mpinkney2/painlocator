#!/usr/bin/env node
/**
 * Performance / mesh metrics harness for vendor evaluation samples.
 * Does not optimize vendor assets — report only.
 *
 * Usage:
 *   node tools/anatomy-vendor/report-mesh-metrics.mjs [path ...]
 * Default: scans data/vendor-eval/sciepro (if present)
 */
import { existsSync, readdirSync, statSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function estimateGlbStats(buf) {
  const out = {
    bytes: buf.length,
    jsonChunkBytes: null,
    binChunkBytes: null,
    note: "Raw size only unless gltf-transform is available"
  };
  try {
    if (buf.length < 20) return out;
    const magic = buf.toString("utf8", 0, 4);
    if (magic !== "glTF") return out;
    const jsonLen = buf.readUInt32LE(12);
    out.jsonChunkBytes = jsonLen;
    if (20 + jsonLen + 8 <= buf.length) {
      out.binChunkBytes = buf.readUInt32LE(20 + jsonLen);
    }
  } catch {
    /* ignore */
  }
  return out;
}

async function tryGltfTransformStats(file) {
  try {
    const { NodeIO } = await import("@gltf-transform/core");
    const io = new NodeIO();
    const doc = await io.read(file);
    let vertices = 0;
    let triangles = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (pos) vertices += pos.getCount();
        const idx = prim.getIndices();
        if (idx) triangles += Math.floor(idx.getCount() / 3);
        else if (pos) triangles += Math.floor(pos.getCount() / 3);
      }
    }
    return { vertices, triangles, parser: "@gltf-transform/core" };
  } catch (err) {
    return { vertices: null, triangles: null, parserError: String(err?.message || err) };
  }
}

async function main() {
  const inputs =
    process.argv.slice(2).length > 0
      ? process.argv.slice(2).map((p) => path.resolve(p))
      : walk(path.join(ROOT, "data/vendor-eval/sciepro")).filter((p) =>
          /\.(glb|gltf|obj|fbx)$/i.test(p)
        );

  if (!inputs.length) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          files: [],
          message:
            "No vendor evaluation meshes found yet. Drop samples under data/vendor-eval/sciepro/ then re-run."
        },
        null,
        2
      )
    );
    return;
  }

  const files = [];
  for (const file of inputs) {
    const buf = readFileSync(file);
    const st = statSync(file);
    const base = {
      path: path.relative(ROOT, file),
      bytes: st.size,
      ext: path.extname(file).toLowerCase()
    };
    if (/\.glb$/i.test(file)) {
      Object.assign(base, estimateGlbStats(buf), await tryGltfTransformStats(file));
    } else if (/\.obj$/i.test(file)) {
      const text = buf.toString("utf8");
      const vertices = (text.match(/^v /gm) || []).length;
      const faces = (text.match(/^f /gm) || []).length;
      Object.assign(base, {
        vertices,
        triangles: faces,
        note: "OBJ face count treated as triangle proxy (may be polys)"
      });
    } else {
      base.note = "Format metrics limited — convert locally after license confirmation";
    }
    if (base.vertices) {
      base.gpuMemoryEstimateBytes = base.vertices * 32 + (base.triangles || 0) * 12;
    }
    files.push(base);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    optimizationApplied: false,
    warning: "Do not meshopt/quantize proprietary assets until conversion rights are confirmed.",
    files,
    totals: {
      bytes: files.reduce((s, f) => s + f.bytes, 0),
      vertices: files.reduce((s, f) => s + (f.vertices || 0), 0),
      triangles: files.reduce((s, f) => s + (f.triangles || 0), 0)
    }
  };

  const outDir = path.join(ROOT, "data/vendor-eval/sciepro/derived");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "mesh-metrics.json");
  writeFileSync(outFile, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${path.relative(ROOT, outFile)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
