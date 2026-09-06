# Phase 2 Slice 3 — BP3D left-shoulder registration

**Date:** 2026-09-06  
**Status:** Rigid preview registration — **pass-preview** (not clinical precision)

Config: [`public/anatomy/spatial/registration/bp3d-shoulder-adult-male.json`](../public/anatomy/spatial/registration/bp3d-shoulder-adult-male.json)  
Validation artifact: [`public/anatomy/spatial/registration/bp3d-shoulder-adult-male.validation.json`](../public/anatomy/spatial/registration/bp3d-shoulder-adult-male.validation.json)

## Goal

Align the verified BodyParts3D left-shoulder prototype (`bp3d-prototype-shoulder`) to the current interim `adult-male` exterior so clinician Muscle / Skeletal layers appear under a ghosted surface without replacing the production exterior.

## Method (rigid only)

1. **Orientation** — Slice 2 already normalized BP3D to Y-up, +X anatomical right (meters). Exterior uses the same convention → **rotation = identity**.
2. **Uniform scale** — `scale = exterior.upperArmL.height / bp3d.humerus.height` ≈ `0.310 / 0.30731` ≈ **1.00875**.
3. **Translation** — Map scaled humerus centroid onto the midpoint of `surface.shoulderL` and `surface.upperArmL` centroids:
   - Target mid ≈ `(-0.28, 1.28, 0)`
   - Source humerus ≈ `(-0.19042, 1.18286, 0.07564)`
   - `translation = targetMid − sourceHumerus × scale` ≈ **`(-0.08792, 0.08678, −0.0763)`**

No nonlinear warping.

## Validation result

**PASS_PREVIEW** — credible for clinician layered preview.

- Laterality preserved (left / −X)
- Humerus length matches interim upper arm within ~1%
- Clavicle / scapula / deltoid / rotator-cuff remain in plausible relative positions
- Pack payloads: muscle **89 904 B**, skeletal **115 888 B** (lazy, clinician-only)

### Warnings (explicit)

- Interim exterior is a procedural mannequin, **not** a BP3D surface.
- Do **not** claim clinical co-registration precision or diagnostic localization.
- Soft-tissue silhouette vs scapular depth can disagree locally.

## Stop condition

A rigid transform **did** produce credible preview alignment → runtime layered display **proceeds**.

Had it failed, implementation would stop with `REGISTRATION FAILED` and recommend:

- **A.** Replace interim exterior with a BP3D-derived canonical surface, or  
- **B.** Introduce a shared canonical full-body registration model  

— not hide mismatch with transparency alone.

## Dev validation

Append `?spatialLayerValidation=1` on the clinician Spatial view to emphasize exterior + humerus + scapula + clavicle + deltoid + rotator cuff with orientation markers (dev aid only; not patient-facing).
