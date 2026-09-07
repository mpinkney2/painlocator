# Adult Male Exterior — License & Provenance

## Status

**Canonical-frame styled exterior (Option B visible layer)** for PainLocator Spatial Anatomy.

This is **not** a BodyParts3D redistribution and **not** a clinical atlas.
It is PainLocator-authored **procedural silhouette geometry** (lathe torso + soft
limb ellipsoids/capsules) placed at BP3D landmark targets so the visible exterior
lives natively in `painlocator-bp3d-canonical-v1`.

The prior capsule mannequin is archived at
`public/anatomy/spatial/dev/interim-mannequin/` for provenance only.

## Source

| Field | Value |
| --- | --- |
| Source | PainLocator authored procedural silhouette |
| Generator script | `scripts/generate-styled-exterior-glb.mjs` |
| Export tool | three.js `GLTFExporter` (**build-time / npm `three@0.170.0` only**) |
| Runtime loader | Vite ESM Spatial runtime (`spatial-runtime-entry.js` → npm `three` + GLTFLoader) |
| Retrieved / generated | 2026-09-07 |
| Canonical identifier | `painlocator:spatial:adult-male:exterior-lod0` |
| Coordinate frame | `painlocator-bp3d-canonical-v1` (identity conformer) |
| Alignment report | `./styled-exterior-alignment-report.json` |
| Intended evolution | Optional remesh/style from BP3D FMA7163 (CC BY 4.0) or commercial exterior in the same frame — see `docs/CANONICAL_BODY_ARCHITECTURE.md` |

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
present it as patient-specific anatomy or as a diagnostic model.

## Attribution note (canonical frame)

Hidden BP3D canonical skin (`prototype-bp3d-fullbody/`) remains **CC BY 4.0**
(DBCLS BodyParts3D). Landmark targets used to place this silhouette are derived
from that frame; the visible mesh geometry itself is original to PainLocator.
