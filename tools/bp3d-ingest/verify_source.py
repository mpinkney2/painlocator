#!/usr/bin/env python3
"""Verify BodyParts3D subset checksums and FMA mapping against fetched cache."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SUBSET = ROOT / "data" / "bodyparts3d" / "subset" / "left-shoulder"
MANIFEST = SUBSET / "source-manifest.json"
OBJ_SHA = SUBSET / "obj.sha256"
CACHE = ROOT / "data" / "bodyparts3d" / "cache"
OBJ_DIR = CACHE / "subset" / "left-shoulder" / "obj"
PARTS = CACHE / "isa_parts_list_e.txt"
ELEMENTS = CACHE / "isa_element_parts.txt"
ARCHIVE_SHA = ROOT / "data" / "bodyparts3d" / "ARCHIVE.sha256"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_parts() -> dict[str, tuple[str, str]]:
    out = {}
    for line in PARTS.read_text().splitlines():
        if not line or line.startswith("concept"):
            continue
        cid, rid, en = line.split("\t")
        out[cid] = (rid, en)
    return out


def load_elements() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for line in ELEMENTS.read_text().splitlines():
        if not line or line.startswith("concept"):
            continue
        cid, _name, eid = line.split("\t")
        out.setdefault(cid, []).append(eid)
    return out


def expected_archive() -> dict[str, str]:
    out = {}
    for line in ARCHIVE_SHA.read_text().splitlines():
        t = line.strip()
        if not t or t.startswith("#"):
            continue
        digest, name = t.split()[:2]
        out[name] = digest
    return out


def main() -> int:
    errors: list[str] = []
    if not PARTS.is_file() or not ELEMENTS.is_file() or not OBJ_DIR.is_dir():
        print(
            "VERIFY FAILED — source cache missing. Run: npm run bp3d:fetch",
            file=sys.stderr,
        )
        return 1

    src = json.loads(MANIFEST.read_text())
    parts = load_parts()
    elements = load_elements()
    pinned = expected_archive()

    # Archive / mapping table pins
    for name, path in [
        ("isa_BP3D_4.0_obj_99.zip", CACHE / "isa_BP3D_4.0_obj_99.zip"),
        ("isa_parts_list_e.txt", PARTS),
        ("isa_element_parts.txt", ELEMENTS),
    ]:
        if not path.is_file():
            errors.append(f"missing cached {name}")
            continue
        digest = sha256(path)
        if digest != pinned.get(name):
            errors.append(f"cache pin mismatch {name}: {digest}")

    expected_obj = {}
    for line in OBJ_SHA.read_text().splitlines():
        if not line.strip():
            continue
        digest, name = line.split()
        expected_obj[name] = digest

    seen_mesh: set[str] = set()
    seen_struct: set[str] = set()
    fma_table: list[dict] = []

    for s in src["structures"]:
        mesh_id = s["meshId"]
        structure_id = s["structureId"]
        concept = s["sourceConceptId"]
        rep = s["sourceRepresentationId"]
        elem = s["sourceElementFileId"]
        obj_path = OBJ_DIR / f"{elem}.obj"

        if mesh_id in seen_mesh:
            errors.append(f"duplicate meshId {mesh_id}")
        seen_mesh.add(mesh_id)

        if structure_id in seen_struct:
            errors.append(f"duplicate structureId {structure_id}")
        seen_struct.add(structure_id)

        if not structure_id.startswith("FMA:") or not structure_id[4:].isdigit():
            errors.append(f"invalid structureId {structure_id}")

        status = "ok"
        if concept not in parts:
            errors.append(f"concept {concept} missing from isa_parts_list_e.txt")
            status = "MISSING_CONCEPT"
        else:
            rid, en = parts[concept]
            if rid != rep:
                errors.append(f"{concept}: representation {rep} != table {rid}")
                status = "REP_MISMATCH"
            if en != s["preferredName"]:
                errors.append(
                    f"{concept}: preferredName {s['preferredName']!r} != table {en!r}"
                )
                status = "NAME_MISMATCH"

        els = elements.get(concept, [])
        if elem not in els:
            errors.append(f"{concept}: element {elem} not in isa_element_parts.txt ({els})")
            status = "ELEMENT_MISMATCH"
        elif len(els) != 1:
            errors.append(f"{concept}: expected 1 element file, found {len(els)} ({els})")
            status = "AMBIGUOUS_ELEMENTS"

        if not obj_path.is_file():
            errors.append(f"missing OBJ {obj_path}")
            status = "MISSING_OBJ"
        else:
            digest = sha256(obj_path)
            exp = s.get("sourceChecksum", {}).get("value") or expected_obj.get(obj_path.name)
            if exp is None:
                errors.append(f"OBJ {obj_path.name} has no checksum pin")
                status = "NO_CHECKSUM"
            elif digest != exp:
                errors.append(f"checksum mismatch {obj_path.name}: {digest} != {exp}")
                status = "CHECKSUM_MISMATCH"

        fma_table.append(
            {
                "meshId": mesh_id,
                "structureId": structure_id,
                "sourceConceptId": concept,
                "sourceRepresentationId": rep,
                "sourceElementFileId": elem,
                "preferredName": s["preferredName"],
                "laterality": s["laterality"],
                "layer": s["layer"],
                "verification": status,
            }
        )

    # Write verification table for build-report consumption
    out = SUBSET / "fma-verification.json"
    out.write_text(json.dumps({"structures": fma_table}, indent=2) + "\n", encoding="utf-8")

    if errors:
        print("VERIFY FAILED")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(f"VERIFY OK — {len(src['structures'])} structures, checksums + FMA maps match")
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
