# Adult Male Exterior — License & Provenance

## Status

**Interim Slice 1 asset** for PainLocator Spatial Anatomy.

This is **not** a BodyParts3D redistribution. It is an original PainLocator
procedural exterior mannequin exported to GLB for production-path wiring
(manifest → meshId → raycast → attachment) while a BodyParts3D-derived
exterior pipeline is prepared.

## Source

| Field | Value |
| --- | --- |
| Source | PainLocator authored geometry (`scripts/generate-exterior-glb.mjs`) |
| Generator | three.js `GLTFExporter` (build-time only) |
| Retrieved / generated | 2026-09-06 |
| Canonical identifier | `painlocator:spatial:adult-male:exterior-lod0` |
| Intended successor | BodyParts3D (DBCLS) exterior subset, CC BY 4.0 — see `docs/SPATIAL_ANATOMY_PHASE2_DECISION.md` |

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

## Modifications

- Generated as multi-mesh humanoid capsules/spheres with clinical-neutral
  materials and stable `meshId` names (`surface.*`).
- No third-party anatomy mesh files were imported.

## Commercial redistribution

Allowed with the PainLocator product distribution, subject to the
application repository license. Replace with BodyParts3D-derived assets
before claiming FMA-backed clinical structure coverage.

## Payload

`exterior-lod0.glb` is **293,968 bytes** (~287 KiB) as of 2026-09-06 —
well under the 3–5 MB initial exterior transfer target.
