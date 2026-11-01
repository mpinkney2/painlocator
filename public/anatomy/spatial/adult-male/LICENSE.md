# Adult Male Exterior — License & Provenance

## Status

Clinician Spatial surface for PainLocator. This is the **Blender standing figure**
(`New-avatar-stand`) shared with the patient simple-map baker.

It is a locator surface, not a diagnostic anatomy atlas.

## Source

| Field | Value |
| --- | --- |
| Source | Author Blender export (`New-avatar-stand.glb`) |
| Runtime path | `/anatomy/metahuman/body.glb` |
| Runtime loader | Vendored `GLTFLoader.js` + meshopt decoder (r170) |
| Retrieved | 2026-09-11 |
| Identifier | `painlocator:spatial:adult-male:blender-stand` |

The retired procedural mannequin (`exterior-lod0.glb`, capsules/spheres) is no longer the clinician exterior.

## Structure IDs

Single mesh `surface.body` / `PL:surface.body`. PainLocator-local — not an FMA ID.

## License

Copyright © 2026 PainLocator contributors and the figure author.

Permission is granted to use this mesh as part of PainLocator under the same
terms as the application repository.

## Payload

`/anatomy/metahuman/body.glb` is meshopt-compressed glTF Binary (~1 MB).
