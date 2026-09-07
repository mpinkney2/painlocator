# Full-Body BP3D Clinician Anatomy (Development Flag)

**Date:** 2026-09-07  
**Branch:** `cursor/fullbody-bp3d-anatomy-83c7`  
**Flag:** `?fullBodyAnatomy=1` (or `window.PAINLOCATOR_FULL_BODY_ANATOMY = true`)

> **Source-tier update (2026-09-07):** This full-body pack is built from the official
> **99%** archive and remains a **prototype / coverage** milestone.
> It is **not** the approved production visual target.
> See [`BODYPARTS3D_PRODUCTION_SOURCE_DECISION.md`](./BODYPARTS3D_PRODUCTION_SOURCE_DECISION.md)
> (verdict: **NO** — obtain BP3D 4.0 HD before production cutover).

## Objective

Deliver the first credible **full-body** BodyParts3D musculoskeletal clinician
depth (Muscle / Skeletal) behind a development flag, without regressing the
Vite ESM Spatial runtime and without expanding persisted schema.

Default (flag OFF) remains the left-shoulder prototype packs.

## Source

| Field | Value |
| --- | --- |
| Archive | `isa_BP3D_4.0_obj_99.zip` (BodyParts3D 4.0 IS-A 99%) |
| Pin | `data/bodyparts3d/ARCHIVE.sha256` |
| License | CC BY 4.0 (DBCLS) |
| Frame | `painlocator-bp3d-canonical-v1` |
| Transform | `(x,y,z)_mm → (-x,z,-y)*0.001` |

## Curated set

| Metric | Value |
| --- | --- |
| Structures | **851** (FMA-mapped) |
| Packs | **24** regional |
| Raw OBJ (subset) | ~496 MB |
| Pre-meshopt GLB | ~181 MB |
| Optimized GLB total | **~35.5 MB** |

Pipeline: `npm run bp3d:curate-fullbody` → `npm run bp3d:ingest-fullbody` → meshopt.

Runtime assets: `public/anatomy/spatial/prototype-bp3d-fullbody-msk/`

## Pack architecture

Muscle: head-neck, torso, upper(-left/right), pelvis, lower(-left/right), other  
Skeletal: skull, spine, thorax, shoulder-girdle(-L/R), upper(-L/R), pelvis, lower(-L/R), other  

`*-other` packs are skipped on first paint (available in index for later).

## LOD / 99% quality evaluation

Sample 99% meshes (representative):

| Structure | Vertices (99%) | Notes |
| --- | --- | --- |
| Left deltoid (acromial) | ~918 | Usable for overview; soft silhouette |
| Left pectoralis major (clavicular part) | ~1495 | Readable at body scale |
| Left vastus lateralis | ~3974 | Good limb form |
| Left patella | ~180 | Blocky close-up |
| Left calcaneus | ~719 | Acceptable overview |
| Finger phalanx | ~188 | Chunkier than mockup hands |

**Finding:** The 99% archive can produce a recognizable full-body anatomical
figure at clinician overview distance. It does **not** yet match a polished
commercial mockup for close facial/hand detail. Higher-detail BP3D / LOD1 is
a future option — not silently substituted.

## Rendering

- Clinical MeshStandard materials (muted terracotta muscle, warm ivory bone)
- Hemisphere + ambient + key + fill + rim lights
- ACES tone mapping when available
- Camera auto-frames body AABB after exterior load

## Patient isolation

Unchanged: Patient never constructs layer controller / never downloads packs.

## Honest visual assessment

This slice makes the clinician path **substantially more anatomically complete**
than the 12-structure shoulder prototype. It approaches a credible anatomical
model at overview scale, but remains BP3D 99% atlas geometry — not the polished
illustration quality of an approved marketing mockup.
