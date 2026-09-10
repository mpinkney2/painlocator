# Likeness builder & MetaHuman anatomy pack

## What shipped

Patients can load a **lifelike body** from the MetaHuman-style gallery and customize a simple likeness:

| Capability | Status |
| --- | --- |
| Body types (woman / man / teen / child / elderly) | **Live** — drives CAE `modelType` + plate pack |
| Facial tone presets | **Live** — CSS appearance on plate (MVP) |
| Body build presets | **Live** — horizontal scale on plate (MVP) |
| Photo likeness upload | **Live** — device-local reference chip only |
| Classic clinical atlas toggle | **Live** — pack switch `metahuman` ↔ `classic` |
| Full-body scan → personal mesh | **Roadmap** — UI stub only |

## Architecture (CAE-safe)

```
src/features/likeness/     → gallery UX, prefs, photo (PainLocator app)
src/engine/anatomy/asset-paths.js → pack-aware getAssetPath() (reusable CAE)
public/anatomy/metahuman/  → letterboxed RGBA plates (1024²) + thumbs
```

- Coordinate marking still uses normalized plate space from CAE.
- Pack choice does **not** change session schema; only which PNG is shown.
- MetaHuman art is an appearance pack, not a clinical diagnosis surface.

## Packs

- `classic` → `/anatomy/{model}/{view}.png` (existing atlas)
- `metahuman` → `/anatomy/metahuman/{model}/{view}.png` (default for new likeness flow)

Persisted in `localStorage`:

- `painlocator.anatomyPack`
- `painlocator.likeness.v1`

## Roadmap — full body scan

1. Capture (phone LiDAR / photogrammetry / clinic scanner)
2. Mesh cleanup + A-pose normalize
3. Register mesh to CAE canonical frame (same as Spatial exterior path)
4. Bake plate projections for front/back/left/right **or** mark directly in Spatial
5. Store likeness asset refs in session (versioned), never raw PHI in git

Facial / “Acala” (facial) features will graduate from CSS presets to true MetaHuman DNA / blend-shape controls when a licensed MetaHuman or equivalent runtime is available.

## Regen plates

```bash
python3 scripts/build-metahuman-anatomy-pack.py
```

Source frames: `docs/visual-targets/metahuman-sprites/frames/`
