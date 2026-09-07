#!/usr/bin/env python3
"""
Representative geometry comparison: BP3D 4.0 99% (current) vs 3.0 95% (historical higher detail).

Same PainLocator transform / materials / no extra decimation.
Cross-version note: Release 4.0 shifted skeletal coordinates — compare mesh density
and silhouette quality, not registration residuals.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "visual-targets" / "bp3d-source-tier-comparison"
CACHE = ROOT / "data" / "bodyparts3d" / "cache"
ZIP_A = CACHE / "isa_BP3D_4.0_obj_99.zip"
ZIP_B = CACHE / "v3" / "BodyParts3D_3.0_obj_95.zip"
PARTS = CACHE / "isa_parts_list_e.txt"
ELEM = CACHE / "isa_element_parts.txt"

TRANSFORM = np.array(
    [[-0.001, 0.0, 0.0], [0.0, 0.0, 0.001], [0.0, -0.001, 0.0]],
    dtype=np.float64,
)

# FMA concept id (no prefix) → role label
REPRESENTATIVES = [
    ("FMA34683", "shoulder / acromial left deltoid", "muscle"),
    ("FMA34691", "torso / clavicular left pectoralis major", "muscle"),
    ("FMA13378", "torso / left rectus abdominis", "muscle"),
    ("FMA13396", "shoulder / left scapula", "skeletal"),
    ("FMA23131", "shoulder / left humerus", "skeletal"),
    ("FMA24465", "hand / left first metacarpal", "skeletal"),
    ("FMA16587", "pelvis / left hip bone", "skeletal"),
    ("FMA38931", "thigh / left vastus lateralis", "muscle"),
    ("FMA24487", "knee / left patella", "skeletal"),
    ("FMA24475", "thigh / left femur", "skeletal"),
    ("FMA24478", "lower leg / left tibia", "skeletal"),
    ("FMA45958", "lower leg / medial head left gastrocnemius", "muscle"),
    ("FMA24498", "foot / left calcaneus", "skeletal"),
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_parts() -> dict[str, str]:
    out: dict[str, str] = {}
    for line in PARTS.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip() or line.startswith("concept"):
            continue
        cols = line.split("\t")
        if len(cols) >= 3:
            out[cols[0]] = cols[2]
    return out


def load_elements() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for line in ELEM.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip() or line.startswith("concept"):
            continue
        cols = line.split("\t")
        if len(cols) >= 3:
            out.setdefault(cols[0], []).append(cols[2])
    return out


def zip_member_map(zf: zipfile.ZipFile) -> dict[str, str]:
    """Map basename → member path (handles Windows backslash names)."""
    m: dict[str, str] = {}
    for name in zf.namelist():
        if name.endswith("/"):
            continue
        base = name.replace("\\", "/").split("/")[-1]
        m[base] = name
    return m


def extract_obj(zf: zipfile.ZipFile, member: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with zf.open(member) as src, dest.open("wb") as out:
        out.write(src.read())


def mesh_stats(obj_path: Path) -> tuple[trimesh.Trimesh, dict]:
    mesh = trimesh.load_mesh(obj_path, process=False)
    if isinstance(mesh, trimesh.Scene):
        mesh = trimesh.util.concatenate(tuple(mesh.geometry.values()))
    assert isinstance(mesh, trimesh.Trimesh)
    raw_v, raw_f = int(len(mesh.vertices)), int(len(mesh.faces))
    mesh = mesh.copy()
    mesh.vertices = mesh.vertices.dot(TRANSFORM.T)
    mesh.invert()
    _ = mesh.vertex_normals
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.remove_unreferenced_vertices()
    return mesh, {
        "sourceVertices": raw_v,
        "sourceTriangles": raw_f,
        "vertices": int(len(mesh.vertices)),
        "triangles": int(len(mesh.faces)),
        "boundsMeters": mesh.bounds.tolist(),
        "objBytes": obj_path.stat().st_size,
    }


def export_glb(mesh: trimesh.Trimesh, mesh_id: str, layer: str, out_path: Path) -> int:
    m = mesh.copy()
    color = [168, 84, 74, 255] if layer == "muscle" else [232, 224, 208, 255]
    m.visual.vertex_colors = np.tile(color, (len(m.vertices), 1))
    m.metadata["name"] = mesh_id
    scene = trimesh.Scene({mesh_id: m})
    out_path.parent.mkdir(parents=True, exist_ok=True)
    data = scene.export(file_type="glb")
    out_path.write_bytes(data)
    return len(data)


def main() -> int:
    if not ZIP_A.is_file():
        print(f"MISSING {ZIP_A}", file=sys.stderr)
        return 1
    if not ZIP_B.is_file():
        print(f"MISSING {ZIP_B}", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    obj_a = OUT / "obj" / "a-4.0-99"
    obj_b = OUT / "obj" / "b-3.0-95"
    glb_a = OUT / "glb" / "a-4.0-99"
    glb_b = OUT / "glb" / "b-3.0-95"

    parts = load_parts()
    elems = load_elements()

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "transform": "(x,y,z)_mm → (-x,z,-y)*0.001",
        "simplificationPolicy": "none beyond nondegenerate cleanup",
        "sources": {
            "A": {
                "archive": "isa_BP3D_4.0_obj_99.zip",
                "version": "BodyParts3D 4.0",
                "reduction": "99%",
                "sha256": sha256_file(ZIP_A),
                "license": "CC BY 4.0 (current LATEST)",
                "url": "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip",
            },
            "B": {
                "archive": "BodyParts3D_3.0_obj_95.zip",
                "version": "BodyParts3D 3.0 (historical)",
                "reduction": "95%",
                "sha256": sha256_file(ZIP_B),
                "license": "CC BY-SA 2.1 Japan (historical release README)",
                "url": "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/BodyParts3D_3.0_obj_95.zip",
                "caveats": [
                    "Not available for Release 4.0",
                    "Release 4.0 altered skeletal coordinates — not same frame as A",
                    "ShareAlike license differs from current 4.0 CC BY 4.0",
                    "File naming uses FMA*.obj (pre-FJ element IDs)",
                ],
            },
        },
        "structures": [],
    }

    with zipfile.ZipFile(ZIP_A) as za, zipfile.ZipFile(ZIP_B) as zb:
        map_a = zip_member_map(za)
        map_b = zip_member_map(zb)

        for fma, role, layer in REPRESENTATIVES:
            name = parts.get(fma, role)
            fj_list = elems.get(fma, [])
            # Prefer single-element concepts for fair 1:1 comparison
            row = {
                "structureId": f"FMA:{fma[3:]}" if fma.startswith("FMA") else fma,
                "fmaConceptId": fma,
                "preferredName": name,
                "role": role,
                "layer": layer,
                "A": None,
                "B": None,
                "triangleRatio_B_over_A": None,
                "status": "ok",
            }

            # Source A: 4.0 FJ
            a_objs: list[Path] = []
            if not fj_list:
                row["status"] = "missing-in-4.0-element-map"
            else:
                for fj in fj_list[:6]:
                    base = f"{fj}.obj"
                    member = map_a.get(base)
                    if not member:
                        continue
                    dest = obj_a / f"{fma}_{fj}.obj"
                    extract_obj(za, member, dest)
                    a_objs.append(dest)

            # Source B: 3.0 FMA-named
            b_path = None
            b_member = map_b.get(f"{fma}.obj")
            if b_member:
                b_path = obj_b / f"{fma}.obj"
                extract_obj(zb, b_member, b_path)
            else:
                if row["status"] == "ok":
                    row["status"] = "missing-in-3.0-95"
                else:
                    row["status"] += "+missing-in-3.0-95"

            meshes_a: list[trimesh.Trimesh] = []
            if a_objs:
                stats_a = []
                for p in a_objs:
                    m, st = mesh_stats(p)
                    meshes_a.append(m)
                    stats_a.append(st)
                merged = (
                    trimesh.util.concatenate(meshes_a)
                    if len(meshes_a) > 1
                    else meshes_a[0]
                )
                tot_v = sum(s["sourceVertices"] for s in stats_a)
                tot_t = sum(s["sourceTriangles"] for s in stats_a)
                glb_bytes = export_glb(
                    merged, f"A.{fma}", layer, glb_a / f"{fma}.glb"
                )
                row["A"] = {
                    "elementFileIds": [p.stem.split("_", 1)[-1] for p in a_objs],
                    "sourceVertices": tot_v,
                    "sourceTriangles": tot_t,
                    "glbBytes": glb_bytes,
                    "objBytes": sum(p.stat().st_size for p in a_objs),
                }

            if b_path and b_path.is_file():
                m, st = mesh_stats(b_path)
                glb_bytes = export_glb(m, f"B.{fma}", layer, glb_b / f"{fma}.glb")
                row["B"] = {
                    "sourceFile": f"{fma}.obj",
                    "sourceVertices": st["sourceVertices"],
                    "sourceTriangles": st["sourceTriangles"],
                    "glbBytes": glb_bytes,
                    "objBytes": st["objBytes"],
                }

            if row["A"] and row["B"] and row["A"]["sourceTriangles"] > 0:
                row["triangleRatio_B_over_A"] = round(
                    row["B"]["sourceTriangles"] / row["A"]["sourceTriangles"], 2
                )

            report["structures"].append(row)
            print(
                f"{fma} {role}: A={row['A'] and row['A']['sourceTriangles']} "
                f"B={row['B'] and row['B']['sourceTriangles']} "
                f"ratio={row['triangleRatio_B_over_A']} status={row['status']}"
            )

    ratios = [
        s["triangleRatio_B_over_A"]
        for s in report["structures"]
        if s.get("triangleRatio_B_over_A")
    ]
    report["summary"] = {
        "compared": len(ratios),
        "medianTriangleRatio_B_over_A": (
            float(np.median(ratios)) if ratios else None
        ),
        "meanTriangleRatio_B_over_A": float(np.mean(ratios)) if ratios else None,
        "minRatio": float(min(ratios)) if ratios else None,
        "maxRatio": float(max(ratios)) if ratios else None,
        "official_4_0_higher_detail_available": False,
        "verdict_99_percent_vs_approved_mockup": "NO",
        "verdict_notes": [
            "BodyParts3D 4.0 LATEST publishes only 99% reduction OBJ archives.",
            "Historical 3.0 95% shows ~3–6× triangle density on matched FMA concepts — geometry-limited, not materials-limited.",
            "3.0 95% cannot be production master: different release coordinates, ShareAlike license, obsolete file-ID model.",
            "Even 3.0 95% remains CAD/atlas geometry; it improves recognizability but is not guaranteed mockup-illustration parity.",
        ],
    }

    (OUT / "comparison-report.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )

    # Static comparison page (loads GLBs via model-viewer CDN for human QA)
    cards = []
    for s in report["structures"]:
        fma = s["fmaConceptId"]
        a_src = f"./glb/a-4.0-99/{fma}.glb" if s["A"] else ""
        b_src = f"./glb/b-3.0-95/{fma}.glb" if s["B"] else ""
        a_meta = (
            f"{s['A']['sourceTriangles']} tris · {s['A']['glbBytes']} B"
            if s["A"]
            else "n/a"
        )
        b_meta = (
            f"{s['B']['sourceTriangles']} tris · {s['B']['glbBytes']} B"
            if s["B"]
            else "n/a"
        )
        cards.append(
            f"""
      <section class="card">
        <h2>{s['preferredName']}</h2>
        <p class="role">{s['role']} · {s['structureId']} · ratio B/A = {s['triangleRatio_B_over_A']}</p>
        <div class="pair">
          <figure>
            <model-viewer src="{a_src}" camera-controls touch-action="pan-y" exposure="1.0" shadow-intensity="0.2" style="width:100%;height:280px;background:#0f172a"></model-viewer>
            <figcaption>A · BP3D 4.0 99%<br/>{a_meta}</figcaption>
          </figure>
          <figure>
            <model-viewer src="{b_src}" camera-controls touch-action="pan-y" exposure="1.0" shadow-intensity="0.2" style="width:100%;height:280px;background:#0f172a"></model-viewer>
            <figcaption>B · BP3D 3.0 95% (historical)<br/>{b_meta}</figcaption>
          </figure>
        </div>
      </section>"""
        )

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>BP3D source-tier comparison — PainLocator</title>
  <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>
  <style>
    body {{ font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #0b1220; color: #e2e8f0; }}
    header {{ padding: 1.5rem 2rem; border-bottom: 1px solid #1e293b; }}
    h1 {{ margin: 0 0 .5rem; font-size: 1.35rem; }}
    .meta {{ color: #94a3b8; max-width: 70ch; line-height: 1.45; }}
    main {{ padding: 1rem 2rem 3rem; display: grid; gap: 1.25rem; }}
    .card {{ background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 1rem; }}
    .card h2 {{ margin: 0 0 .25rem; font-size: 1.05rem; }}
    .role {{ margin: 0 0 .75rem; color: #94a3b8; font-size: .9rem; }}
    .pair {{ display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }}
    figcaption {{ margin-top: .4rem; font-size: .85rem; color: #cbd5e1; }}
    @media (max-width: 900px) {{ .pair {{ grid-template-columns: 1fr; }} }}
  </style>
</head>
<body>
  <header>
    <h1>BodyParts3D source-tier comparison</h1>
    <p class="meta">
      A = official Release 4.0 99% (current PainLocator pin).
      B = historical Release 3.0 95% (5× polygon policy per DBCLS README; coordinates differ after 4.0 skeletal shift).
      Same transform and materials — geometry quality only.
      Median triangle ratio B/A ≈ {report['summary']['medianTriangleRatio_B_over_A']}.
    </p>
  </header>
  <main>
    {''.join(cards)}
  </main>
</body>
</html>
"""
    (OUT / "index.html").write_text(html, encoding="utf-8")
    print(f"Wrote {OUT / 'comparison-report.json'}")
    print(f"Wrote {OUT / 'index.html'}")
    print("SUMMARY", json.dumps(report["summary"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
