# PainLocator — Integration, Validation & Phase 2 Anatomy Decision

**Date:** 2026-09-06  
**Repo:** mpinkney2/painlocator  
**Scope:** Integration of PR #5/#6, Phase 1 validation, production anatomy architecture decision  
**Non-goals:** Do not implement production anatomy layers or Phase 2 UI in this document’s accompanying work.

---

## A. PR #5 integration result

| Item | Result |
| --- | --- |
| PR | [#5](https://github.com/mpinkney2/painlocator/pull/5) — touch sync + enlarge silhouette |
| Base | `main` |
| CI | Green (Vercel) |
| Merge | **Merged into `main`** (fast-forward of `cursor/touch-sync-enlarge-silhouette-83c7`; GitHub state `MERGED` at 2026-09-06) |
| Safety | Confirmed: focused capture/mapper/markup changes; tests covering enlarge/fit/letterbox; no spatial coupling |

PR #5 is on `main` and closed/merged.

---

## B. PR #6 post-rebase status

| Item | Result |
| --- | --- |
| PR | [#6](https://github.com/mpinkney2/painlocator/pull/6) — Spatial Phase 1 |
| Base | **Updated to `main`** |
| Commits vs `main` | 3 Spatial-only commits (feat + harden + remount/snap fix) |
| Duplicate #5 commits | **None** |
| Diff vs `main` | Spatial Phase 1 files only (engine/spatial/*, vendor Three, display toggle, tests) |
| Local verification | `npm test` 27 passed; `npm run typecheck` pass; `npm run build` pass |

**Merge stance:** Ready to merge into `main` once CI is green on the retargeted base — **not auto-merged** (awaiting final human review).

---

## C. Phase 1 validation findings

| Flow | Verdict | Notes |
| --- | --- | --- |
| 1 — Default plate | **PASS** | Spatial opt-in; enlarge/fit/pan remain plate mapper paths; Three not boot-loaded |
| 2 — Spatial mode | **PASS** (after fix) | Lazy Three; rotate; snaps; raycast place; mesh-local parenting; button snaps now reproject |
| 3 — Multi-site markers | **PASS** | Distinct named meshes; markers parented to hit mesh; rotate with body |
| 4 — Renderer switch | **PASS** (after fix) | Teardown clears canvas/listeners/rAF; session Map + `meshName` remount binding |
| 5 — Failure fallback | **PASS** | Import/WebGL/mount failure → plate; UI toast path present |

**Known Phase 1 limitations (not defects):** approximate full-canvas NDC→anchors; no persisted 3D schema; procedural placeholder body; point tool only in 3D.

---

## D. Phase 1 defects discovered (and fixed)

1. **Remount UUID orphaning** — Session attachments kept `meshUuid` that became stale after plate→spatial remount.  
   **Fix:** `SpatialProjection.resolveMesh` + `meshByName`; rewrite UUID on bind; legacy fallback if bind fails.

2. **Button snaps skipped reproject** — Drag-snap updated `view`/`anchors`; Front/Left/Back/Right buttons only yawed.  
   **Fix:** `setView` calls `_reprojectSpatial` before legacy refresh.

No Phase 2 / schema / UI redesign work performed.

---

## E. Anatomy dataset comparison

| Candidate | Source | License | Commercial suitability | Anatomical quality | Structure IDs | Layer support | Mobile | Integration complexity | Major risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **BodyParts3D / Anatomography** | DBCLS (Japan); OBJ + FMA tables; ~2,234 elemental meshes (IS-A 99% pack) | **CC BY 4.0** (official archive updated 2025-02-25; attribution required). Older mirrors may still say CC BY-SA 2.1 JP — **use archive LATEST only** | Strong for SaaS if attribution + provenance tracked | Whole-body adult male; clinically oriented dictionary model | **FMA concept IDs** + representation IDs; PART-OF / IS-A trees | Surface→organ parts via hierarchy (group into skin/muscle/bone/nerve/viscera in *our* manifest) | Raw OBJs heavy; needs aggressive LOD/Draco/GLB slicing | Medium–high (pipeline, not app rewrite) | Male-only; mesh cleanup cost; must pin license provenance in-repo |
| **Z-Anatomy (+ browser GLB forks)** | Community Blender/Z-Anatomy; e.g. hpfrei viewer GLB | Typically **CC BY-SA 4.0** (ShareAlike) | Risky for closed SaaS (SA may force opening derivatives) | Good educational musculo-skeletal coverage | Often name-based; weaker stable clinical IDs | Muscle/bone oriented | Better out-of-box browser sizes | Low–medium for exterior/muscle demo | ShareAlike + uneven ID stability |
| **Somakine / BodyParts3D packs** | Open Three.js “body layer” framework; BodyParts3D packs | App code often MIT; **data license = BodyParts3D** | Reuse *patterns* freely; adopt *meshes* only under BP3D terms | Same as BP3D when using those packs | Designed around canonical IDs | Layer toggle UX exists as reference | Progressive packs possible | Prefer **asset ideas**, not React/app coupling | Don’t inherit foreign app architecture |
| **Human Reference Atlas (HRA) 3D** | HubMAP / humanatlas.io GLB organs | **CC BY 4.0** | Good for organ deep-dives | High for **organs**; not a full exterior mannequin | UBERON / FMA tagged structures | Organ-centric, not full-body layers | Per-organ GLBs | Medium as **supplement**, not primary body | Incomplete for patient exterior capture |
| **Zygote / SciePro (commercial)** | Professional anatomy vendors | Proprietary; web redistribution usually royalty / protected runtime | Excellent for paid clinical pilot | Highest clinical polish; male+female | Vendor IDs (map to FMA ourselves) | Full systems | Optimized variants available | High cost + contract + DRM expectations | Cost, lock-in, extraction restrictions |
| **Sketchfab random models** | Various | Often unclear / non-commercial | **Reject** as product dependency | Variable | Unreliable | Ad hoc | Variable | Low | Provenance / liability |

**“Vanatome”:** No credible open project matching that name was found. Treat as a possible misremembering of Anatomography / BodyParts3D / Z-Anatomy / Somakine. Do not block on it.

---

## F. Recommended production anatomy source

### PRIMARY (build Phase 2 on this)
**BodyParts3D (DBCLS archive, CC BY 4.0)** as the *canonical structure library*, converted by PainLocator into optimized, layer-grouped GLBs + a PainLocator spatial manifest.

**Why:** Matches the LinkedIn-class capability (~2k structures), stable **FMA IDs**, explicit hierarchy, redistributable with attribution, and now **without ShareAlike** on the official LATEST license. Clinical utility > marketing structure count — we will ship **progressive subsets**, not all 2,234 at once.

### FALLBACK
**Procedural / simplified exterior GLB** (continue Phase 1 silhouette quality) + **HRA organ packs** for clinician organ context only, if BP3D pipeline slips.

### COMMERCIAL-PILOT
**Zygote or SciePro** for male+female photoreal systems once revenue / pilot contracts justify licensing — map vendor IDs → FMA in the same manifest so patient data does not lock to one mesh vendor.

---

## G. Recommended spatial persistence model

Keep today’s **patient-reported 2D** (`view` + `anchors` + `anatomyLayer`) as the compatibility core.

Add **optional additive** spatial metadata (schema-versioned; never required for plate/reports):

```text
PainRegion.spatial? = {
  schemaVersion: 1,
  modelId: "bp3d-male-v1",          // manifest model + sex + revision
  structureId: "FMA:xxx",           // stable clinical ID (preferred)
  meshId: "skin.torso",             // PainLocator mesh key (not Three UUID)
  triangleIndex: 12345,
  barycentric: { u, v, w },
  localPoint: { x, y, z },          // mesh-local fallback
  bodySpace: { x, y, z },           // normalized canonical body frame
  capturedAtView: "front",
  confidence: "surface-hit"
}
```

**Durability ranking for longitudinal compare:**

1. **structureId (FMA)** + **bodySpace XYZ** (canonical bind pose)  
2. **meshId + triangleIndex + barycentric** (precise within a model revision)  
3. localPoint / UV as fallbacks  
4. Never persist Three.js `uuid`

**Semantics (product safety):**

- Patient mark = **patient-reported location**  
- Nearby FMA hits = **anatomical context** only  
- UI copy must never say “caused by …”

---

## H. Recommended anatomy asset pipeline

```text
BodyParts3D OBJ + FMA tables
        ↓ validate license/provenance pin
        ↓ mesh cleanup / manifold / normals
        ↓ assign PainLocator meshId + FMA structureId
        ↓ group into layers: exterior | muscle | skeleton | nerve | organ
        ↓ LOD0/LOD1 (+ optional LOD2 desktop)
        ↓ Draco / Meshopt GLB
        ↓ public/anatomy/spatial/{modelId}/
             manifest.json
             layers/*.glb
             LICENSE.md (attribution)
        ↓ CAE SpatialManifestLoader (lazy by layer)
```

Repo should eventually own `public/anatomy/spatial/manifest.json` concepts: `model`, `sex`, `layer`, `structureId`, `name`, `clinicalName`, `meshFile`, `parentStructure`, `lod`, `license`.

**Do not** vendor the entire BP3D dump into git unoptimized.

---

## I. Performance / loading strategy

| Target | Recommendation |
| --- | --- |
| Initial exterior (patient mark-ready) | **≤ 3–5 MB** compressed GLB; interactive &lt; 3s on mid mobile |
| On-demand layer (muscle / skeleton / nerve / organ) | **≤ 2–8 MB each**; parallel fetch + progressive reveal |
| Total optional anatomy | **≤ 25–40 MB** if user opens all layers (not required up front) |
| Desktop | LOD1/2, higher DPR cap |
| Modern mobile | LOD0/1, DPR ≤ 1.5–2 |
| Low-power / WebGL fail | **Plate mode** remains first-class |

Progressive load order: **Exterior → (clinician) Muscle → Skeleton → Nerve → Organ**.

Patient can mark pain after exterior only.

---

## J. Patient UX architecture

**Principle:** The body is the primary interface.

- Large viewport; calm clinical chrome  
- Rotate / pinch-zoom / four snaps  
- Tap or paint where it hurts → intensity / quality / radiation card  
- No layer taxonomy, no structure name dump, no atlas search  
- Copy: “Where does it hurt?” not anatomy homework  
- Accessibility: reduced-motion snaps, keyboard snaps, plate fallback  

---

## K. Clinician UX architecture

Same spatial registration; progressive disclosure:

- Layer chips: Surface / Muscle / Skeleton / Nerve / Internal  
- Opacity / isolate selected structure  
- “Nearby structures” panel (context, not diagnosis)  
- Longitudinal overlays later (visit footprints)  
- Avoid dashboard clutter and game-like gizmo overload  

---

## L. Phase 2 implementation plan (vertical slices)

1. **SpatialManifest + exterior GLB loader** (replace procedural body; keep plate fallback)  
2. **Stable hit binding** (`structureId`/`meshId`/barycentric) still runtime-first  
3. **Additive `PainRegion.spatial` schema + docs** (backward compatible)  
4. **Letterbox-aware 3D→2D projection** (fix Phase 1 NDC approx for reports)  
5. **Clinician layer packs** (muscle, then skeleton) with opacity  
6. **Nearby-structures context UI** (non-diagnostic)  
7. **Female model track** (second manifest; same IDs where possible)  
8. **Longitudinal compare prototype** (bodySpace footprints)  
9. **Commercial mesh swap adapter** (Zygote/SciePro → same manifest)  

---

## M. Next implementation prompt

```text
PAINLOCATOR — PHASE 2 SLICE 1: EXTERIOR SPATIAL MANIFEST + GLB BODY

Repository: mpinkney2/painlocator
Base: main (after PR #6 Spatial Phase 1 is merged)

Do NOT implement full anatomy layers yet.
Do NOT change the required PainEntry/PainRegion 2D schema.
Do NOT redesign the whole UI.

Goal:
Replace the procedural Phase 1 placeholder body with a production-path
exterior human GLB loaded through a Spatial Manifest, while keeping
plate mode as default/fallback.

Read docs/SPATIAL_ANATOMY_PHASE2_DECISION.md and follow PRIMARY recommendation
(BodyParts3D-derived or interim exterior GLB with FMA-mapped meshIds).

Implement only Slice 1:
1. public/anatomy/spatial/{modelId}/manifest.json + LICENSE attribution
2. SpatialManifestLoader (lazy) used by SpatialSceneController
3. Exterior-only GLB (LOD0) with stable meshId / optional structureId on meshes
4. Raycast + mesh-local attachments keyed by meshId (not Three UUID)
5. Keep Front/Left/Back/Right snaps, plate fallback, session remount binding
6. Document that deeper layers are out of scope for this slice

Acceptance:
- npm test / typecheck / build pass
- Spatial mode loads exterior GLB on demand only
- Markers stick to named meshes across rotate and plate↔spatial remount
- Plate mode and reports unchanged
```

---

## Product safety reminder

PainLocator provides **patient-reported location** plus optional **anatomical context**.  
It must never assert causal diagnosis from spatial proximity.
