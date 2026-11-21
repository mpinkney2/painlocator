# Adult Male Exterior — License & Provenance

**Interim patient exterior** for PainLocator Spatial Anatomy (3D mode). A stylized
presentation of BodyParts3D (DBCLS) full-body skin (FMA:7163) with PainLocator
clinical materials. Locator surface only — not a diagnostic atlas.

| Field | Value |
| --- | --- |
| Anatomy source | BodyParts3D / Anatomography (DBCLS), FMA:7163 *skin* |
| Runtime path | `/anatomy/spatial/adult-male/exterior-lod0.glb` |
| Loader | Vendored `GLTFLoader.js` + meshopt + `three.module.min.js` (r170) |
| Identifier | `painlocator:spatial:adult-male:exterior-lod0` |
| Frame | `painlocator-bp3d-canonical-v1` (native; identity vs hidden canonical body) |

## License

**BodyParts3D, © The Database Center for Life Science, licensed under CC BY 4.0.**  
See `docs/BODYPARTS3D_SOURCE_PROVENANCE.md`. Retain this file beside the GLB and keep
BodyParts3D credit in product documentation when redistributing.

PainLocator material / lighting presentation code is Copyright © 2026 PainLocator contributors.

`exterior-lod0.glb` (~2.0 MB) — regenerate with `node scripts/bake-bp3d-patient-exterior.mjs`.
