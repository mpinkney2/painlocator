#!/usr/bin/env python3
"""Verify BodyParts3D subset checksums and FMA mapping consistency."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SUBSET = ROOT / "data" / "bodyparts3d" / "subset" / "left-shoulder"
MANIFEST = SUBSET / "source-manifest.json"
OBJ_DIR = SUBSET / "obj"
OBJ_SHA = SUBSET / "obj.sha256"
PARTS = ROOT / "data" / "bodyparts3d" / "mapping" / "isa_parts_list_e.txt"
ELEMENTS = ROOT / "data" / "bodyparts3d" / "mapping" / "isa_element_parts.txt"


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


def main() -> int:
    errors: list[str] = []
    src = json.loads(MANIFEST.read_text())
    parts = load_parts()
    elements = load_elements()

    expected_obj = {}
    for line in OBJ_SHA.read_text().splitlines():
        if not line.strip():
            continue
        digest, name = line.split()
        expected_obj[name] = digest

    seen_mesh = set()
    seen_struct = set()

    for s in src["structures"]:
        mesh_id = s["meshId"]
        structure_id = s["structureId"]
        concept = s["sourceConceptId"]
        rep = s["sourceRepresentationId"]
        elem = s["sourceElementFileId"]
        obj_path = (SUBSET / s["sourceFile"]).resolve()

        if mesh_id in seen_mesh:
            errors.append(f"duplicate meshId {mesh_id}")
        seen_mesh.add(mesh_id)

        if structure_id in seen_struct:
            errors.append(f"duplicate structureId {structure_id}")
        seen_struct.add(structure_id)

        if not structure_id.startswith("FMA:") or not structure_id[4:].isdigit():
            errors.append(f"invalid structureId {structure_id}")

        if concept not in parts:
            errors.append(f"concept {concept} missing from isa_parts_list_e.txt")
        else:
            rid, en = parts[concept]
            if rid != rep:
                errors.append(f"{concept}: representation {rep} != table {rid}")
            if en != s["preferredName"]:
                errors.append(
                    f"{concept}: preferredName {s['preferredName']!r} != table {en!r}"
                )

        els = elements.get(concept, [])
        if elem not in els:
            errors.append(f"{concept}: element {elem} not in isa_element_parts.txt ({els})")
        if len(els) != 1:
            errors.append(f"{concept}: expected 1 element file, found {len(els)}")

        if not obj_path.is_file():
            errors.append(f"missing OBJ {obj_path}")
            continue

        digest = sha256(obj_path)
        exp = expected_obj.get(obj_path.name)
        if exp is None:
            errors.append(f"OBJ {obj_path.name} not listed in obj.sha256")
        elif digest != exp:
            errors.append(f"checksum mismatch {obj_path.name}: {digest} != {exp}")

        # Mapping-table checksums
    for key, meta in src.get("mappingTables", {}).items():
        path = (MANIFEST.parent / meta["path"]).resolve()
        if not path.is_file():
            errors.append(f"mapping table missing ({key}): {path}")
            continue
        digest = sha256(path)
        if digest != meta["checksum"]["value"]:
            errors.append(f"mapping checksum mismatch ({key}): {digest}")

    if errors:
        print("VERIFY FAILED")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(f"VERIFY OK — {len(src['structures'])} structures, checksums + FMA maps match")
    return 0


if __name__ == "__main__":
    sys.exit(main())
