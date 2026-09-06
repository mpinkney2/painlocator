#!/usr/bin/env python3
"""Write a DEV-ONLY orientation marker report + SVG for the BP3D shoulder pack."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "anatomy" / "spatial" / "prototype-bp3d"
REPORT = OUT / "build-report.json"
DEV = ROOT / "tools" / "bp3d-ingest" / "dev"
SVG = DEV / "orientation-preview.svg"
JSON_OUT = OUT / "orientation-check.json"


def main() -> int:
    report = json.loads(REPORT.read_text())
    orientation = report["orientation"]
    registration = report["registration"]
    humerus = next(v for v in report["validation"] if v["meshId"] == "bone.humerus.left")
    cx, cy, cz = humerus["centroidMeters"]

    # Project centroids onto coronal (X/Y) and transverse (X/Z) for the SVG.
    sk = registration["skeletal"]["meshCentroids"]
    mu = registration["muscle"]["meshCentroids"]

    DEV.mkdir(parents=True, exist_ok=True)

    def proj_xy(p):
        # SVG: x right, y down → map anatomical +X right, +Y superior to +x, -y
        return 200 + p[0] * 400, 280 - p[1] * 180

    def proj_xz(p):
        return 200 + p[0] * 400, 160 - p[2] * 400

    dots = []
    for name, p in {**sk, **mu}.items():
        x, y = proj_xy(p)
        color = "#2a6" if name.startswith("bone.") else "#c63"
        dots.append(
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" fill="{color}">'
            f'<title>{name}</title></circle>'
        )

    hx, hy = proj_xy([cx, cy, cz])
    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="360" viewBox="0 0 420 360">
  <rect width="420" height="360" fill="#0b1220"/>
  <text x="12" y="22" fill="#dbe7ff" font-family="monospace" font-size="13">
    BP3D left-shoulder orientation (DEV) — coronal X/Y
  </text>
  <text x="12" y="40" fill="#8fa3c4" font-family="monospace" font-size="11">
    +X right · +Y superior · markers: L/R/S/I · green=bone orange=muscle
  </text>
  <!-- axes -->
  <line x1="200" y1="60" x2="200" y2="300" stroke="#445" stroke-width="1"/>
  <line x1="40" y1="280" x2="380" y2="280" stroke="#445" stroke-width="1"/>
  <text x="205" y="72" fill="#9cf" font-family="monospace" font-size="12">S (superior)</text>
  <text x="205" y="318" fill="#9cf" font-family="monospace" font-size="12">I (inferior)</text>
  <text x="350" y="275" fill="#9cf" font-family="monospace" font-size="12">R</text>
  <text x="48" y="275" fill="#9cf" font-family="monospace" font-size="12">L</text>
  {''.join(dots)}
  <circle cx="{hx:.1f}" cy="{hy:.1f}" r="7" fill="none" stroke="#fff" stroke-width="1.5"/>
  <text x="{hx + 10:.1f}" y="{hy - 8:.1f}" fill="#fff" font-family="monospace" font-size="11">humerus L</text>
  <text x="12" y="345" fill="{('#6d6' if orientation['pass'] else '#f66')}" font-family="monospace" font-size="12">
    orientation pass={orientation['pass']} · skeletal↔muscle sep={registration.get('layerCentroidSeparationMeters', registration.get('layerCentroidSeparationMeters', 0)):.4f}m
  </text>
</svg>
"""
    SVG.write_text(svg, encoding="utf-8")

    payload = {
        "devOnly": True,
        "notWiredToProductionViewer": True,
        "orientation": orientation,
        "registration": {
            "layerCentroidSeparationMeters": registration["layerCentroidSeparationMeters"],
            "pass": registration["pass"],
        },
        "markers": {
            "LEFT": "negative X",
            "RIGHT": "positive X",
            "SUPERIOR": "positive Y",
            "INFERIOR": "negative Y",
            "ANTERIOR": "positive Z (heuristic for this pack)",
            "POSTERIOR": "negative Z",
        },
        "humerusCentroidMeters": [cx, cy, cz],
        "svgPreview": "tools/bp3d-ingest/dev/orientation-preview.svg",
    }
    JSON_OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {SVG}")
    print(f"Wrote {JSON_OUT}")
    print(f"orientation pass={orientation['pass']}")
    return 0 if orientation["pass"] and registration["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
