# Adult Male Exterior — License & Provenance

## Status

**Interim patient exterior** for PainLocator Spatial Anatomy.

This mesh is a **stylized presentation** of BodyParts3D (DBCLS) full-body skin
(FMA:7163) with PainLocator clinical skin materials and soft lighting. It is a
locator surface, not a diagnostic atlas.

## Source

| Field | Value |
| --- | --- |
| Anatomy source | BodyParts3D / Anatomography (DBCLS), FMA:7163 *skin* |
| Presentation | PainLocator warm clinical materials (runtime override) |
| Runtime loader | Vendored `public/vendor/GLTFLoader.js` + meshopt + `three.module.min.js` (r170) |
| Retrieved / adapted | 2026-11-01 |
| Canonical identifier | `painlocator:spatial:adult-male:exterior-lod0` |
| Coordinate frame | `painlocator-bp3d-canonical-v1` (native; identity vs hidden canonical body) |

## Structure IDs

Mesh entry uses PainLocator-local `structureId` `PL:surface.body` with
`fmaId` `FMA:7163` documented in the model manifest. Regional pain labels may
still resolve through CAE region helpers; attachment identity uses `meshId`
`surface.body`.

## License

BodyParts3D content is **CC BY 4.0** (DBCLS). Redistribution of this derived
exterior with PainLocator requires retaining BodyParts3D attribution:

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan  
> (official LATEST packs use CC BY 4.0 — see `docs/BODYPARTS3D_SOURCE_PROVENANCE.md`)

PainLocator material / lighting presentation code is Copyright © 2026
PainLocator contributors.

## Attribution requirements

When distributing PainLocator builds that include this file, retain this
`LICENSE.md` beside the GLB / reference it from the spatial manifest
`provenance.licenseRef`, and keep BodyParts3D credit in product documentation.

three.js / GLTFExporter / meshopt are MIT-licensed; see `public/vendor/THREE_LICENSE`.

## Modifications

- 2026-11-01: Replaced procedural capsule mannequin with BP3D FMA:7163 skin
  shell as the patient exterior; node/mesh named `surface.body` with extras
  `meshId`. Runtime applies warm clinical MeshPhysicalMaterial + soft lighting
  (not raw atlas materials).
- Landmark-based exterior→canonical conformer is **identity** for this native
  BP3D exterior (same frame as hidden canonical body).

## Commercial redistribution

Allowed under BodyParts3D CC BY 4.0 with attribution, together with the
PainLocator application license. Licensed commercial exteriors (Zygote /
SciePro, etc.) may later replace this mesh via the same `modelId` / `meshId`
manifest contract.

## Payload

`exterior-lod0.glb` is an uncompressed baked BP3D skin (~2.0 MB) with
vertex normals and feet on y=0 — under the 3–5 MB initial exterior
transfer target. Regenerate with `node scripts/bake-bp3d-patient-exterior.mjs`.
