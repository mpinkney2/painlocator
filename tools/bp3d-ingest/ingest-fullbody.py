#!/usr/bin/env python3
"""Ingest curated full-body BP3D packs → pre-meshopt GLBs + runtime manifests."""
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
CATALOG = ROOT / "data" / "bodyparts3d" / "subset" / "fullbody" / "catalog.json"
OBJ_ROOT = ROOT / "data" / "bodyparts3d" / "cache" / "subset" / "fullbody"
OUT_ROOT = ROOT / "public" / "anatomy" / "spatial" / "prototype-bp3d-fullbody-msk"

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


def load_mesh_files(obj_paths: list[Path]) -> tuple[trimesh.Trimesh, dict]:
    meshes = []
    raw_v = raw_f = 0
    for obj_path in obj_paths:
        mesh = trimesh.load_mesh(obj_path, process=False)
        if isinstance(mesh, trimesh.Scene):
            mesh = trimesh.util.concatenate(tuple(mesh.geometry.values()))
        if not isinstance(mesh, trimesh.Trimesh):
            raise TypeError(f"Expected Trimesh from {obj_path}")
        raw_v += int(len(mesh.vertices))
        raw_f += int(len(mesh.faces))
        meshes.append(mesh)
    mesh = trimesh.util.concatenate(meshes) if len(meshes) > 1 else meshes[0]
    mesh = mesh.copy()
    mesh.vertices = mesh.vertices.dot(TRANSFORM.T)
    mesh.invert()
    _ = mesh.vertex_normals
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.remove_unreferenced_vertices()
    report = {
        "sourceVertices": raw_v,
        "sourceFaces": raw_f,
        "vertices": int(len(mesh.vertices)),
        "faces": int(len(mesh.faces)),
        "elementCount": len(obj_paths),
        "centroid": mesh.centroid.tolist(),
        "bounds": mesh.bounds.tolist(),
    }
    return mesh, report


def ingest_pack(pack_meta: dict) -> dict:
    pack_id = pack_meta["packId"]
    src_manifest_path = ROOT / "data" / "bodyparts3d" / "subset" / "fullbody" / pack_meta["manifest"].replace("./", "")
    src = json.loads(src_manifest_path.read_text())
    layer = pack_meta["layer"]
    obj_dir = OBJ_ROOT / pack_id / "obj"
    out_dir = OUT_ROOT / "packs" / pack_id
    out_dir.mkdir(parents=True, exist_ok=True)

    scene = trimesh.Scene()
    mesh_entries = []
    build_rows = []
    for st in src["structures"]:
        fjs = st.get("sourceElementFileIds") or [st["sourceElementFileId"]]
        paths = [obj_dir / f"{fj}.obj" for fj in fjs]
        for p in paths:
            if not p.is_file():
                raise FileNotFoundError(p)
        mesh, report = load_mesh_files(paths)
        mesh.metadata = {"name": st["meshId"]}
        # trimesh scene geometry key = meshId
        scene.add_geometry(mesh, geom_name=st["meshId"], node_name=st["meshId"])
        mesh_entries.append(
            {
                "meshId": st["meshId"],
                "structureId": st["structureId"],
                "structureName": st["preferredName"],
                "clinicalName": st["clinicalName"],
                "layer": layer,
                "laterality": st["laterality"],
                "region": pack_id,
                "parentStructureId": st.get("parentStructureId"),
                "sourceRepresentationId": st["sourceRepresentationId"],
                "sourceElementFileId": st["sourceElementFileId"],
                "sourceElementFileIds": fjs,
                "provenanceRef": "BodyParts3D-4.0-CC-BY-4.0",
            }
        )
        build_rows.append({"meshId": st["meshId"], "structureId": st["structureId"], **report})

    glb_path = out_dir / f"{layer}.glb"
    # Export GLB
    glb_bytes = scene.export(file_type="glb")
    glb_path.write_bytes(glb_bytes)

    runtime_manifest = {
        "schemaVersion": "1.0.0",
        "modelId": "bp3d-fullbody-msk-v1",
        "packId": pack_id,
        "displayName": pack_id.replace("-", " ").title(),
        "sex": "male",
        "status": "development",
        "sourceAssetVersion": "bodyparts3d-4.0-isa-obj99",
        "coordinateSystem": "y-up-right-handed",
        "units": "meters",
        "coordinateFrameVersion": "painlocator-bp3d-canonical-v1",
        "normalization": {
            "matrixRows": TRANSFORM.tolist(),
            "description": "(x,y,z)_mm → (-x, z, -y) * 0.001",
        },
        "provenance": {
            "source": "BodyParts3D",
            "version": "4.0",
            "license": "CC-BY-4.0",
            "attribution": src.get("attribution"),
            "archiveChecksum": src.get("archiveChecksum"),
        },
        "layers": {
            layer: {
                "layerId": layer,
                "displayName": layer.title(),
                "file": f"./{layer}.glb",
                "lod": 0,
                "meshes": mesh_entries,
            }
        },
    }
    (out_dir / "manifest.json").write_text(json.dumps(runtime_manifest, indent=2) + "\n")
    report = {
        "packId": pack_id,
        "layer": layer,
        "structureCount": len(mesh_entries),
        "glbBytes": glb_path.stat().st_size,
        "glbSha256": sha256_file(glb_path),
        "meshes": build_rows,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "platform": platform.platform(),
    }
    (out_dir / "build-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"ingested {pack_id}: {len(mesh_entries)} meshes → {glb_path.stat().st_size/1024:.1f} KB")
    return report


def main() -> int:
    if not CATALOG.is_file():
        raise SystemExit("Run curate-fullbody.py first")
    catalog = json.loads(CATALOG.read_text())
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    reports = []
    for pack_id, meta in sorted(catalog["packs"].items()):
        reports.append(ingest_pack(meta))

    index = {
        "schemaVersion": "1.0.0",
        "modelId": "bp3d-fullbody-msk-v1",
        "coordinateFrameVersion": "painlocator-bp3d-canonical-v1",
        "sourceAssetVersion": catalog["sourceAssetVersion"],
        "structureCount": catalog["structureCount"],
        "packs": {
            pid: {
                "packId": pid,
                "layer": meta["layer"],
                "structureCount": meta["structureCount"],
                "baseUrl": f"/anatomy/spatial/prototype-bp3d-fullbody-msk/packs/{pid}",
                "manifest": f"./packs/{pid}/manifest.json",
                "glb": f"./packs/{pid}/{meta['layer']}.glb",
            }
            for pid, meta in catalog["packs"].items()
        },
        "registrationUrl": "/anatomy/spatial/registration/bp3d-shoulder-canonical-identity.json",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "buildReports": [{k: r[k] for k in ("packId", "layer", "structureCount", "glbBytes", "glbSha256")} for r in reports],
    }
    license_txt = """# BodyParts3D Full-Body MSK Packs — License

Derived from BodyParts3D 4.0 (DBCLS), licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).

Attribution: BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

Source archive: isa_BP3D_4.0_obj_99.zip (SHA-256 pinned in data/bodyparts3d/ARCHIVE.sha256).
Coordinate frame: painlocator-bp3d-canonical-v1.
"""
    (OUT_ROOT / "LICENSE.md").write_text(license_txt)
    (OUT_ROOT / "index.json").write_text(json.dumps(index, indent=2) + "\n")
    print(f"index → {OUT_ROOT / 'index.json'} ({len(reports)} packs)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
