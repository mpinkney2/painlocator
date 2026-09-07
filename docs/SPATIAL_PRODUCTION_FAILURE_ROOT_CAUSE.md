# Spatial / BP3D Production Failure — Root Cause

**Date:** 2026-09-07  
**Environment:** https://painlocator.vercel.app (`main` @ PR #15 / `7da122e`)  
**Method:** Playwright Chromium against live production (`?spatialDiagnostics=1`)

## Observed UI

- Title: **3D body unavailable**
- Diagnostics health: **FAILED**
- Three REVISION: **170** (loaded)
- WebGL: available
- Exterior: not loaded
- Canvas count: 1 (status/probe only; no `.cae-spatial-viewport`)

## First failing stage

**Exterior GLB load → GLTFLoader ESM import**

Boot reached:

1. Spatial boot scripts load (classic) ✓  
2. `SpatialThreeLoader` / `SpatialBootUtils` present ✓  
3. Three.js via `/vendor/three.module.min.js` dynamic import ✓ (r170)  
4. WebGL probe / renderer path starts ✓  
5. **`import("/vendor/GLTFLoader.js")` fails** ✗  

Technical error surfaced to status:

```text
ESM import failed for https://painlocator.vercel.app/vendor/GLTFLoader.js:
Failed to fetch dynamically imported module:
https://painlocator.vercel.app/vendor/GLTFLoader.js
```

Browser console (strict module MIME check):

```text
Failed to load module script: Expected a JavaScript-or-Wasm module script
but the server responded with a MIME type of "text/html".
```

## Why this is structural (not a one-off cache bug)

Production still boots Spatial through the hybrid boundary:

- classic `<script>` globals  
- Function-built `import()` of `/public/vendor/*.js`  
- HTML import map for bare `"three"`  
- Vercel static SPA hosting (`vercel.json` catch-all rewrite to `index.html`)  

`GLTFLoader.js` is itself an ESM file that `import`s from `"three"`. Loading it via runtime dynamic import of a `/public` asset is fragile under:

- SPA rewrite / HTML fallback MIME (`text/html`) for module scripts  
- import-map + classic-script dynamic-import interaction  
- dual Three sources (npm for tooling vs `/public/vendor` at runtime)

Three can succeed while GLTFLoader fails — exactly the production symptom.

## Not the first failure

- Not WebGL unavailable  
- Not missing exterior GLB asset (asset exists; never fetched because loader never started)  
- Not `SpatialThreeLoader` missing (present after PR #15)  
- Not canonical/layer stage (never reached)

## Required direction

Replace `/public/vendor` runtime imports with **one Vite-managed ESM Spatial chunk** that statically imports `three` + `GLTFLoader` + Meshopt from **npm**, and expose a single bridge to the classic app.

Do not continue patching Function-built `/vendor` imports.

## Safari assessment

Safari is not a separate Spatial boot path after this migration. Compatibility relies on **standard Vite-generated ESM chunks** (hashed `/assets/*.js`) loaded via a tiny `<script type="module">` bootstrap. Do not reintroduce custom Function-built `import()`, import maps, or `/public/vendor` Three modules for Safari.

Supported browsers receive the same module graph Chromium uses. Remaining classic scripts stay classic; only the Spatial dependency graph is ESM/Vite.

## Latent mesh-id issue (exposed after Vite boot succeeded)

Once GLTFLoader worked, integrity/binding could fail when GLB mesh names are undotted (`surfacehead`, `muscledeltoidclavicularleft`) while manifests use dotted ids (`surface.head`, `muscle.deltoid.clavicular.left`). Canonicalization/undot matching is required for exterior and clinician packs — not a substitute for fixing the Vite boot path, but required for end-to-end acceptance.
