# PainLocator — Canonical Full-Body Exterior & Shared Registration Architecture

**Date:** 2026-09-06  
**Slice:** Phase 2 Slice 4 (architecture + offline prototype)  
**Base:** `main` after PR #11 merge  
**Status:** Decision record — **does not replace production runtime**

**Companion docs:**  
[`SPATIAL_PHASE2_SLICE3_REGISTRATION.md`](./SPATIAL_PHASE2_SLICE3_REGISTRATION.md) ·  
[`SPATIAL_PHASE2_SLICE3_CLINICIAN_LAYERS.md`](./SPATIAL_PHASE2_SLICE3_CLINICIAN_LAYERS.md) ·  
[`BODYPARTS3D_SOURCE_PROVENANCE.md`](./BODYPARTS3D_SOURCE_PROVENANCE.md) ·  
[`SPATIAL_ANATOMY_PHASE2_DECISION.md`](./SPATIAL_ANATOMY_PHASE2_DECISION.md) ·  
[`PAINLOCATOR_PRODUCT_UX_AND_ANATOMY_ARCHITECTURE.md`](./PAINLOCATOR_PRODUCT_UX_AND_ANATOMY_ARCHITECTURE.md)

**Offline prototype:** [`public/anatomy/spatial/prototype-bp3d-fullbody/`](../public/anatomy/spatial/prototype-bp3d-fullbody/)

---

## Executive decision

### Primary recommendation — **B**

**Hidden BP3D-compatible canonical registration body + separately styled patient exterior.**

PainLocator’s long-term spatial frame is the **BodyParts3D meters / Y-up / +X right / +Z anterior** frame already used by the shoulder packs. A BP3D-derived full-body skin (FMA:7163) exists and co-locates with muscle/skeletal under **identity** registration. That skin is **not** patient-ready as a default visible exterior.

Therefore:

| Layer | Role |
| --- | --- |
| **Canonical body** (BP3D frame; skin shell and/or sparse bony envelope) | Owns shared coordinates; may be hidden or clinician-reference |
| **Patient exterior** | Calm, stylized mesh **conformed once** into the same frame |
| **Muscle / skeletal / neural / internal** | Ingested in the same BP3D frame — no regional ad-hoc transforms |
| **Pain markers** | Persist **canonicalBodyXYZ** (+ structure context), not triangle index alone |

### Fallback — **A**

If a remeshed / stylized BP3D skin can meet patient visual bar **without** losing frame fidelity, it may become the visible exterior. Treat as an implementation option under B’s frame, not a different coordinate strategy.

### Commercial-pilot upgrade — **C**

Licensed female (and higher-polish male) exteriors / systems (e.g. Zygote / SciePro) map into the **same** `frameId` via a single model-level rigid (or lightly constrained) registration. Vendor IDs map to FMA in the manifest so persisted pain does not lock to one mesh vendor.

---

## A. Current exterior audit

| Field | Finding |
| --- | --- |
| Asset | `public/anatomy/spatial/adult-male/exterior-lod0.glb` (~294 KB) |
| Provenance | **PainLocator procedural mannequin** (capsules/spheres/boxes) — `scripts/generate-exterior-glb.mjs` |
| License | PainLocator interim asset — **not** BP3D (`adult-male/LICENSE.md`) |
| Structure IDs | `PL:surface.*` local IDs — **not FMA** |
| Mesh structure | 18 named surface meshes (`surface.head` … `surface.footR`) + root `adultMaleExterior` |
| Placement | Per-node **4×4 matrices** (local mesh geometry centered; world pose in node matrix) |
| Proportions | Stylized adult male; shallow limbs; clinical-neutral materials |
| Coordinate frame | Meters, Y-up, right-handed (matches CAE Spatial convention) |
| Stable meshIds | Yes — `extras.meshId` / node names `surface.*` |
| Pain attachment | Runtime `spatialAttachments` Map: mesh-local point parented to hit mesh by **meshId** (not Three UUID); **not persisted** in PainRegion schema yet |
| Why BP3D needs registration | BP3D content is cadaveric metric anatomy; interim exterior is a different body. Slice 3 uses rigid scale≈1.00875 + translation≈[-0.088, 0.087, −0.076] (**pass-preview** only) |
| Catalog | `spatial/manifest.json` lists only `adult-male` exterior — prototype BP3D packs are clinician-lazy, not catalog defaults |

### Migration impact if replaced

| Area | Impact |
| --- | --- |
| Patient / Clinician shells | Keep; swap exterior GLB behind manifest / feature flag |
| Runtime attachments | Remount by meshId breaks if meshIds rename — need adapter or stable semantic regions |
| Plate 2D | Unaffected if plate art retained |
| Slice 3 shoulder registration | **Retire** regional adapter once exterior (or its conform transform) lives in BP3D frame |
| Saved sessions | 2D `view`+`anchors` safe; no persisted 3D schema yet — low breakage |
| Reports | Unchanged if plate projections preserved |
| CAE | Keep; SpatialManifestLoader already path-based |

