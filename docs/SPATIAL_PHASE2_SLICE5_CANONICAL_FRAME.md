# Phase 2 Slice 5 — Feature-flagged canonical frame + global exterior conformer

**Date:** 2026-09-06  
**Branch:** `cursor/spatial-phase2-slice5-canonical-frame-83c7`  
**Base:** `main` after PR #12 (Slice 4) merge  
**Status:** Runtime feature-flagged (default **OFF**)

**Companions:**  
[`CANONICAL_BODY_ARCHITECTURE.md`](./CANONICAL_BODY_ARCHITECTURE.md) ·  
[`SPATIAL_PHASE2_SLICE3_REGISTRATION.md`](./SPATIAL_PHASE2_SLICE3_REGISTRATION.md) ·  
[`SPATIAL_PHASE2_SLICE3_CLINICIAN_LAYERS.md`](./SPATIAL_PHASE2_SLICE3_CLINICIAN_LAYERS.md)

---

## Goal

Introduce `painlocator-bp3d-canonical-v1` into Spatial runtime **without**:

- replacing the default stylized patient exterior
- changing persisted PainEntry / PainRegion schema
- making canonical mode the default

Prove:

1. Hidden BP3D canonical body can exist in runtime  
2. Stylized exterior can be **globally** conformed into that frame  
3. Hits can project to runtime-only `canonicalBodyXYZ`  
4. Clinician shoulder packs use **identity** registration in canonical mode  
5. Flag OFF preserves production behavior (including Slice 3 shoulder adapter)

---

## Feature flag

| Key | Default |
| --- | --- |
| `?canonicalBodyMode=true` (or `1`) | **OFF** |
| `?canonicalFrame=1` | alias (architecture §O) |
| `window.PAINLOCATOR_CANONICAL_BODY_MODE` | optional test override |

Not a patient-facing setting. Module: `src/engine/spatial/canonical-body-flag.js`.

Dev overlay: `?canonicalAlignmentValidation=1` (with flag ON) reveals translucent/wireframe canonical reference + landmark spheres + axes. Console logs the alignment report.

---

## Runtime architecture

```
SpatialAnatomyRenderer.mount
        │
        ├─ loadExteriorBody (adult-male stylized)     always
        │
        └─ if canonicalBodyMode
              ├─ CanonicalBodyFrame.load()
              │     • prototype-bp3d-fullbody/canonical-body.glb (hidden)
              │     • exterior-to-canonical-v1.json
              ├─ apply global conformer → exterior.root TRS
              ├─ projectHitToCanonical → runtime-only debug map
              └─ shoulder packs: identity registration JSON
           else
              └─ shoulder packs: Slice 3 bp3d-shoulder-adult-male.json
```

| Object | Role |
| --- | --- |
| **CanonicalBodyFrame** | Frame id, hidden registration mesh, bounds, projection helpers, dispose |
| **ExteriorCanonicalConformer** | Load/validate/apply one global transform; alignment report |
| **SpatialLayerLoader** | Registration URL keyed cache; identity vs legacy |

CAE remains the controlling abstraction; modules live under `src/engine/spatial/`.

---

## Global conformer strategy

**Method:** uniform scale + identity rotation + translation (least-squares landmark fit).  
**Artifact:** `public/anatomy/spatial/registration/exterior-to-canonical-v1.json`  
**registrationVersion:** `exterior-to-canonical-v1`

### Transform

| Component | Value |
| --- | --- |
| scale | `0.9578456703475133` |
| rotationEuler | `[0, 0, 0]` |
| translation (m) | `[0.000787, -0.058500, 0.082354]` |

Small-rotation search (±0.15 rad) improved mean error by &lt;3 mm — **identity R retained**.

### Landmarks used

vertex · shoulderL/R · elbowL/R · hipL/R · kneeL/R · ankleL/R · bodyCenter  

