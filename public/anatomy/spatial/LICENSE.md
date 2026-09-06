# Spatial anatomy placeholder (Phase 1)

## Asset

PainLocator Phase 1 does **not** ship a third-party anatomical mesh.

The Spatial Anatomy Renderer builds a **procedural, stylized humanoid** at runtime
from Three.js primitive geometries (spheres / capsules / lathe-style forms)
inside `src/engine/spatial/spatial-scene-controller.js`.

This placeholder exists only to validate:

- CAE renderer switching (plate ↔ spatial)
- drag rotate + orthographic snap (front / back / left / right)
- surface raycasting
- runtime marker attachment while rotating
- projection of hits into existing 2D `PainRegion.view` + `anchors`

It is **not** a clinical anatomy atlas and must not be presented as one.

## License

| Component | License | Notes |
|-----------|---------|-------|
| Procedural body construction code | Same as PainLocator repository | First-party code |
| Three.js runtime (`public/vendor/three.module.min.js`) | MIT — see `public/vendor/THREE_LICENSE` | Lazy-loaded only in spatial mode |

No BodyParts3D, Zygote, BioDigital, or other commercial/research atlas assets are included in Phase 1.

## Future production meshes

Licensed clinical glTF layers (skin / muscle / skeleton / nerve / organ) may replace
this placeholder in a later phase. Any replacement **must** ship with an explicit
redistribution license file before merge.
