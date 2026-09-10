#!/usr/bin/env python3
"""Build production MetaHuman plates from high-res chroma-key portraits.

Reads HQ green-screen stills, super-resolves them 4× (FSRCNN), keys them to
transparent PNG frames, then letterboxes onto 2048×3072 plates so a large
retina map downsamples instead of upscaling pixelated eval sprites.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
HQ_SRC = Path("/opt/cursor/artifacts/assets")
HQ_REPO = ROOT / "docs" / "visual-targets" / "metahuman-sprites" / "hq-raw"
FRAMES = ROOT / "docs" / "visual-targets" / "metahuman-sprites" / "frames"
OUT = ROOT / "public" / "anatomy" / "metahuman"
FSRCNN_MODEL = ROOT / "scripts" / "vendor" / "FSRCNN_x4.pb"
PLATE_W = 2048
PLATE_H = 3072
THUMB_W = 240
THUMB_H = 480
SR_SCALE = 4
PAD = 0.035

MAP = {
    "woman": "adult-female",
    "man": "adult-male",
    "teen": "teen",
    "child": "child",
    "elderly": "senior",
}
VIEWS = ["front", "back", "left", "right"]


def super_resolve(im: Image.Image) -> Image.Image:
    """4× photoreal upscale. Falls back to Lanczos if OpenCV is unavailable."""
    rgb = im.convert("RGB")
    try:
        import cv2
    except ImportError:
        return rgb.resize((rgb.width * SR_SCALE, rgb.height * SR_SCALE), Image.Resampling.LANCZOS)
    if not FSRCNN_MODEL.exists():
        return rgb.resize((rgb.width * SR_SCALE, rgb.height * SR_SCALE), Image.Resampling.LANCZOS)
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(str(FSRCNN_MODEL))
    sr.setModel("fsrcnn", SR_SCALE)
    bgr = cv2.cvtColor(np.asarray(rgb), cv2.COLOR_RGB2BGR)
    out = sr.upsample(bgr)
    return Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))


def chroma_key(im: Image.Image) -> Image.Image:
    """Remove saturated green screen and despill edges."""
    rgb = np.asarray(im.convert("RGB"), dtype=np.float32)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    green_dom = g - np.maximum(r, b)
    # Soft alpha: full transparent on screen, keep subject
    alpha = np.clip((42.0 - green_dom) * (255.0 / 42.0), 0, 255)
    # Also punch out near-pure chroma green even if dominance is milder
    near_screen = (g > 140) & (green_dom > 18) & (g > r * 1.15) & (g > b * 1.15)
    alpha = np.where(near_screen, np.minimum(alpha, 12.0), alpha)
    # Despill leftover green on hair/edges
    g = np.minimum(g, (r + b) * 0.5 + 10.0)
    rgba = np.dstack([r, g, b, alpha]).astype(np.uint8)
    keyed = Image.fromarray(rgba, "RGBA")
    rgb_img, a = keyed.convert("RGB"), keyed.getchannel("A")
    # Slight blur on alpha only to reduce stair-step at the new high res
    a = a.filter(ImageFilter.GaussianBlur(radius=1.1))
    keyed.putalpha(a)
    return keyed


def crop_to_subject(im: Image.Image, pad_px: int = 24) -> Image.Image:
    alpha = np.asarray(im.getchannel("A"))
    ys, xs = np.where(alpha > 18)
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
    if scale < 1.0:
        # Downsampling from the 4× still — a touch of contrast keeps fabric/skin crisp
        rgb, a = resized.convert("RGB"), resized.getchannel("A")
        rgb = ImageEnhance.Sharpness(rgb).enhance(1.12)
        resized = rgb.convert("RGBA")
        resized.putalpha(a)
    canvas.paste(resized, ((width - nw) // 2, (height - nh) // 2), resized)
    return canvas


def resolve_hq(profile: str, view: str) -> Path:
    names = [
        f"mh-prod-{profile}-{view}.png",
        f"mh-hq-{profile}-{view}.png",
    ]
    HQ_REPO.mkdir(parents=True, exist_ok=True)
    repo = HQ_REPO / f"{profile}-{view}.png"
    for name in names:
        artifact = HQ_SRC / name
        if artifact.exists():
            shutil.copy2(artifact, repo)
            return repo
    if repo.exists():
        return repo
    raise SystemExit(f"missing HQ still mh-prod-{profile}-{view}.png")


def main() -> None:
    FRAMES.mkdir(parents=True, exist_ok=True)
    thumb_dir = OUT / "thumbs"
    thumb_dir.mkdir(parents=True, exist_ok=True)

    for profile, folder in MAP.items():
        dest = OUT / folder
        dest.mkdir(parents=True, exist_ok=True)
        for view in VIEWS:
            src = resolve_hq(profile, view)
            print(f"  {profile} {view}: {src.name} {Image.open(src).size}", flush=True)
            upscaled = super_resolve(Image.open(src))
            keyed = crop_to_subject(chroma_key(upscaled))
            frame_path = FRAMES / f"{profile}-{view}.png"
            preview = keyed
            if preview.height > 1280:
                scale = 1280 / preview.height
                preview = preview.resize(
                    (max(1, int(preview.width * scale)), 1280),
                    Image.Resampling.LANCZOS,
                )
            preview.save(frame_path, "PNG", optimize=True, compress_level=6)
            plate = fit_on_canvas(keyed, PLATE_W, PLATE_H, PAD)
            plate.save(dest / f"{view}.png", "PNG", optimize=True, compress_level=6)

        front = Image.open(FRAMES / f"{profile}-front.png")
        thumb = fit_on_canvas(front, THUMB_W, THUMB_H, 0.02)
        thumb.save(thumb_dir / f"{folder}.png", "PNG", optimize=True, compress_level=9)

    manifest = {
        "id": "metahuman",
        "label": "Lifelike body (MetaHuman-style)",
        "schemaVersion": 1,
        "width": PLATE_W,
        "height": PLATE_H,
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
        "notes": "Retina 2048×3072 plates keyed from 4×-upscaled MetaHuman stills.",
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote pack under {OUT}")


if __name__ == "__main__":
    main()
