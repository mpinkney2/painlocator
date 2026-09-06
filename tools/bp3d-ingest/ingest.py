#!/usr/bin/env python3
"""
BodyParts3D → PainLocator prototype ingest.

Loads the left-shoulder subset OBJs, normalizes into PainLocator canonical space,
validates meshes, groups skeletal/muscle layers, writes GLBs + manifest + report.
"""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[2]
SUBSET = ROOT / "data" / "bodyparts3d" / "subset" / "left-shoulder"
SRC_MANIFEST = SUBSET / "source-manifest.json"
OUT_DIR = ROOT / "public" / "anatomy" / "spatial" / "prototype-bp3d"

# Documented transform: BP3D mm Z-up (+X left) → PL meters Y-up (+X right)
# [x_pl]   [-0.001  0      0   ] [x]
# [y_pl] = [ 0      0      0.001] [y]
# [z_pl]   [ 0     -0.001  0   ] [z]
TRANSFORM = np.array(
    [
        [-0.001, 0.0, 0.0],
        [0.0, 0.0, 0.001],
        [0.0, -0.001, 0.0],
    ],
    dtype=np.float64,
)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_and_normalize(obj_path: Path) -> tuple[trimesh.Trimesh, dict]:
    mesh = trimesh.load_mesh(obj_path, process=False)
    if isinstance(mesh, trimesh.Scene):
        mesh = trimesh.util.concatenate(tuple(mesh.geometry.values()))
    if not isinstance(mesh, trimesh.Trimesh):
        raise TypeError(f"Expected Trimesh from {obj_path}, got {type(mesh)}")

    raw_verts = int(len(mesh.vertices))
    raw_faces = int(len(mesh.faces))
    bbox_src = mesh.bounds.tolist() if mesh.bounds is not None else None

    # Apply linear transform (no translation).
    mesh = mesh.copy()
    mesh.vertices = mesh.vertices.dot(TRANSFORM.T)

    # Axis remap has negative determinant → flip face winding, then recompute normals.
    # Avoid mesh.fix_normals() (pulls scipy via connected_components).
    mesh.invert()
    mesh.vertex_normals  # force property compute
    _ = mesh.face_normals

    warnings: list[str] = []
    # Drop degenerate faces only (non-destructive cleanup).
    before = len(mesh.faces)
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.remove_unreferenced_vertices()
    after = len(mesh.faces)
    if after < before:
        warnings.append(f"removed {before - after} degenerate faces")

    watertight = False
    winding = True
    try:
        watertight = bool(mesh.is_watertight)
    except Exception as exc:  # pragma: no cover - optional dependency paths
        warnings.append(f"watertight check unavailable: {exc}")
    try:
        winding = bool(mesh.is_winding_consistent)
    except Exception as exc:  # pragma: no cover
        warnings.append(f"winding check unavailable: {exc}")
        winding = True

    if not watertight:
        warnings.append("non-watertight (common for open anatomical surfaces; not auto-repaired)")
    if not winding:
        warnings.append("inconsistent winding reported")

    volume = None
    if watertight:
        try:
            volume = float(mesh.volume)
        except Exception:
            volume = None

    report = {
        "sourceVertices": raw_verts,
        "sourceTriangles": raw_faces,
        "vertices": int(len(mesh.vertices)),
        "triangles": int(len(mesh.faces)),
        "sourceBoundsMm": bbox_src,
        "boundsMeters": mesh.bounds.tolist(),
        "watertight": watertight,
        "windingConsistent": winding,
        "volume": volume,
        "warnings": warnings,
    }
    return mesh, report


def export_layer_glb(meshes: list[tuple[str, trimesh.Trimesh, dict]], out_path: Path) -> dict:
    scene = trimesh.Scene()
    for mesh_id, mesh, meta in meshes:
        m = mesh.copy()
        m.metadata["meshId"] = mesh_id
        m.metadata["structureId"] = meta["structureId"]
        m.metadata["sourceRepresentationId"] = meta["sourceRepresentationId"]
        m.metadata["layer"] = meta["layer"]
        m.metadata["laterality"] = meta["laterality"]
        # trimesh uses geometry dict keys as node/mesh names in GLB export
        scene.add_geometry(m, geom_name=mesh_id, node_name=mesh_id)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    raw_bytes = scene.export(file_type="glb")
    out_path.write_bytes(raw_bytes)
    return {
        "file": out_path.name,
        "bytes": len(raw_bytes),
        "sha256": sha256_file(out_path),
        "meshCount": len(meshes),
        "meshIds": [m[0] for m in meshes],
    }


