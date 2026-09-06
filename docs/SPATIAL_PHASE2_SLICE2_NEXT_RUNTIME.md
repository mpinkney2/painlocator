# Phase 2 Slice 2 — BodyParts3D ingest prototype complete

**Date:** 2026-09-06  
**Status:** Offline / build-time prototype only — **not** wired into the production Spatial viewer.

See also: [`BODYPARTS3D_SOURCE_PROVENANCE.md`](./BODYPARTS3D_SOURCE_PROVENANCE.md), [`tools/bp3d-ingest/README.md`](../tools/bp3d-ingest/README.md).

## What shipped in this slice

- Official BodyParts3D 4.0 IS-A 99% pack provenance + CC BY 4.0 attribution
- Left-shoulder subset (12 structures: 3 skeletal + 9 muscle)
- Reproducible ingest → `public/anatomy/spatial/prototype-bp3d/`
- FMA-mapped PainLocator manifest + Meshopt GLBs
- Integrity tests (manifest↔GLB, checksums, production catalog untouched)

## Slice 3 status

**Shipped:** clinician Surface / Muscle / Skeletal preview — see [`SPATIAL_PHASE2_SLICE3_CLINICIAN_LAYERS.md`](./SPATIAL_PHASE2_SLICE3_CLINICIAN_LAYERS.md).

## Original recommended next slice — runtime layer integration

Do **not** replace the patient exterior path yet. Integrate as clinician opt-in layers on top of the existing adult-male exterior.

### Goals

1. Keep `adult-male/exterior-lod0.glb` as the default Spatial body.
2. Add **lazy** clinician layer packs (`skeletal`, `muscle`) to the adult-male (or a sibling) manifest.
3. Ghost / fade the exterior when deeper layers are shown.
4. Keep pain annotations spatially registered to the exterior (patient-reported location).
5. Use `FMA:` structureIds only for **anatomical context** labels (never diagnosis).
6. Retain plate fallback and Patient shell unchanged.

### Proposed manifest evolution (additive)

```json
{
  "modelId": "adult-male",
  "layers": {
    "surface": { "file": "./exterior-lod0.glb", "meshes": ["/* existing PL: ids */"] },
    "skeletal": {
      "file": "./layers/skeletal-lod0.glb",
      "load": "onDemand",
      "meshes": [{ "meshId": "bone.humerus.left", "structureId": "FMA:23131" }]
    },
    "muscle": {
      "file": "./layers/muscle-lod0.glb",
      "load": "onDemand",
      "meshes": [{ "meshId": "muscle.deltoid.acromial.left", "structureId": "FMA:34683" }]
    }
  }
}
```

### Runtime behaviour

| Mode | Behaviour |
| --- | --- |
| Patient Spatial | Exterior only; no FMA chrome |
| Clinician Spatial | Exterior + layer chips (Muscle / Skeleton); opacity / isolate |
| Annotation hit | Prefer exterior meshId for persistence; optional nearby FMA context from deeper layers |
| Failure | Plate fallback unchanged |

### Registration / alignment work required

- Confirm BodyParts3D-normalized subset aligns with interim exterior (scale/origin). May need a documented rigid registration offset before full-body BP3D exterior replaces the interim mannequin.
- Expand subset → regional packs → whole-body progressive downloads.
- Extend `SpatialManifestLoader` to allow `FMA:` structureIds on non-surface layers (today Slice 1 validator requires `PL:` on surface).

### Explicit non-goals for the next slice

- No atlas browser
- No diagnosis / “caused by” language
- No schema break for 2D `PainRegion`
- No React migration