**Breakage risk is manageable** if meshId semantics or a conformer map is versioned.

---

## B. BP3D exterior findings

### Does BodyParts3D provide a full-body external surface?

**Yes — one elemental skin mesh.**

| Field | Value |
| --- | --- |
| Concept | **FMA:7163** — *skin* |
| Representation | BP9115 |
| Element file | **FJ2810.obj** (~14.5 MB in 99% pack) |
| Topology | ~102 467 vertices, ~203 382 triangles |
| Watertight | **No** (open / non-manifold regions typical of atlas skins) |
| Bounds (after PL remap) | height ≈ **1.72 m**, width ≈ **0.67 m**, depth ≈ **0.29 m** |
| License | **CC BY 4.0** (official DBCLS LATEST; see provenance doc) |
| Sex | **Adult male only** in BP3D 4.0 |
| Commercial redistribution | Allowed under CC BY 4.0 **with attribution** |

### Suitability matrix

| Use | Verdict |
| --- | --- |
| Clinical spatial registration frame | **Strong** — same ingest transform as muscle/bone |
| Browser rendering | Feasible after meshopt (~361 KB prototype LOD0) |
| Raycasting / pain marking | Feasible; prefer durable body XYZ over tri-index |
| Patient-facing display (raw) | **Weak** — anatomical/cadaveric, uncanny, shallow AP |
| Patient-facing after stylization | **Possible** (fallback A) |
| Female | **Not available** in BP3D 4.0 |

### Can components be merged into a clean shell?

Not required: skin is already a single element. Cleanup (manifold repair, normals, remesh) is still needed for production. Aggressive smoothing is allowed for **visible** derivatives if the **canonical frame** and registration landmarks remain defined on a non-destructive registration mesh (or on landmark/skeleton constraints).

**Do not assume raw BP3D skin is patient-suitable.** Empirically it is not.

---

## C. Canonical-body options comparison

| Option | Idea | Pros | Cons |
| --- | --- | --- | --- |
| **A. Visible BP3D exterior** | Stylize FMA7163 as the patient body | One mesh family; identity vs layers | Hard to meet calm UX; AP shallow; remesh risk |
| **B. Hidden canonical + styled exterior** | BP3D frame + registration shell; separate patient mesh | UX freedom; layers share frame; female path clear | Two exterior-related assets; conformer to maintain |
| **C. Commercial body as SoT** | Zygote/SciePro owns space | Highest polish; male+female | Cost, lock-in; must still map FMA; license ops |

**Shared requirement for all options:** one versioned `frameId` + `modelVersion` so longitudinal pain compares across asset swaps.

---

## D. Chosen recommendation

### **RECOMMENDATION B** (primary)

```
painlocator-bp3d-canonical-v1
        │
        ├── canonicalBody (BP3D skin and/or bony envelope)  [often hidden]
        ├── patientExterior (stylized; conformed once)
        ├── muscle / skeletal / neural / internal (BP3D or mapped)
        └── pain coordinates (canonicalBodyXYZ + structure context)
```

**Fallback A:** stylized BP3D skin as visible exterior if visual QA passes.  
**Upgrade C:** commercial exteriors/systems registered into the same frame for pilot polish + female.

---

## E. Patient visual-quality strategy

Patient exterior must stay: attractive, calm, non-cadaveric, recognizable, touch-friendly, not hyper-muscular, not uncanny, not atlas-like unless clinician layers are intentional.

### Strategy under B

1. Keep / evolve a **stylized** exterior (procedural successor or artist-authored GLB).
2. **Constrain** it to the canonical body with a **single global** rigid (or low-DOF) conformer derived from landmarks (heels, vertex, acromia, ASIS, medial malleoli, etc.) — not per-region hacks.
3. Materials: neutral clinical skin tones; soft lighting; no wet cadaver specular.
4. If using remeshed BP3D skin for clinician ghosting only, keep patient on stylized mesh.

### Remesh vs durable pain

Remeshing changes triangle indices. Pain durability must **not** depend on tri-index of the visible exterior (see §F). Registration mesh may remain higher fidelity for landmarks even when display LOD changes.

---

## F. Durable spatial-coordinate recommendation

Persisted spatial identity must survive LOD, remesh, optimization, model upgrades, and renderer changes.

### Proposed additive fields (design only — **no schema migration in this slice**)