def write_license(path: Path, attribution: str) -> None:
    path.write_text(
        f"""# BodyParts3D prototype pack — license & attribution

Derived from **BodyParts3D** (DBCLS), official LSDB Archive distribution.

## License

Creative Commons Attribution 4.0 International (CC BY 4.0)

https://creativecommons.org/licenses/by/4.0/

Official archive license page (authoritative; updated 2025-02-27):

https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html

## Required attribution

{attribution}

## Citation

Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K.
BodyParts3D: 3D structure database for anatomical concepts.
Nucleic Acids Research. 2009. PMID: 18835852.

## PainLocator modifications

- Subset selection (left shoulder skeletal + muscle)
- Coordinate normalization to PainLocator meters / Y-up / +X anatomical right
- Degenerate-face cleanup only (no silent hole-filling)
- GLB packaging + Meshopt optimization
- Stable `meshId` / `FMA:` `structureId` metadata via PainLocator manifest

## Status

**Prototype only.** Not registered as the production Spatial default model.
""",
        encoding="utf-8",
    )


def main() -> int:
    src = json.loads(SRC_MANIFEST.read_text())
    validation = []
    by_layer: dict[str, list] = {"skeletal": [], "muscle": []}

    for s in src["structures"]:
        obj_path = (SUBSET / s["sourceFile"]).resolve()
        mesh, report = load_and_normalize(obj_path)
        mesh.metadata.update(
            {
                "meshId": s["meshId"],
                "structureId": s["structureId"],
            }
        )
        entry = {
            **s,
            "validation": report,
            "provenanceRef": "docs/BODYPARTS3D_SOURCE_PROVENANCE.md",
        }
        validation.append(entry)
        by_layer[s["layer"]].append((s["meshId"], mesh, s))
        print(
            f"  {s['meshId']}: v={report['vertices']} t={report['triangles']} "
            f"watertight={report['watertight']} warnings={len(report['warnings'])}"
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    layer_files = {}
    for layer, items in by_layer.items():
        if not items:
            continue
        glb_name = f"{layer}.glb"
        info = export_layer_glb(items, OUT_DIR / glb_name)
        layer_files[layer] = info
        print(f"Wrote {glb_name} ({info['bytes']} bytes, {info['meshCount']} meshes)")

    # PainLocator-compatible prototype manifest (spirit-compatible with Spatial loader;
    # uses FMA: ids — not registered in production catalog).
    pl_manifest = {
        "schemaVersion": "1.0.0",
        "modelId": "bp3d-prototype-shoulder",
        "displayName": "BodyParts3D prototype — left shoulder",
        "sex": "male",
        "status": "prototype",
        "sourceAssetVersion": f"bodyparts3d-{src['sourceVersion']}-isa-obj99",
        "coordinateSystem": "y-up-right-handed",
        "units": "meters",
        "normalization": {
            "sourceUnits": "millimeters",
            "sourceUp": "+Z",
            "sourceLaterality": "+X anatomical left",
            "matrixRows": TRANSFORM.tolist(),
            "description": "(-x_mm, z_mm, -y_mm) * 0.001 → meters Y-up +X right",
        },
        "provenance": {
            "source": "BodyParts3D",
            "sourceVersion": src["sourceVersion"],
            "archiveUrl": src["archiveUrl"],
            "archiveSha256": src["archiveChecksum"]["value"],
            "license": "CC-BY-4.0",
            "licenseRef": "./LICENSE.md",
            "attribution": src["attribution"],
            "provenanceDoc": "docs/BODYPARTS3D_SOURCE_PROVENANCE.md",
            "region": src["region"],
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "layers": {},
    }

    for layer, info in layer_files.items():
        meshes = []
        for s in src["structures"]:
            if s["layer"] != layer:
                continue
            meshes.append(
                {
                    "meshId": s["meshId"],
                    "structureId": s["structureId"],
                    "structureName": s["preferredName"],
                    "clinicalName": s["clinicalName"],
                    "layer": layer,
                    "laterality": s["laterality"],
                    "parentStructureId": s.get("parentStructureId"),
                    "sourceRepresentationId": s["sourceRepresentationId"],
                    "sourceElementFileId": s["sourceElementFileId"],
                    "provenanceRef": "docs/BODYPARTS3D_SOURCE_PROVENANCE.md",
                }
            )
        pl_manifest["layers"][layer] = {
            "layerId": layer,
            "displayName": "Skeletal" if layer == "skeletal" else "Muscle",
            "file": f"./{info['file']}",
            "lod": 0,
            "meshes": meshes,
        }

    (OUT_DIR / "manifest.json").write_text(json.dumps(pl_manifest, indent=2) + "\n", encoding="utf-8")
    write_license(OUT_DIR / "LICENSE.md", src["attribution"])

    # Unoptimized sizes captured before optimize.mjs overwrites GLBs.
    report = {
        "generatedAt": pl_manifest["provenance"]["generatedAt"],
        "modelId": pl_manifest["modelId"],
        "structureCount": len(src["structures"]),
        "sourceObjBytes": sum((SUBSET / s["sourceFile"]).stat().st_size for s in src["structures"]),
        "layers": layer_files,
        "validation": [
            {
                "meshId": v["meshId"],
                "structureId": v["structureId"],
                **v["validation"],
            }
            for v in validation
        ],
        "notes": [
            "GLB sizes here are pre-Meshopt; run node tools/bp3d-ingest/optimize.mjs next.",
            "Production adult-male exterior catalog intentionally unchanged.",
        ],
    }
    (OUT_DIR / "build-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Manifest + report → {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
