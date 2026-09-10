# MetaHuman-style sprite set

Photorealistic body-type sprites for the Simple Pain Map gallery.

## Profiles

| Profile | Sheet | Frames | Runtime folder |
| --- | --- | --- | --- |
| Woman | [`sheets/woman.png`](./sheets/woman.png) | `frames/woman-{front,back,left,right}.png` | `public/anatomy/metahuman/adult-female/` |
| Man | [`sheets/man.png`](./sheets/man.png) | `frames/man-*.png` | `public/anatomy/metahuman/adult-male/` |
| Teen | [`sheets/teen.png`](./sheets/teen.png) | `frames/teen-*.png` | `public/anatomy/metahuman/teen/` |
| Child | [`sheets/child.png`](./sheets/child.png) | `frames/child-*.png` | `public/anatomy/metahuman/child/` |
| Elderly | [`sheets/elderly.png`](./sheets/elderly.png) | `frames/elderly-*.png` | `public/anatomy/metahuman/senior/` |

- **Atlas:** [`metahuman-atlas.png`](./metahuman-atlas.png) — 5×4 (profile × view), transparent RGBA
- **Preview:** [`metahuman-atlas-preview.png`](./metahuman-atlas-preview.png) — checkerboard alpha preview
- **Viewer:** [`index.html`](./index.html)
- **Runtime pack:** `python3 scripts/build-metahuman-anatomy-pack.py`

The Simple Pain Map (patient shell) loads these plates instead of the blue clinical atlas.

## Spec

- Style: Unreal-like MetaHuman photoreal figure
- Views per sheet (L→R): front · back · left · right
- Background: **none** (transparent PNG after green-screen key)
- Clothing: light gray heather t-shirt and shorts for every profile (woman: matching tank and shorts)
- Plates: portrait 2048×3072 RGBA retina stills (4× FSRCNN upscale, then chroma-keyed)

## Layout

Each `sheets/{profile}.png` is 1280×720 RGBA with four equal columns.
Atlas cells are 256×512, rows = woman → man → teen → child → elderly.
