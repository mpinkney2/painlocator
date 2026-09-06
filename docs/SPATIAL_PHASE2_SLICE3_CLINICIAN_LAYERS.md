# Phase 2 Slice 3 — Clinician layered anatomy preview (left shoulder)

**Date:** 2026-09-06  
**Status:** Runtime clinician preview on Spatial — Patient shell unchanged.

## What this slice proves

Patient-reported pain → exterior body → clinician selects Muscle/Skeletal → surface ghosts → verified BP3D structures → pain markers remain → anatomical context (not diagnosis).

## Architecture

| Module | Role |
| --- | --- |
| `spatial-layer-loader.js` | Lazy pack fetch, meshopt decode, manifest identity, registration apply, in-session cache |
| `spatial-layer-controller.js` | Depth state, ghost materials, structure pick, dispose |
| `registration/bp3d-shoulder-adult-male.json` | Explicit rigid transform (not renderer constants) |

Patient (`presentationMode === "patient"`) never constructs the controller and cannot fetch packs.

### Cache / ownership (runtime invariant)

PainLocator mounts **at most one** active `SpatialAnatomyRenderer` at a time (plate ↔ spatial remount tears down the prior spatial mount first).

- **Loader cache** owns pack templates: GLTF scene graphs, geometries, registration + manifest metadata, and in-flight pack promises.
- **Controller** borrows packs: parents `root` into its layer group, may replace mesh **materials** for preview styling, and on dispose **detaches** only (`SpatialLayerLoader.detachPack`) — it must not free shared geometries.
- Failed loads delete their promise entry so a later retry can fetch again.
- `clearPackCache()` is for intentional session wipe / tests only.


## Registration

See [`SPATIAL_PHASE2_SLICE3_REGISTRATION.md`](./SPATIAL_PHASE2_SLICE3_REGISTRATION.md).  
**Result:** `pass-preview` — credible for clinician preview; **not** clinical precision.

## Non-goals (still)

Neural / Internal, full-body BP3D default, persisted spatial schema, diagnosis language, Patient layers.

## Payloads (lazy)

- `muscle.glb` ≈ 90 KB  
- `skeletal.glb` ≈ 116 KB  

Loaded only after clinician selects Muscle or Skeletal.
