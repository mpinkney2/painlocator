# BodyParts3D ingest (PainLocator Phase 2 Slice 2)

Offline / build-time pipeline only. Does **not** change the production Spatial viewer.

## Canonical PainLocator space

| Property | Value |
| --- | --- |
| Units | meters |
| Up | +Y |
| Handedness | right-handed |
| Facing | +Z anterior (toward default camera) |
| Laterality | +X = anatomical **right** |
| Origin | BodyParts3D world origin after unit/axis remap (feet near Y≈0 in full body; subset keeps absolute registration) |

### Source → canonical transform

BodyParts3D OBJ space is millimeters, Z-up, +X anatomical left.

```text
[x_pl]   [ -0.001   0      0   ] [x_bp3d]
[y_pl] = [  0       0      0.001] [y_bp3d]
[z_pl]   [  0      -0.001  0   ] [z_bp3d]
```

Equivalent: `(x, y, z)_mm → (-x, z, -y) * 0.001`.

No additional unexplained rotations are applied.

## Commands

```bash
# Optional: re-fetch official zip + mapping tables and verify checksums
node tools/bp3d-ingest/fetch-source.mjs

# Verify subset OBJ checksums + FMA mapping consistency
python3 tools/bp3d-ingest/verify_source.py

# Run full ingest → public/anatomy/spatial/prototype-bp3d/
python3 tools/bp3d-ingest/ingest.py

# Meshopt compress GLBs (no join / no simplify)
node tools/bp3d-ingest/optimize.mjs

# Integrity tests (also included in npm test)
node tools/bp3d-ingest/test-integrity.mjs
```

## Outputs

`public/anatomy/spatial/prototype-bp3d/`

- `manifest.json` — PainLocator-compatible prototype manifest (`FMA:` structureIds)
- `skeletal.glb` / `muscle.glb` — layer packs; mesh names = stable `meshId`
- `LICENSE.md` — CC BY 4.0 attribution
- `build-report.json` — validation + payload sizes
- `raw-pre-meshopt/` — pre-compression GLBs for size comparison

## Python deps

```bash
pip install -r tools/bp3d-ingest/requirements.txt
```

## Intentionally not done

- Not registered in `public/anatomy/spatial/manifest.json`
- Does not replace `adult-male/exterior-lod0.glb`
- No Patient/Clinician UI changes
- No Blender-required steps