| Field | Role | Class |
| --- | --- | --- |
| `modelId` | e.g. `adult-male` | **CANONICAL** |
| `modelVersion` | exterior/display revision | **CANONICAL** |
| `coordinateFrameVersion` / `frameId` | e.g. `painlocator-bp3d-canonical-v1` | **CANONICAL** |
| `canonicalBodyXYZ` | meters in frame | **CANONICAL** |
| `structureId` | FMA when known | **CANONICAL** (nullable) |
| `registrationVersion` | conformer / registration artifact id | **CANONICAL** |
| `sourceAssetVersion` | BP3D pin / vendor pack pin | **CANONICAL** |
| `meshId` | display mesh key | **DERIVED** (version-scoped) |
| `surfaceUV` | if stable parameterization exists | **DERIVED** |
| `triangleIndex` + `barycentric` | precise remount within same mesh revision | **DERIVED** / revision-bound |
| `nearestAnatomicalRegion` | UX / search assist | **DERIVED** |
| `view2d` + `anchors` | plate / report compatibility | **CANONICAL** (existing) |
| Three.js `uuid` | — | **FORBIDDEN** |
| Camera / session matrices | — | **RUNTIME-ONLY** |

**Durability ranking:** `frameId` + `canonicalBodyXYZ` (+ optional FMA) ≫ meshId/barycentric ≫ UV ≫ never UUID.

Session today may keep mesh-local attachments; persistence later promotes body XYZ.

---

## G. Canonical coordinate frame

| Property | Value |
| --- | --- |
| `frameId` | `painlocator-bp3d-canonical-v1` |
| Units | **meters** |
| Up | **+Y** |
| Handedness | right-handed |
| Anterior | **+Z** (toward default camera) |
| Anatomical right | **+X** |
| Origin | BP3D-derived (approximately mid-feet / pelvic floor region of atlas; do not invent a second origin) |
| Height normalization | Store **metric** XYZ; optional `normalizedBodyXYZ = xyz / heightRef` for cross-sex compare |
| Scale strategy | Ingest BP3D with documented remap `(-x_mm, z_mm, -y_mm)*0.001`; exteriors conform to that scale |

Male/female: prefer **sex-specific metric model spaces** that declare the same axis conventions, plus a **normalized compare space** for longitudinal analytics — do not force one mesh to both sexes.

---

## H. Male / female strategy

BP3D 4.0 is male-only. Avoid a dead end:

1. **Now:** Male canonical frame = BP3D; male stylized exterior conforms to it.  
2. **Next:** Female **exterior** from a clear commercial license (or commissioned stylized mesh), registered into `painlocator-*-canonical-v1` conventions with its own `modelId` (`adult-female`) + `modelVersion`.  
3. **Internals:** Sex-specific packs where anatomy differs; shared FMA IDs where concepts align.  
4. **Longitudinal:** compare in normalized body space + structureId; never assume identical limb proportions.  
5. **Commercial pilot:** Option C interiors/exteriors mapped to FMA — same persistence model.

Do **not** fake female anatomy by nonuniform-scaling the male BP3D atlas as a clinical surface.

---

## I. Full-body prototype result

**Path:** `public/anatomy/spatial/prototype-bp3d-fullbody/`  
**Runtime wiring:** **none** (offline only)

| File | Size | Role |
| --- | --- | --- |
| `canonical-body.glb` | ~361 KB | Meshopt BP3D skin in PL canonical frame |
| `canonical-body-lod1.glb` | ~131 KB | Further simplified LOD |
| `exterior-candidate.glb` | ~361 KB | Same geo marked as “candidate only” — **not** UX-approved |
| `manifest.json` | — | Provenance + frame + bounds |
| `validation.json` | — | Shoulder identity-frame check |
| `LICENSE.md` | — | CC BY 4.0 attribution |

**Geometry notes:** source ~102k verts / ~203k tris; not watertight; height ≈1.72 m; AP depth ≈0.29 m.

---

## J. Shoulder-registration validation result

| Check | Result |
| --- | --- |
| Shoulder packs in BP3D meters Y-up? | **Yes** (Slice 2 ingest) |
| FMA7163 skin in same frame? | **Yes** (identical remap) |
| Humerus centroid inside skin AABB? | **Yes** |
| Regional transform needed vs canonical skin? | **No — identity** |
| Slice 3 transform meaning | Adapter **only** to interim procedural exterior |
| Pass preview for architecture claim? | **Yes** |
| Clinical precision claimed? | **No** |

If a future visible exterior still needs **local** shoulder translation after a global conformer, that indicates the exterior proportions are wrong — fix the conformer/exterior, do not add more regional patches.

---

## K. Performance targets

