#!/usr/bin/env python3
"""Letterbox MetaHuman eval frames into 1024² CAE plate pack + thumbs."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "visual-targets" / "metahuman-sprites" / "frames"
OUT = ROOT / "public" / "anatomy" / "metahuman"
SIZE = 1024

MAP = {
    "woman": "adult-female",
    "man": "adult-male",
    "teen": "teen",
    "child": "child",
    "elderly": "senior",
}
VIEWS = ["front", "back", "left", "right"]


def letterbox(im: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    scale = min(SIZE / im.width, SIZE / im.height) * 0.92
    nw = max(1, int(im.width * scale))
    nh = max(1, int(im.height * scale))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((SIZE - nw) // 2, (SIZE - nh) // 2), resized)
    return canvas


def main() -> None:
    thumb_dir = OUT / "thumbs"
    thumb_dir.mkdir(parents=True, exist_ok=True)

    for profile, folder in MAP.items():
        dest = OUT / folder
        dest.mkdir(parents=True, exist_ok=True)
        for view in VIEWS:
            src = SRC / f"{profile}-{view}.png"
            if not src.exists():
                raise SystemExit(f"missing {src}")
            plate = letterbox(Image.open(src).convert("RGBA"))
            plate.save(dest / f"{view}.png", "PNG", optimize=True)

        front = Image.open(SRC / f"{profile}-front.png").convert("RGBA")
        front.thumbnail((160, 320), Image.Resampling.LANCZOS)
        thumb = Image.new("RGBA", (120, 240), (0, 0, 0, 0))
        thumb.paste(front, ((120 - front.width) // 2, (240 - front.height) // 2), front)
        thumb.save(thumb_dir / f"{folder}.png", "PNG")

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
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote pack under {OUT}")


if __name__ == "__main__":
    main()
