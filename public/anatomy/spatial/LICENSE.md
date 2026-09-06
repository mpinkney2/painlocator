# Spatial anatomy assets — catalog license

Root catalog for PainLocator Spatial Anatomy (`public/anatomy/spatial/`).

- Per-model licenses live next to each model (e.g. `adult-male/LICENSE.md`).
- Slice 1 ships an **interim** exterior GLB (PainLocator-authored), not BodyParts3D.
- Future BodyParts3D-derived assets must retain DBCLS CC BY 4.0 attribution
  as documented in `docs/SPATIAL_ANATOMY_PHASE2_DECISION.md`.

If catalog, manifest, GLB, GLTF parse, Three, WebGL, or **manifest↔GLB meshId
integrity** fail, Spatial mount falls back cleanly to plate mode (no procedural
body substitute; incomplete bodies are not shown).

Interim `structureId` values use the `PL:surface.*` scheme (PainLocator-local,
not FMA). Future BodyParts3D / FMA mapping is expected to replace or map these
IDs through the manifest contract.
