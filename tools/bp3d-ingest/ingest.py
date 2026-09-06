#!/usr/bin/env python3
"""BodyParts3D → PainLocator prototype ingest (offline / build-time)."""
from __future__ import annotations

import hashlib
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[2]
SUBSET = ROOT / "data" / "bodyparts3d" / "subset" / "left-shoulder"
SRC_MANIFEST = SUBSET / "source-manifest.json"
FMA_TABLE = SUBSET / "fma-verification.json"
OBJ_DIR = ROOT / "data" / "bodyparts3d" / "cache" / "subset" / "left-shoulder" / "obj"
OUT_DIR = ROOT / "public" / "anatomy" / "spatial" / "prototype-bp3d"

# BodyParts3D mm, Z-up, +X left → PainLocator meters, Y-up, +X right
# (x, y, z)_mm → (-x, z, -y) * 0.001
TRANSFORM = np.array(
    [[-0.001, 0.0, 0.0], [0.0, 0.0, 0.001], [0.0, -0.001, 0.0]],
    dtype=np.float64,
)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_mesh(obj_path: Path) -> tuple[trimesh.Trimesh, dict]:
    mesh = trimesh.load_mesh(obj_path, process=False)
    if isinstance(mesh, trimesh.Scene):
        mesh = trimesh.util.concatenate(tuple(mesh.geometry.values()))
    if not isinstance(mesh, trimesh.Trimesh):
        raise TypeError(f"Expected Trimesh from {obj_path}, got {type(mesh)}")

    raw_v, raw_f = int(len(mesh.vertices)), int(len(mesh.faces))
    bbox_src = mesh.bounds.tolist() if mesh.bounds is not None else None
    centroid_src = mesh.centroid.tolist()

    mesh = mesh.copy()
    mesh.vertices = mesh.vertices.dot(TRANSFORM.T)
    mesh.invert()
    _ = mesh.vertex_normals
    _ = mesh.face_normals

    warnings: list[str] = []
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
    except Exception as exc:  # pragma: no cover
        warnings.append(f"watertight check unavailable: {exc}")
    try:
        winding = bool(mesh.is_winding_consistent)
    except Exception as exc:  # pragma: no cover
        warnings.append(f"winding check unavailable: {exc}")

    if not watertight:
        warnings.append("non-watertight (common for open anatomical surfaces; not auto-repaired)")
    if not winding:
        warnings.append("inconsistent winding reported")

    report = {
        "sourceVertices": raw_v,
        "sourceTriangles": raw_f,
        "vertices": int(len(mesh.vertices)),
        "triangles": int(len(mesh.faces)),
        "sourceBoundsMm": bbox_src,
        "sourceCentroidMm": centroid_src,
        "boundsMeters": mesh.bounds.tolist(),
        "centroidMeters": mesh.centroid.tolist(),
        "watertight": watertight,
        "windingConsistent": winding,
        "warnings": warnings,
    }
    return mesh, report


def export_glb(items: list[tuple[str, trimesh.Trimesh, dict]], out_path: Path) -> dict:
    scene = trimesh.Scene()
    for mesh_id, mesh, meta in items:
        m = mesh.copy()
        m.metadata.update(
            {
                "meshId": mesh_id,
                "structureId": meta["structureId"],
                "sourceRepresentationId": meta["sourceRepresentationId"],
                "layer": meta["layer"],
                "laterality": meta["laterality"],
            }
        )
        scene.add_geometry(m, geom_name=mesh_id, node_name=mesh_id)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    raw = scene.export(file_type="glb")
    out_path.write_bytes(raw)
    return {
        "file": out_path.name,
        "bytes": len(raw),
        "sha256": sha256_file(out_path),
        "meshCount": len(items),
        "meshIds": [m[0] for m in items],
    }


def write_license(path: Path, src: dict) -> None:
    path.write_text(
        f"""# BodyParts3D prototype pack — license & attribution

Derived from **BodyParts3D** (DBCLS), official LSDB Archive distribution.

## License

Creative Commons Attribution 4.0 International (CC BY 4.0)

https://creativecommons.org/licenses/by/4.0/

Official archive license page (authoritative; updated {src.get("licensePageUpdated", "2025-02-27")}):

{src.get("licensePageUrl", "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html")}

## Required attribution

{src["attribution"]}

## Citation

Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K.
BodyParts3D: 3D structure database for anatomical concepts.
Nucleic Acids Research. 2009. PMID: 18835852.

## Provenance note

{src.get("licenseNote", "")}

## PainLocator modifications

- Left-shoulder subset selection (skeletal + muscle)
- Coordinate normalization to PainLocator meters / Y-up / +X anatomical right
- Degenerate-face cleanup only (no silent hole-filling)
- GLB packaging + Meshopt compression
- Stable meshId / FMA: structureId metadata via PainLocator manifest

## Status

**Prototype only.** Not registered as the production Spatial default model.
""",
        encoding="utf-8",
    )


def layer_stats(items: list[tuple[str, trimesh.Trimesh, dict]]) -> dict:
    bounds = np.array([m.bounds for _, m, _ in items])
    centroids = np.array([m.centroid for _, m, _ in items])
    return {
        "boundsMeters": {
            "min": bounds[:, 0, :].min(axis=0).tolist(),
            "max": bounds[:, 1, :].max(axis=0).tolist(),
        },
        "centroidRangeMeters": {
            "min": centroids.min(axis=0).tolist(),
            "max": centroids.max(axis=0).tolist(),
            "mean": centroids.mean(axis=0).tolist(),
        },
        "meshCentroids": {mesh_id: mesh.centroid.tolist() for mesh_id, mesh, _ in items},
    }