| Asset | Transfer target | Notes |
| --- | --- | --- |
| Patient exterior initial | **≤ 3–5 MB** (prefer ≤1 MB) | Current interim ~0.3 MB; keep lean |
| Canonical body (hidden) | **≤ 0.5–1.5 MB** | Prototype LOD0 ~0.36 MB; fetch clinician-only or on spatial boot |
| Full-body skeletal (future) | **2–8 MB** progressive | Region packs first |
| Full-body muscle (future) | **3–10 MB** progressive | Never patient default |
| Neural / internal | On demand | Clinician only |
| Patient downloads clinician layers? | **No** | Hard isolation |

**LOD:** exterior LOD0 mobile / LOD1 desktop; canonical body single LOD + optional sparse collision proxy; anatomy packs by region then full-body.

---

## L. Asset-versioning strategy

```json
{
  "modelId": "adult-male",
  "modelVersion": "2026.09.06",
  "sourceAssetVersion": "bodyparts3d-4.0-isa-obj99",
  "coordinateFrameVersion": "painlocator-bp3d-canonical-v1",
  "registrationVersion": "conform-adult-male-exterior-v1"
}
```

Pain markers record these versions at capture time.

### Migration

| Change | Action |
| --- | --- |
| Exterior remesh, same frame + conformer | Keep `canonicalBodyXYZ`; refresh derived mesh binds |
| Frame revision | Provide `frameUpgrade` matrix/map; batch-transform stored XYZ |
| Registration bump | Recompute derived attaches; XYZ unchanged if frame unchanged |
| Model sex swap | Do not auto-convert; require explicit remapping policy |

---

## M. Migration impact (summary)

- **Low immediate risk:** no persisted 3D schema yet; plate sessions safe.  
- **Medium when swapping exterior:** meshId map + feature flag.  
- **High if skipped:** more regional BP3D patches on the mannequin → compounding debt (explicitly rejected).  
- **Slice 3 adapter:** keep until runtime exterior/conformer is in BP3D frame; then delete shoulder-specific transform.

---

## N. Implementation sequence (refined)

1. **Canonical body prototype** (this slice) — done offline  
2. **Feature-flag Spatial boot** loading canonical frame metadata (+ optional hidden body) without removing interim exterior  
3. **Global exterior conformer** (landmark rigid) producing `registrationVersion`  
4. **Pain-coordinate adapter** (runtime body XYZ; still non-persisted or additive experimental)  
5. **Remove shoulder-specific registration** once conformer verified  
6. **Expand skeletal** by region in BP3D frame (no new regional exterior hacks)  
7. **Expand muscle** similarly  
8. **Neural / internal** clinician packs  
9. **Persisted spatial schema** (`canonicalBodyXYZ` + versions)  
10. **Longitudinal compare** in frame / normalized space  
11. **Female model track** (commercial/stylized) under same conventions  
12. **Optional:** stylized BP3D-derived visible exterior (fallback A) or commercial SoT (upgrade C)

---

## O. Exact next implementation prompt

```text
PAINLOCATOR — PHASE 2 SLICE 5
CANONICAL FRAME RUNTIME HOOK + GLOBAL EXTERIOR CONFORMER (FEATURE-FLAGGED)

Repository: mpinkney2/painlocator
Base: main (after Slice 4 architecture merge)

READ:
- docs/CANONICAL_BODY_ARCHITECTURE.md
- docs/SPATIAL_PHASE2_SLICE3_REGISTRATION.md
- public/anatomy/spatial/prototype-bp3d-fullbody/manifest.json

GOAL
Introduce the painlocator-bp3d-canonical-v1 frame into Spatial runtime behind a
feature flag without replacing the default patient exterior or plate flow.

DO
1. Add spatial frame metadata to the adult-male manifest (frameId, versions).
2. Feature flag (e.g. ?canonicalFrame=1 or config) to:
   - optionally load hidden canonical-body.glb (clinician/dev only)
   - compute/apply ONE global exterior→canonical rigid conformer
   - display existing shoulder muscle/skeletal with IDENTITY in canonical mode
3. Runtime helper: hit → canonicalBodyXYZ (session only; no schema migration).
4. Dev validation overlay: interim exterior + canonical skin ghost + shoulder pack.
5. Tests: flag off = current behavior; flag on = identity shoulder vs canonical.
6. Docs: conformer derivation + pass/fail criteria (still pass-preview).

DO NOT
- Replace production default exterior
- Persist PainRegion.spatial yet
- Add new anatomy regions / neural / internal
- Change patient mobile flow
- Add more regional registration JSON files
- Claim clinical precision

DELIVERABLE
- Feature-flagged runtime hook
- Global conformer artifact
- Validation notes
- PR against main
```

---

## Non-goals honored

No new regional packs · no neural/internal runtime · no patient flow change · no PainEntry schema migration · no React · no diagnosis · plate kept · no misleading surface shipped as default · registration issues not hidden by transparency · no unclear-license assets committed (BP3D CC BY 4.0 attributed).
