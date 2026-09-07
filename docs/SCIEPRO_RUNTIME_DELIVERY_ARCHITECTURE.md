# SciePro / Vendor Runtime Delivery Architecture

**Date:** 2026-09-07  
**Status:** Design — **license approval required** before claiming compliance  
**Related:** [`PRODUCTION_ANATOMY_VENDOR_DECISION.md`](./PRODUCTION_ANATOMY_VENDOR_DECISION.md), SciePro Realtime “Compiled Form” terms

This document separates **technical feasibility** from **vendor license approval**.  
Nothing here asserts that a delivery mode satisfies SciePro (or Zygote) terms until counsel/vendor confirms it in writing.

---

## Production constraint (public SciePro terms)

SciePro Realtime / Multi-Purpose licenses require **Compiled Form** delivery for interactive WebGL:

- End users must not receive downloadable source meshes/textures.
- Serving raw `.obj` / `.fbx` / `.glb` / `.gltf` via publicly accessible URLs does **not** satisfy anti-extraction (even if unlinked).
- Reasonable obfuscation expected: custom binary formats, encrypted asset bundles, or server-side rendering where feasible.

PainLocator’s current Spatial loader fetches public GLBs under `/anatomy/spatial/…`. That pattern is **not** acceptable for proprietary SciePro production assets without a Compiled Form redesign.

Evaluation samples stay under `data/vendor-eval/` (gitignored, local server only).

---

## Options

| Option | Technical feasibility | License approval required? | Notes for PainLocator |
| --- | --- | --- | --- |
| **A. Preprocessed encrypted/obfuscated mesh bundles** | **High** | **Yes** | Encrypt meshopt GLB (or custom container) at build; decrypt in Spatial runtime after auth. Closest fit to “Compiled Form”. |
| **B. Authenticated API delivery** | High | Yes | Browser requests bytes with session/JWT; still must not leave a stable public URL to raw interchange formats. |
| **C. Signed URL delivery** | Medium | Yes | Short-lived URLs alone may still expose GLB bytes — usually **insufficient** if the object is standard glTF. Prefer signed URL **to encrypted container**. |
| **D. Server-side packaging** | High | Yes | Build packs on server from private object store; never commit vendor sources to git/`public/`. |
| **E. Streamed/decrypted runtime payload** | Medium–high | Yes | Chunked transfer + in-memory decrypt; harder caching; good anti-extraction posture. |
| **F. Commercial DRM / asset-protection** | Unknown | Yes | Only if vendor mandates; adds lock-in and mobile complexity. Do not adopt preemptively. |

### Recommended production direction (pending vendor confirmation)

**A + B + D:**

1. Keep proprietary masters offline (private storage / CI secret).  
2. Build regional meshopt packs → **encrypt** with app-scoped key material.  
3. Deliver via authenticated API (or signed URL to the encrypted blob).  
4. Decrypt in CAE Spatial runtime into ArrayBuffer → `GLTFLoader.parse`.  
5. Never place decrypted GLBs under `public/` or Vercel static output.

### Explicitly not claimed yet

- That meshopt alone is Compiled Form.  
- That Vite hashed `/assets/*.glb` is acceptable.  
- That patient Surface exterior can reuse SciePro skin without separate license scope.

---

## Evaluation vs production

| Mode | Path | Allowed formats |
| --- | --- | --- |
| Evaluation (this harness) | `data/vendor-eval/**` + `npm run vendor-eval:serve` (127.0.0.1) | Vendor sample as received |
| Production (future) | Encrypted packs via API — **not** `public/anatomy` | Only after written Realtime confirmation |

---

## Patient / clinician isolation

Unchanged product rule:

- **Patient:** styled exterior only — never vendor Muscle/Skeletal packs.  
- **Clinician:** Surface / Muscle / Skeletal (+ future systems) after mapping + registration gates pass.

`AnatomyVendorAdapter.assertClinicianPresentation("patient")` throws `VENDOR_PATIENT_ISOLATION`.
