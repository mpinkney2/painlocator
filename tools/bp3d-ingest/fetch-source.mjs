#!/usr/bin/env node
/**
 * Fetch + verify official BodyParts3D source (checksum-pinned).
 *
 * SHA-256 digests in data/bodyparts3d/ARCHIVE.sha256 are the immutable pin.
 * Official LATEST URLs are used only as a download location — content that
 * does not match the pin is rejected (no silent drift).
 *
 * Usage: node tools/bp3d-ingest/fetch-source.mjs
 */
import { createHash } from "node:crypto";
import {
  createWriteStream,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const CACHE = path.join(ROOT, "data/bodyparts3d/cache");
const ARCHIVE_SHA = path.join(ROOT, "data/bodyparts3d/ARCHIVE.sha256");
const SRC_MANIFEST = path.join(
  ROOT,
  "data/bodyparts3d/subset/left-shoulder/source-manifest.json"
);
const OBJ_SHA = path.join(ROOT, "data/bodyparts3d/subset/left-shoulder/obj.sha256");
const OBJ_OUT = path.join(ROOT, "data/bodyparts3d/cache/subset/left-shoulder/obj");
const ZIP_INNER = "isa_BP3D_4.0_obj_99";

const FILES = [
  {
    name: "isa_BP3D_4.0_obj_99.zip",
    url: "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip",
    dest: path.join(CACHE, "isa_BP3D_4.0_obj_99.zip"),
  },
  {
    name: "isa_parts_list_e.txt",
    url: "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_parts_list_e.txt",
    dest: path.join(CACHE, "isa_parts_list_e.txt"),
  },
  {
    name: "isa_element_parts.txt",
    url: "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_element_parts.txt",
    dest: path.join(CACHE, "isa_element_parts.txt"),
  },
];

function die(msg) {
  console.error(`FETCH FAILED: ${msg}`);
  process.exit(1);
}

function expectedDigests() {
  const map = new Map();
  for (const line of readFileSync(ARCHIVE_SHA, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const [hash, name] = t.split(/\s+/);
    map.set(name, hash);
  }
  return map;
}

function sha256File(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

async function download(url, dest) {
  console.log(`GET ${url}`);
  const res = await fetch(url);
  if (!res.ok) die(`HTTP ${res.status} for ${url}`);
  mkdirSync(path.dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function ensureFile(f, expected) {
  const want = expected.get(f.name);
  if (!want) die(`No pinned checksum for ${f.name} in ARCHIVE.sha256`);

  if (existsSync(f.dest)) {
    const digest = sha256File(f.dest);
    if (digest === want) {
      console.log(`cache hit ${f.name}`);
      return;
    }
    console.warn(`cache stale ${f.name} (${digest}); re-downloading`);
  }

  await download(f.url, f.dest);
  const digest = sha256File(f.dest);
  if (digest !== want) {
    die(
      `Checksum mismatch for ${f.name}.\n` +
        `  got:      ${digest}\n` +
        `  expected: ${want}\n` +
        `Refusing to continue — LATEST content does not match the pinned digest.`
    );
  }
  console.log(`OK ${f.name}`);
}

function extractSubset(zipPath, elementIds) {
  mkdirSync(OBJ_OUT, { recursive: true });
  const members = elementIds.map((id) => `${ZIP_INNER}/${id}.obj`);
  try {
    execFileSync("unzip", ["-o", "-j", zipPath, ...members, "-d", OBJ_OUT], {
      stdio: "inherit",
    });
  } catch (err) {
    die(`unzip subset failed: ${err.message}`);
  }
}

const expected = expectedDigests();
mkdirSync(CACHE, { recursive: true });

for (const f of FILES) {
  await ensureFile(f, expected);
}

const src = JSON.parse(readFileSync(SRC_MANIFEST, "utf8"));
const elementIds = src.structures.map((s) => s.sourceElementFileId);
extractSubset(path.join(CACHE, "isa_BP3D_4.0_obj_99.zip"), elementIds);

const expectedObj = new Map();
for (const line of readFileSync(OBJ_SHA, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const [hash, name] = line.split(/\s+/);
  expectedObj.set(name, hash);
}

for (const s of src.structures) {
  const name = `${s.sourceElementFileId}.obj`;
  const dest = path.join(OBJ_OUT, name);
  if (!existsSync(dest)) die(`Missing extracted OBJ ${name}`);
  const digest = sha256File(dest);
  const want = s.sourceChecksum?.value || expectedObj.get(name);
  if (!want) die(`No checksum for ${name}`);
  if (digest !== want) die(`OBJ checksum mismatch ${name}: ${digest} != ${want}`);
  console.log(`OK OBJ ${name}`);
}

writeFileSync(
  path.join(CACHE, "fetch-status.json"),
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      archive: "isa_BP3D_4.0_obj_99.zip",
      archiveSha256: expected.get("isa_BP3D_4.0_obj_99.zip"),
      subsetObjDir: "subset/left-shoulder/obj",
      structureCount: src.structures.length,
    },
    null,
    2
  ) + "\n"
);

console.log(
  "Fetch complete — subset OBJs verified in data/bodyparts3d/cache/subset/left-shoulder/obj/"
);
