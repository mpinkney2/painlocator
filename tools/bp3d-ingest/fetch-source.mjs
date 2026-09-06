#!/usr/bin/env node
/**
 * Optional re-fetch of official BodyParts3D archive + mapping tables.
 * Verifies SHA-256 against data/bodyparts3d/ARCHIVE.sha256.
 *
 * Usage: node tools/bp3d-ingest/fetch-source.mjs
 */
import { createHash } from "node:crypto";
import { createWriteStream, readFileSync, mkdirSync, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const CACHE = path.join(ROOT, "data/bodyparts3d/cache");
const ARCHIVE_SHA = path.join(ROOT, "data/bodyparts3d/ARCHIVE.sha256");

const FILES = [
  {
    name: "isa_BP3D_4.0_obj_99.zip",
    url: "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip",
  },
  {
    name: "isa_parts_list_e.txt",
    url: "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_parts_list_e.txt",
    dest: path.join(ROOT, "data/bodyparts3d/mapping/isa_parts_list_e.txt"),
  },
  {
    name: "isa_element_parts.txt",
    url: "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_element_parts.txt",
    dest: path.join(ROOT, "data/bodyparts3d/mapping/isa_element_parts.txt"),
  },
];

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

async function download(url, dest) {
  console.log(`GET ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  mkdirSync(path.dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

function sha256File(file) {
  const h = createHash("sha256");
  h.update(readFileSync(file));
  return h.digest("hex");
}

const expected = expectedDigests();
mkdirSync(CACHE, { recursive: true });

for (const f of FILES) {
  const dest = f.dest || path.join(CACHE, f.name);
  if (!existsSync(dest)) {
    await download(f.url, dest);
  } else {
    console.log(`exists ${dest}`);
  }
  const digest = sha256File(dest);
  const want = expected.get(f.name);
  if (!want) throw new Error(`No expected checksum for ${f.name}`);
  if (digest !== want) {
    throw new Error(`Checksum mismatch ${f.name}: got ${digest}, expected ${want}`);
  }
  console.log(`OK ${f.name} ${digest}`);
}

console.log("Fetch + checksum verification complete.");
console.log("Subset OBJs are already committed under data/bodyparts3d/subset/left-shoulder/obj/.");
console.log("To re-extract from the zip, unzip selected FJ*.obj files into that folder and re-run verify_source.py.");
