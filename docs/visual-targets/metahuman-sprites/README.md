# MetaHuman-style sprite set

Photorealistic body-type sprite sheets for visual comparison (Eval only — not wired into the pain-map runtime).

## Profiles

| Profile | Sheet | Frames |
| --- | --- | --- |
| Woman | [`sheets/woman.png`](./sheets/woman.png) | `frames/woman-{front,back,left,right}.png` |
| Man | [`sheets/man.png`](./sheets/man.png) | `frames/man-*.png` |
| Teen | [`sheets/teen.png`](./sheets/teen.png) | `frames/teen-*.png` |
| Child | [`sheets/child.png`](./sheets/child.png) | `frames/child-*.png` |
| Elderly | [`sheets/elderly.png`](./sheets/elderly.png) | `frames/elderly-*.png` |

- **Atlas:** [`metahuman-atlas.png`](./metahuman-atlas.png) — 5×4 (profile × view), transparent RGBA  
- **Preview:** [`metahuman-atlas-preview.png`](./metahuman-atlas-preview.png) — checkerboard alpha preview  
- **Viewer:** [`index.html`](./index.html)

## Spec

- Style: Unreal-like MetaHuman photoreal figure
- Views per sheet (L→R): front · back · left · right
- Background: **none** (transparent PNG after green-screen key)
- Clothing: neutral light-gray athletic base layer (clinical mannequin reference)
- Not a production drop-in for `public/anatomy/`

## Layout

Each `sheets/{profile}.png` is 1280×720 RGBA with four equal columns.  
Atlas cells are 256×512, rows = woman → man → teen → child → elderly.
