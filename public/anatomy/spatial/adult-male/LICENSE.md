# Adult Male Exterior — License & Provenance

## Status

**Interim Slice 1 asset** for PainLocator Spatial Anatomy.

This is **not** a BodyParts3D redistribution. It is original PainLocator-authored
**procedural geometry** (capsules/spheres/boxes), not medically validated anatomy,
exported to GLB for production-path wiring
(manifest → meshId → raycast → attachment) while a BodyParts3D-derived
exterior pipeline is prepared.

## Source

| Field | Value |
| --- | --- |
| Source | PainLocator authored procedural geometry |
| Generator script | `scripts/generate-exterior-glb.mjs` |
| Export tool | three.js `GLTFExporter` (**build-time / npm `three@0.170.0` only**) |
| Runtime loader | Vendored `public/vendor/GLTFLoader.js` + `public/vendor/three.module.min.js` (r170) |
| Retrieved / generated | 2026-09-06 |
| Canonical identifier | `painlocator:spatial:adult-male:exterior-lod0` |
| Intended successor | BodyParts3D (DBCLS) exterior subset, CC BY 4.0 — see `docs/SPATIAL_ANATOMY_PHASE2_DECISION.md` |

## Structure IDs

Mesh entries use **PainLocator-local interim** `structureId` values of the form
`PL:surface.*`. These are **not** FMA IDs. Future BodyParts3D / FMA mapping will
replace or map these IDs through the spatial manifest contract without changing
runtime attachment identity (`meshId`).

## License

Copyright © 2026 PainLocator contributors.

Permission is granted to use, copy, modify, and redistribute this interim
asset **as part of PainLocator** under the same terms as the PainLocator
application repository.

This mesh is a **locator surface**, not a clinical anatomy atlas. Do not
claim BodyParts3D provenance or diagnostic anatomical accuracy for this
interim file.

## Attribution requirements

When distributing PainLocator builds that include this file, retain this
`LICENSE.md` beside the GLB / reference it from the spatial manifest
`provenance.licenseRef`.

three.js / GLTFExporter are MIT-licensed; see `public/vendor/THREE_LICENSE`.

## Modifications

- Generated as multi-mesh humanoid capsules/spheres/boxes with clinical-neutral
  materials and stable `meshId` names (`surface.*`).
- No third-party anatomy mesh files were imported.

## Commercial redistribution

Allowed with the PainLocator product distribution, subject to the
application repository license. Replace with BodyParts3D-derived assets
before claiming FMA-backed clinical structure coverage.

## Payload

`exterior-lod0.glb` is **293,968 bytes** (~287 KiB) as of regeneration with
`three@0.170.0` / `GLTFExporter` — well under the 3–5 MB initial exterior
transfer target. Exact bytes may vary slightly across regenerations; do not
treat the GLB as byte-identical across exports.
