# Vendor evaluation assets (local / NDA only)

**Do not commit proprietary geometry.**  
**Do not copy samples into `public/`.**  
**Do not ship on Vercel.**

Drop evaluation samples under:

```text
data/vendor-eval/sciepro/   # preferred candidate (PR #20)
data/vendor-eval/zygote/    # optional backup vendor
```

Committed files allowed: `README.md`, `.gitkeep`, `*.template.json`, landmark worksheets.

Everything else (`.obj`, `.fbx`, `.gltf`, `.glb`, `.bin`, textures, zips) is gitignored and excluded from production builds.

See:

- `docs/SCIEPRO_EVALUATION_HARNESS.md`
- `docs/SCIEPRO_RUNTIME_DELIVERY_ARCHITECTURE.md`
- `npm run vendor-eval:serve`
