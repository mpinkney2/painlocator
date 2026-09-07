# SciePro Evaluation Harness — Runbook

**Branch tooling:** `tools/anatomy-vendor/`, `src/engine/anatomy/vendor/`, `data/anatomy-vendor/`  
**Decision:** PR #20 — SciePro preferred visual candidate  
**No proprietary assets in git. No purchase in this harness.**

---

## What this harness provides

| Piece | Location |
| --- | --- |
| Vendor-neutral contract | `src/engine/anatomy/vendor/anatomy-vendor-types.js` |
| Adapter (map validate + selection resolve + patient guard) | `src/engine/anatomy/vendor/anatomy-vendor-adapter.js` |
| SciePro mapping template | `data/anatomy-vendor/sciepro-to-fma-v0.template.json` |
| Canonical landmarks | `data/anatomy-vendor/canonical-landmarks-v1.json` |
| Eval asset boundary | `data/vendor-eval/**` (gitignored meshes) |
| Registration harness | `npm run vendor-eval:register` |
| Mesh metrics | `npm run vendor-eval:metrics` |
| Leak safeguard | `npm run vendor-eval:verify-exclusion` (also in `npm run build`) |
| Visual QA (local) | `npm run vendor-eval:serve` → http://127.0.0.1:5510/ |
| Delivery architecture | `docs/SCIEPRO_RUNTIME_DELIVERY_ARCHITECTURE.md` |
| Mockup checklist | `docs/visual-targets/VENDOR_MOCKUP_ACCEPTANCE_CHECKLIST.md` |

---

## Exact steps once the SciePro sample arrives

1. **Legal:** confirm pilot/NDA covers local evaluation + conversion experiments.  
2. **Drop files** under `data/vendor-eval/sciepro/source/` (never `public/`).  
3. **Export landmarks** into `data/vendor-eval/sciepro/landmarks.json` using required ids:
   `vertex, shoulderL/R, humeralHeadL/R, elbowL/R, hipL/R, kneeL/R, ankleL/R, bodyCenter`  
4. **Register:**
   ```bash
   npm run vendor-eval:register
   ```
   Inspect `data/vendor-eval/sciepro/derived/registration-report.json`.  
   If status is `GLOBAL CONFORMER FAILED` → stop (no regional patches).  
5. **Fill mapping:** copy template → `data/vendor-eval/sciepro/sciepro-to-fma-v0.json` and set real `vendorStructureId` / names (do not invent). Update confidence to `EXACT` only when verified.  
6. **Metrics:**
   ```bash
   npm run vendor-eval:metrics
   ```
7. **Visual QA:**
   ```bash
   npm run vendor-eval:serve
   ```
   Compare BP3D 99% vs vendor GLB; complete mockup checklist.  
8. **Selection proof:** Demo selection resolve must emit `vendorStructureId → fmaStructureId → clinicalName → laterality → region → layer`.  
9. **Do not** meshopt/quantize for production until Realtime conversion rights are confirmed.  
10. **Do not** merge sample binaries; keep exclusion green:
    ```bash
    npm run vendor-eval:verify-exclusion
    npm test && npm run typecheck && npm run build
    ```

---

## npm scripts

```bash
npm run vendor-eval:serve
npm run vendor-eval:register
npm run vendor-eval:metrics
npm run vendor-eval:verify-exclusion
```