def main() -> int:
    if not OBJ_DIR.is_dir():
        print("INGEST FAILED — cache OBJs missing. Run: npm run bp3d:fetch", file=sys.stderr)
        return 1

    src = json.loads(SRC_MANIFEST.read_text())
    validation: list[dict] = []
    by_layer: dict[str, list] = {"skeletal": [], "muscle": []}

    for s in src["structures"]:
        obj_path = OBJ_DIR / f"{s['sourceElementFileId']}.obj"
        if not obj_path.is_file():
            print(f"INGEST FAILED — missing {obj_path}", file=sys.stderr)
            return 1
        mesh, report = load_mesh(obj_path)
        by_layer[s["layer"]].append((s["meshId"], mesh, s))
        validation.append({"meshId": s["meshId"], "structureId": s["structureId"], **report})
        c = np.round(report["centroidMeters"], 4).tolist()
        print(f"  {s['meshId']}: v={report['vertices']} t={report['triangles']} centroid={c}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    layer_files: dict[str, dict] = {}
    registration: dict[str, dict] = {}
    for layer, items in by_layer.items():
        if not items:
            continue
        info = export_glb(items, OUT_DIR / f"{layer}.glb")
        layer_files[layer] = info
        registration[layer] = layer_stats(items)
        print(f"Wrote {layer}.glb ({info['bytes']} bytes, {info['meshCount']} meshes)")

    humerus = next(v for v in validation if v["meshId"] == "bone.humerus.left")
    cx, cy, cz = humerus["centroidMeters"]
    orientation = {
        "transform": {
            "description": "(-x_mm, z_mm, -y_mm) * 0.001",
            "matrixRows": TRANSFORM.tolist(),
            "source": "BodyParts3D mm / Z-up / +X anatomical left",
            "target": "PainLocator meters / Y-up / +X anatomical right",
            "canonical": True,
        },
        "checks": {
            "leftShoulderOnNegativeX": {
                "pass": bool(cx < 0),
                "humerusCentroidX": cx,
                "expected": "x < 0 (anatomical left when +X is right)",
            },
            "superiorOnPositiveY": {
                "pass": bool(cy > 0.5),
                "humerusCentroidY": cy,
                "expected": "y > 0.5 m (upper limb height)",
            },
            "anteriorHeuristicOnPositiveZ": {
                "pass": bool(cz > 0),
                "humerusCentroidZ": cz,
                "expected": "z > 0 after remap for this shoulder pack",
            },
        },
    }
    orientation["pass"] = all(c["pass"] for c in orientation["checks"].values())

    sk = np.array(list(registration["skeletal"]["meshCentroids"].values()))
    mu = np.array(list(registration["muscle"]["meshCentroids"].values()))
    separation = float(np.linalg.norm(sk.mean(axis=0) - mu.mean(axis=0)))
    registration_summary = {
        "skeletal": registration["skeletal"],
        "muscle": registration["muscle"],
        "layerCentroidSeparationMeters": separation,
        "pass": separation < 0.25,
        "note": (
            "Bones and muscles share BodyParts3D world space; after identical "
            "normalization they should remain co-located (separation << body scale)."
        ),
    }

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
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
            "canonical": True,
        },
        "provenance": {
            "source": "BodyParts3D",
            "sourceVersion": src["sourceVersion"],
            "archiveUrl": src["archiveUrl"],
            "archiveSha256": src["archiveChecksum"]["value"],
            "license": "CC-BY-4.0",
            "licenseRef": "./LICENSE.md",
            "licensePageUrl": src.get("licensePageUrl"),
            "licensePageVerifiedOn": "2026-09-06",
            "attribution": src["attribution"],
            "provenanceDoc": "docs/BODYPARTS3D_SOURCE_PROVENANCE.md",
            "licenseNote": src.get("licenseNote"),
            "region": src["region"],
            "generatedAt": generated_at,
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
    write_license(OUT_DIR / "LICENSE.md", src)

    fma_table = json.loads(FMA_TABLE.read_text()) if FMA_TABLE.is_file() else None
    report = {
        "generatedAt": generated_at,
        "modelId": pl_manifest["modelId"],
        "structureCount": len(src["structures"]),
        "sourceObjBytes": sum(
            (OBJ_DIR / f"{s['sourceElementFileId']}.obj").stat().st_size for s in src["structures"]
        ),
        "tooling": {
            "pythonVersion": platform.python_version(),
            "trimeshVersion": trimesh.__version__,
            "numpyVersion": np.__version__,
            "gltfTransformVersion": None,
        },
        "layers": layer_files,
        "validation": validation,
        "fmaVerification": fma_table,
        "orientation": orientation,
        "registration": registration_summary,
        "notes": [
            "GLB sizes here are pre-Meshopt; optimize.mjs updates optimization section.",
            "raw-pre-meshopt/ is a local regenerable artifact (not committed).",
            "Production adult-male Spatial catalog intentionally unchanged.",
        ],
    }
    (OUT_DIR / "build-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    if not orientation["pass"]:
        print("INGEST FAILED: orientation checks failed — see build-report.json", file=sys.stderr)
        return 1
    if not registration_summary["pass"]:
        print("INGEST FAILED: skeletal↔muscle registration look suspicious", file=sys.stderr)
        return 1

    print(f"Manifest + report → {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
