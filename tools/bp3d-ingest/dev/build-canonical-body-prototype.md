# Build canonical-body prototype (offline)

This is a **dev** procedure for Slice 4. It does not update production runtime.

## Prerequisites

- `data/bodyparts3d/cache/isa_BP3D_4.0_obj_99.zip` present (`npm run bp3d:fetch`)
- `numpy`, `trimesh`
- `@gltf-transform/cli` (repo devDependency)

## Steps

1. Extract `FJ2810.obj` (FMA7163 skin) from the zip.
2. Remap vertices: `(x,y,z)_mm → (-x, z, -y) * 0.001`.
3. Export GLB; run `gltf-transform optimize … --compress meshopt`.
4. Optionally `gltf-transform simplify` for LOD1.
5. Refresh `manifest.json` / `validation.json` bounds from pre-compression AABB.
6. Keep attribution in `LICENSE.md`.

Do **not** register this folder in the production spatial catalog yet.
