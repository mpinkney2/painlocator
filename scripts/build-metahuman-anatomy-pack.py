#!/usr/bin/env python3
"""Build production MetaHuman plates from high-res chroma-key portraits.

Reads HQ green-screen stills, keys them to transparent PNG frames, then
letterboxes onto 1024×1536 plates (2:3, 2× the old 512-class eval frames).
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
HQ_SRC = Path("/opt/cursor/artifacts/assets")
HQ_REPO = ROOT / "docs" / "visual-targets" / "metahuman-sprites" / "hq-raw"
FRAMES = ROOT / "docs" / "visual-targets" / "metahuman-sprites" / "frames"
OUT = ROOT / "public" / "anatomy" / "metahuman"
PLATE_W = 1024
PLATE_H = 1536
THUMB_W = 160
THUMB_H = 320
PAD = 0.04

MAP = {
    "woman": "adult-female",
    "man": "adult-male",
    "teen": "teen",
    "child": "child",
    "elderly": "senior",
}
VIEWS = ["front", "back", "left", "right"]


def chroma_key(im: Image.Image) -> Image.Image:
    """Remove saturated green screen and despill edges."""
    rgb = np.asarray(im.convert("RGB"), dtype=np.float32)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    green_dom = g - np.maximum(r, b)
    # Soft alpha: full transparent on screen, keep subject
    alpha = np.clip((50.0 - green_dom) * (255.0 / 50.0), 0, 255)
    # Despill leftover green on hair/edges
    g = np.minimum(g, np.maximum(r, b) + 8.0)
    rgba = np.dstack([r, g, b, alpha]).astype(np.uint8)
    keyed = Image.fromarray(rgba, "RGBA")
    # Slight blur on alpha only to reduce stair-step
    rgb_img, a = keyed.convert("RGB"), keyed.getchannel("A")
    a = a.filter(ImageFilter.GaussianBlur(radius=0.6))
    keyed.putalpha(a)
    return keyed


def crop_to_subject(im: Image.Image, pad_px: int = 8) -> Image.Image:
    alpha = np.asarray(im.getchannel("A"))
    ys, xs = np.where(alpha > 16)
    if xs.size == 0:
        return im
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    x0 = max(0, x0 - pad_px)
    y0 = max(0, y0 - pad_px)
    x1 = min(im.width - 1, x1 + pad_px)
    y1 = min(im.height - 1, y1 + pad_px)
    return im.crop((x0, y0, x1 + 1, y1 + 1))


def fit_on_canvas(im: Image.Image, width: int, height: int, pad: float = 0.0) -> Image.Image:
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    inner_w = width * (1.0 - pad)
    inner_h = height * (1.0 - pad)
    scale = min(inner_w / im.width, inner_h / im.height)
    nw = max(1, int(im.width * scale))
    nh = max(1, int(im.height * scale))
    resample = Image.Resampling.LANCZOS
    resized = im.resize((nw, nh), resample)
    canvas.paste(resized, ((width - nw) // 2, (height - nh) // 2), resized)
    return canvas


def resolve_hq(profile: str, view: str) -> Path:
    name = f"mh-hq-{profile}-{view}.png"
    artifact = HQ_SRC / name
    repo = HQ_REPO / f"{profile}-{view}.png"
    if artifact.exists():
        HQ_REPO.mkdir(parents=True, exist_ok=True)
        shutil.copy2(artifact, repo)
        return repo
    if repo.exists():
        return repo
    raise SystemExit(f"missing HQ still {name}")


def main() -> None:
    FRAMES.mkdir(parents=True, exist_ok=True)
    thumb_dir = OUT / "thumbs"
    thumb_dir.mkdir(parents=True, exist_ok=True)

    for profile, folder in MAP.items():
        dest = OUT / folder
        dest.mkdir(parents=True, exist_ok=True)
        for view in VIEWS:
            src = resolve_hq(profile, view)
            keyed = crop_to_subject(chroma_key(Image.open(src)))
            frame_path = FRAMES / f"{profile}-{view}.png"
            keyed.save(frame_path, "PNG", optimize=True)
            plate = fit_on_canvas(keyed, PLATE_W, PLATE_H, PAD)
            plate.save(dest / f"{view}.png", "PNG", optimize=True)

        front = Image.open(FRAMES / f"{profile}-front.png")
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
        "notes": "Production-resolution portrait plates keyed from HQ MetaHuman stills.",
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote pack under {OUT}")


if __name__ == "__main__":
    main()
