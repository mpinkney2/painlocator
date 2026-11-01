# Spatial / BP3D Production Failure — Root Cause

**Date:** 2026-09-07  
**Environment:** https://painlocator.vercel.app (`main` @ PR #15 / `7da122e`)  
**Methods:**

1. Playwright Chromium against live production (`?spatialDiagnostics=1`)
2. **Confirmed real-browser capture on production laptop (2026-09-07)**

## Confirmed laptop diagnostics (authoritative)

UI:

- **3D body unavailable**
- User-visible reason: **The 3D library failed to load.**

Exact browser-visible error:

```text
ESM import failed for:
https://painlocator.vercel.app/vendor/GLTFLoader.js

Failed to fetch dynamically imported module:
https://painlocator.vercel.app/vendor/GLTFLoader.js
```

Spatial diagnostics (`?spatialDiagnostics=1`):

| Field | Value |
|-------|--------|
| health | FAILED |
| WebGL | true |
| Three REVISION | 170 (in at least one capture) |
| exterior.loaded | false |
| canonical.ready | false |
| muscleLoaded | false |
| skeletalLoaded | false |

**Cross-device note:** The same deployed application can render the Spatial exterior on iPhone. That proves the exterior renderer / assets are viable. The failure is the **browser-dependent module boot path** (runtime `import()` of `/vendor/GLTFLoader.js`), which is unacceptable for production.

## First failing stage (not BP3D)

**GLTFLoader browser runtime dependency-loading boundary**

Boot reached:

1. Spatial boot scripts load (classic) ✓  
2. `SpatialThreeLoader` / `SpatialBootUtils` present ✓  
3. Three.js via `/vendor/three.module.min.js` dynamic import ✓ (r170 in some browsers)  
4. WebGL available ✓  
5. **`import("/vendor/GLTFLoader.js")` fails** ✗  

Exterior GLB is never fetched because the loader never starts. Canonical / muscle / skeletal never run.

This is **not** a BP3D / canonical / layer failure. Those stages are downstream of a hard dependency boot failure.

## Playwright reproduction (same first stage)

Against live production, Chromium also failed at GLTFLoader with a strict module MIME failure when the server returned HTML:

```text
Failed to load module script: Expected a JavaScript-or-Wasm module script
but the server responded with a MIME type of "text/html".
```

Both captures agree on the **first hard failure**: `/vendor/GLTFLoader.js` dynamic ESM import.

## Why this is structural (not a cache-bust candidate)

Production still boots Spatial through the hybrid boundary:

- classic `<script>` globals  
- Function-built `import()` of `/public/vendor/*.js`  
- HTML import map for bare `"three"`  
- Vercel static hosting (previously included SPA catch-all rewrite to `index.html`)  

`GLTFLoader.js` is itself an ESM file that `import`s from `"three"`. Loading it via runtime dynamic import of a `/public` asset is fragile and **browser-dependent** (laptop fails; iPhone can succeed). That alone disqualifies further query-string / fallback / vendor-loader patches.

Do **not**:

- Patch `GLTFLoader.js` with another query string  
- Add another import fallback  
- Add another vendor-loader workaround  

## Required direction (implemented on this branch)

Replace `/public/vendor` runtime imports with **one Vite-managed ESM Spatial chunk** that statically imports `three` + `GLTFLoader` + Meshopt from **npm**, and expose a single bridge to the classic app.

**Acceptance — production build must make NO runtime request to:**

- `/vendor/GLTFLoader.js`
- `/vendor/three.module.min.js`

Three and GLTFLoader must come only from Vite-generated Spatial bundle/chunks.

## Safari assessment

Safari is not a separate Spatial boot path after this migration. Compatibility relies on **standard Vite-generated ESM chunks** (hashed `/assets/*.js`) loaded via a tiny `<script type="module">` bootstrap. Do not reintroduce custom Function-built `import()`, import maps, or `/public/vendor` Three modules for Safari.

## Latent mesh-id issue (exposed only after Vite boot succeeded)

Once GLTFLoader worked, integrity/binding could fail when GLB mesh names are undotted (`surfacehead`, `muscledeltoidclavicularleft`) while manifests use dotted ids (`surface.head`, `muscle.deltoid.clavicular.left`). Canonicalization/undot matching is required for exterior and clinician packs — not a substitute for fixing the Vite boot path, but required for end-to-end acceptance.
