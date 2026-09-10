#!/usr/bin/env python3
"""Arrange MetaHuman sprite frames into portrait CAE plates + gallery thumbs.

Source: docs/visual-targets/metahuman-sprites/frames/{profile}-{view}.png
Output: public/anatomy/metahuman/{adult-male,adult-female,teen,child,senior}/
Plate size matches the simple-pain-map studio plates (768×1152) so the
figure fills the patient map the same way.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "visual-targets" / "metahuman-sprites" / "frames"
OUT = ROOT / "public" / "anatomy" / "metahuman"
PLATE_W = 768
PLATE_H = 1152
THUMB_W = 96
THUMB_H = 192
PAD = 0.06

MAP = {
    "woman": "adult-female",
    "man": "adult-male",
    "teen": "teen",
    "child": "child",
    "elderly": "senior",
}
VIEWS = ["front", "back", "left", "right"]


def fit_on_canvas(im: Image.Image, width: int, height: int, pad: float = 0.0) -> Image.Image:
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    inner_w = width * (1.0 - pad)
    inner_h = height * (1.0 - pad)
    scale = min(inner_w / im.width, inner_h / im.height)
    nw = max(1, int(im.width * scale))
    nh = max(1, int(im.height * scale))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((width - nw) // 2, (height - nh) // 2), resized)
    return canvas


def main() -> None:
    if not SRC.is_dir():
        raise SystemExit(f"missing sprite frames at {SRC}")

    thumb_dir = OUT / "thumbs"
    thumb_dir.mkdir(parents=True, exist_ok=True)

    for profile, folder in MAP.items():
        dest = OUT / folder
        dest.mkdir(parents=True, exist_ok=True)
        for view in VIEWS:
            src = SRC / f"{profile}-{view}.png"
            if not src.exists():
                raise SystemExit(f"missing {src}")
            plate = fit_on_canvas(Image.open(src).convert("RGBA"), PLATE_W, PLATE_H, PAD)
            plate.save(dest / f"{view}.png", "PNG", optimize=True)

        front = Image.open(SRC / f"{profile}-front.png").convert("RGBA")
        thumb = fit_on_canvas(front, THUMB_W, THUMB_H, 0.02)
        thumb.save(thumb_dir / f"{folder}.png", "PNG", optimize=True)

    manifest = {
        "id": "metahuman",
        "label": "Lifelike body (MetaHuman-style)",
        "schemaVersion": 1,
        "models": {
            folder: {
                "label": label,
                "thumb": f"/anatomy/metahuman/thumbs/{folder}.png",
            }
            for label, folder in [
                ("Man", "adult-male"),
                ("Woman", "adult-female"),
                ("Teen", "teen"),
                ("Child", "child"),
                ("Elderly", "senior"),
            ]
        },
        "views": VIEWS,
        "notes": "Portrait RGBA plates from docs/visual-targets/metahuman-sprites for the simple pain map.",
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote pack under {OUT}")


if __name__ == "__main__":
    main()
