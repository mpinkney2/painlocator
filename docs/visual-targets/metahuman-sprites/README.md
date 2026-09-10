# MetaHuman-style sprite set

Photorealistic body-type sprites for the Simple Pain Map gallery.

## Profiles (sex × life stage)

| Profile | Runtime folder | Clothing |
| --- | --- | --- |
| Adult man | `public/anatomy/metahuman/adult-male/` | Gray heather tee + shorts |
| Adult woman | `public/anatomy/metahuman/adult-female/` | Gray ribbed tank + shorts |
| Teen boy | `public/anatomy/metahuman/teen-male/` | Gray tee + shorts |
| Teen girl | `public/anatomy/metahuman/teen-female/` | Gray tank + shorts |
| Boy | `public/anatomy/metahuman/child-male/` | Gray tee + shorts |
| Girl | `public/anatomy/metahuman/child-female/` | Gray tee + shorts |
| Elderly man | `public/anatomy/metahuman/senior-male/` | Gray tee + shorts |
| Elderly woman | `public/anatomy/metahuman/senior-female/` | Gray tee + shorts |

Legacy folders `teen/`, `child/`, and `senior/` are copies of the male plates so older URLs keep working.

- **Preview frames:** `frames/{profile}-{view}.png`
- **HQ stills:** `hq-raw/{profile}-{view}.png`
- **Viewer:** [`index.html`](./index.html)
- **Runtime pack:** `python3 scripts/build-metahuman-anatomy-pack.py`

The Simple Pain Map (patient shell) loads these plates instead of the blue clinical atlas. Clinician mode keeps the classic 5-folder atlas (`adult-male`, `adult-female`, `teen`, `child`, `senior`).

## Spec

- Style: Unreal-like MetaHuman photoreal figure
- Views: front · back · left · right
- Background: **none** (transparent PNG after green-screen key)
- Clothing: light gray t-shirt and shorts (women / teen girl: tank or modest tee and shorts)
- Plates: portrait 2048×3072 RGBA retina stills (4× FSRCNN upscale, then chroma-keyed)