Wrists considered but **not used** (pose divergence inflates residual without improving torso/shoulder fit).

### Alignment validation (development / preview — not clinical)

| Metric | Value |
| --- | --- |
| mean landmark error | **≈ 57 mm** |
| max landmark error | **≈ 97 mm** (hips) |
| status | `pass-preview` |
| stop condition | **not triggered** |
| verdict | `CREDIBLE_ENOUGH_TO_CONTINUE` |

Obvious local mismatch: mannequin hip width vs BP3D skin. Documented — **no regional patches**.

---

## Canonical projection (runtime only)

**Strategy D (implemented):**

1. **Raw:** world hit → `bodyRoot` local (exterior already conformed) ≈ canonical meters  
2. **Nearest:** sampled nearest vertex on hidden canonical skin (stride 12)  
3. Preferred `canonicalBodyXYZ` = nearest if available, else raw  
4. Track `projectionErrorMeters` in debug

Exposed on:

- `engine.spatialCanonicalDebug` Map (session)
- `attachment.canonicalDebug` (session attachment only)

**Not** written to `createPointRegion` / localStorage / reports.

Frame metadata alongside XYZ:

- `coordinateFrameVersion`
- `canonicalModelId`
- `canonicalModelVersion`
- `registrationVersion`

---

## Shoulder registration

| Mode | Registration |
| --- | --- |
| Flag **OFF** | `bp3d-shoulder-adult-male.json` (Slice 3 — **kept**) |
| Flag **ON** | `bp3d-shoulder-canonical-identity.json` (scale 1, t=0) |

Humerus / scapula / clavicle / deltoid / rotator cuff co-locate with canonical skin under identity (Slice 4 validation).

---

## Patient isolation

- Canonical mesh `visible=false` unless `canonicalAlignmentValidation`  
- `raycast` disabled on canonical meshes  
- Patient shell never constructs layer controller (unchanged)  
- Materials/colors of stylized exterior unchanged (only global TRS when flagged)  
- Locate / Describe / Review UI unchanged  
- Plate mode never mounts Spatial → never downloads canonical GLB  
- Flag OFF Spatial never downloads canonical GLB

---

## Performance (nominal)

| Item | Notes |
| --- | --- |
| Canonical payload | ~361 KB (`canonical-body.glb` meshopt) |
| Lazy load | Only flagged Spatial mount |
| Plate | No Three / no canonical fetch |
| Projection | Occasional nearest-vertex sample (stride 12) on place |

---

## Failure behavior

- Canonical load / conformer failure → warn, dispose frame, **continue normal Spatial** (not forced to plate)  
- `GLOBAL CONFORMER FAILED` in JSON validation → throw; mount treats as canonical failure  
- Layer pack failure → existing Surface revert path

---

## Tests

Covered in `scripts/run-tests.mjs`:

- flag OFF default  
- flag ON resolution  
- conformer validate + stop condition  
- identity vs legacy registration URLs  
- patient cannot load packs  
- plate/scripts do not auto-fetch canonical assets  
- schema fields on PainRegion unchanged  
- adult-male manifest frame metadata present  

---

## Known limitations

- Hip-width / AP soft-tissue mismatch remains (~max 97 mm)  
- Procedural exterior still not BP3D-derived — remesh recommended before claiming tighter alignment  
- Nearest-surface projection is vertex-sampled, not continuous closest-point  
- `canonicalBodyXYZ` not persisted yet (intentional)  
- Camera framing not re-tuned for conformed AABB (minor)

---

## Verdict

**Global conformer is credible enough to continue** as development / preview alignment.  
Do **not** persist `canonicalBodyXYZ` yet.  
Do **not** expand anatomy coverage yet.

### Recommended next slice

Prove longitudinal stability of runtime XYZ across remounts; optionally remesh/stylize exterior from canonical skin if hip residuals block clinician trust; only then migrate schema with versioned `canonicalBodyXYZ`.
