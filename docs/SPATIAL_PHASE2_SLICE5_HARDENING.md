# Phase 2 Slice 5 Hardening — Canonical Frame Stability & Persistence Readiness

**Date:** 2026-09-06  
**PR:** #13  
**Status:** Development-infrastructure validation (not clinical)

**Artifacts:** `public/anatomy/spatial/dev/canonical-frame-hardening/`  
**Script:** `tools/bp3d-ingest/dev/characterize-canonical-frame.mjs`

---

## Ownership model

| Layer | Owns | On teardown |
| --- | --- | --- |
| `CanonicalBodyLoader` | Template GLB scene + geometries (+ template materials) | `clearCache()` frees all |
| `CanonicalBodyFrame` | Borrowed instance (cloned graph; cloned materials; **shared** geos) | `dispose()` → `detachInstance` only |
| `SpatialAnatomyRenderer` | Active frame reference + session debug Map | Always clears `spatialCanonicalDebug`; detaches frame |

- Flag OFF never calls the loader (no fetch).
- Failed template promises are deleted → retry allowed.
- At most one active Spatial renderer (existing app invariant).
- Do **not** dispose template geometries from a frame (same rule as shoulder packs).

---

## Thresholds (development — not medical)

| Category | mean mm | max mm | remount Δ mm | Intent |
| --- | --- | --- | --- | --- |
| **PASS_PREVIEW** | ≤ 80 | ≤ 120 | ≤ 0.01 | Visual / architecture proof |
| **PASS_DEVELOPMENT** | ≤ 40 | ≤ 70 | ≤ 0.01 | Stable infra for further work |
| **NOT_READY_FOR_PERSISTENCE** | ≤ 15 | ≤ 25 | ≤ 0.01 | Proposed bar before schema write |

Current v1 conformer (~54 mm mean / ~97 mm max): **PASS_PREVIEW** and explicitly **NOT_READY_FOR_PERSISTENCE**.

---

## A. Canonical XYZ remount stability

Deterministic exterior landmarks (shoulderL/R, chest, abdomen, hipL/R, kneeL/R, forearmL) projected through the global conformer across 5 repeated “remount” applications:

| Point | max Δ mm | mean Δ mm |
| --- | --- | --- |
| all listed | **0.000** | **0.000** |

Numeric identity — remount-stable for the raw conformed body-local path.

Runtime also: mount-generation guard, debug Map cleared on every teardown, loader cache reuse.

---

## B. Cache / ownership

- Template loads once per `bodyUrl` per session (`CanonicalBodyLoader.getLoadCount()`).
- Instances clone materials; share geometries; detach on dispose (no poison).
- `clearCache()` frees templates.
- Failed loads clear promise keys → retry works.

---

## C. Body-region error table (raw → target landmark, mm)

| Region | n | mean | median | p95 | max |
| --- | --- | --- | --- | --- | --- |
| head/neck | 3 | 21.8 | 18.6 | 18.6 | 32.7 |
| shoulders | 2 | 29.7 | 29.7 | 29.7 | 29.8 |
| torso | 3 | 42.3 | 31.8 | 31.8 | 70.4 |
| hips | 2 | **95.3** | 95.3 | 94.0 | **96.6** |
| arms | 4 | 69.2 | 71.0 | 90.3 | 92.6 |
| legs | 4 | 62.8 | 62.8 | 71.2 | 72.0 |
| **overall** | 18 | **53.9** | 52.8 | 94.0 | **96.6** |

---

## D. Persistence readiness

**NOT_READY_FOR_PERSISTENCE.** Do not write `canonicalBodyXYZ` to PainRegion yet.

---

## E. Hip / torso root cause

**Primary:** interim mannequin pelvis/hip width too narrow vs BP3D skin (~0.20 m vs ~0.38 m).  
Uniform scale cannot reconcile height-fit with hip breadth. Secondary: AP soft-tissue depth.  
Landmark choice amplifies residual but is not root cause. **No regional patches added.**

---

## F. Landmark-conformer experiment

Tried symmetric lateral (+ optional depth) global corrections.

- Hips alone can improve (~95 → ~66 mm) with lateral≈1.32  
- Shoulders/arms then degrade (overall mean **worse**)  
- **Rejected** — would become a regional hack if hip-scoped  

Production default remains `exterior-to-canonical-v1.json`.

---

## G–H. Canonical-derived exterior prototype

Offline candidate:  
`public/anatomy/spatial/dev/canonical-frame-hardening/canonical-derived-exterior-candidate.glb` (~166 KB, weld+simplify).

| | Mannequin + conformer | Canonical-derived |
| --- | --- | --- |
| Alignment | ~54 mm mean | **identity / ~0** |
| Appearance | calm stylized (preferred UX) | still atlas-like |
| Payload | 294 KB + optional 361 KB | ~166 KB candidate |
| Topology | 18 `PL:surface.*` meshIds | single shell |
| Runtime | production default | **not wired** |

---

## I. Shoulder identity

Flag ON → `bp3d-shoulder-canonical-identity.json` (scale 1, t=0).  
Flag OFF → Slice 3 adapter retained. Pack cache keyed by registration URL.

---

## J. Feature-flag safety

- OFF: no canonical fetch; Slice 3 path unchanged.  
- ON failure: warn, dispose frame, clear debug, restore exterior TRS, continue Spatial capture.

---

## M–O. Merge / long-term / Slice 6

- **M:** PR #13 is **safe to merge as development infrastructure** (draft → ready after CI).  
- **N:** Current mannequin should **not** remain the long-term persistence exterior.  
- **O Slice 6:** Build a **patient-grade exterior remeshed/styled from the BP3D canonical surface** (or commercial body in the same frame), keep identity shoulder packs, keep flag OFF default until visual QA passes — still no `canonicalBodyXYZ` persistence until mean/max meet the persistence bar.
