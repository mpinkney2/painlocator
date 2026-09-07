# Phase 2 Slice 6 — Canonical Styled Exterior (Option B)

**Date:** 2026-09-07  
**Branch:** `cursor/canonical-styled-exterior-83c7`  
**Depends on:** Vite ESM Spatial runtime (PR #16 / validated desktop Safari)

## Objective

Replace the interim capsule mannequin with a **calm medical silhouette** authored
natively in `painlocator-bp3d-canonical-v1`, while keeping:

- hidden BP3D canonical registration body
- identity shoulder Muscle / Skeletal packs
- existing `surface.*` / `PL:surface.*` meshId contract
- no BP3D regional expansion
- no persisted `canonicalBodyXYZ` schema change

## Architecture (Option B)

```
Styled exterior (visible)     ← NEW: adult-male/exterior-lod0.glb
        ↓ identity TRS
Canonical body frame          ← prototype-bp3d-fullbody/canonical-body.glb (hidden)
        ↓ identity packs
BP3D Muscle / Skeletal        ← prototype-bp3d (left shoulder proof)
```

## Assets

| Asset | Role | License |
| --- | --- | --- |
| `adult-male/exterior-lod0.glb` (~389 KB) | Visible styled silhouette | PainLocator procedural |
| `adult-male/styled-exterior-alignment-report.json` | Landmark residuals | — |
| `registration/exterior-to-canonical-v1.json` | **Identity** conformer | — |
| `registration/exterior-to-canonical-v1-mannequin-legacy.json` | Archived mannequin fit | — |
| `dev/interim-mannequin/exterior-lod0-capsule-mannequin.glb` | Archived capsule body | PainLocator procedural |
| `prototype-bp3d-fullbody/canonical-body.glb` | Hidden registration skin | BP3D CC BY 4.0 |

Generator: `scripts/generate-styled-exterior-glb.mjs`

## Landmark residuals

Part centers authored at BP3D target landmarks (shoulders, elbows, hips, knees,
ankles, vertex, body center):

| Metric | Value |
| --- | --- |
| mean | **0 mm** |
| max | **0 mm** |
| regional patches | **none** |

Classification: **pass-development** for landmark centers.  
**NOT ready for schema persistence** of `canonicalBodyXYZ` until surface-sample QA.

Prior mannequin conformer: mean ≈ 57 mm / max ≈ 97 mm (hips) — retired from production path.

## Vite Spatial hardening (Phase A)

- Runtime still uses Vite ESM chunk only (no `/vendor/three` or `/vendor/GLTFLoader`)
- `SpatialThreeLoader` remains a thin bridge to `PainLocatorSpatialRuntime`
- Diagnostics retained (`?spatialDiagnostics=1`)
- Browser smoke asserts vendor-zero + Surface↔Muscle↔Skeletal cycle
- Patient pack isolation unchanged

## Explicit non-goals

- No additional BP3D regions
- No Neural / Internal layers
- No broad clinician UI redesign
- No PainRegion schema migration
