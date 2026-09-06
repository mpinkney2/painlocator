# PR #10 BodyParts3D pipeline hardening — summary

**Branch:** `cursor/spatial-phase2-slice2-bp3d-ingest-83c7`  
**Verified:** 2026-09-06

## A. Repo-size / source-data decision

PainLocator does **not** mirror BodyParts3D. Upstream zip (~136 MB), mapping tables, and subset OBJs are **fetched and checksum-verified locally**. Git keeps pins, curated subset metadata, optimized GLBs, and docs only.

## B. Removed from git vs retained

**Removed / not committed:** full mapping TSVs, 12 raw OBJs (~3.4 MB), `raw-pre-meshopt/*.glb`, cache zip.

**Retained:** ingest scripts, `source-manifest.json`, `ARCHIVE.sha256` + `obj.sha256`, license/provenance docs, curated FMA verification table, optimized `skeletal.glb`/`muscle.glb`, `manifest.json`, `LICENSE.md`, `build-report.json`, `orientation-check.json`, small DEV orientation SVG.

## C. Canonical fetch/pin strategy

`npm run bp3d:fetch` downloads official LATEST URLs but treats **SHA-256 in `ARCHIVE.sha256` as the immutable pin**. Mismatch → hard fail. Then extracts **only** the 12 subset OBJs and verifies each against `obj.sha256`.

## D. glTF Transform dependency

`@gltf-transform/cli@4.1.1` is an exact **devDependency**. `optimize.mjs` uses `node_modules/.bin/gltf-transform` (no ad-hoc `npx`). Version recorded in `build-report.json`.

## E. Python reference environment

Ranges in `requirements.txt`; exact reference lock in `requirements-lock.txt` (`trimesh==5.1.0`, `numpy==2.4.4`). Also recorded in `build-report.json` with `pythonVersion`.

## F. License / provenance wording

OBJ headers = historical CC BY-SA 2.1 JP text. Use is based on current official DBCLS license page (CC BY 4.0), verified 2026-09-06. Commercial release should retain contemporaneous license evidence. Not a legal determination.

## G. FMA verification (12/12 ok)

| meshId | structureId | representation | element | layer |
| --- | --- | --- | --- | --- |
| bone.humerus.left | FMA:23131 | BP9191 | FJ3262 | skeletal |
| bone.scapula.left | FMA:13396 | BP9121 | FJ3279 | skeletal |
| bone.clavicle.left | FMA:13323 | BP8841 | FJ3237 | skeletal |
| muscle.deltoid.clavicular.left | FMA:34681 | BP8259 | FJ1468M | muscle |
| muscle.deltoid.acromial.left | FMA:34683 | BP9075 | FJ1467M | muscle |
| muscle.deltoid.spinal.left | FMA:34685 | BP8151 | FJ1513M | muscle |
| muscle.supraspinatus.left | FMA:32545 | BP8376 | FJ1506M | muscle |
| muscle.infraspinatus.left | FMA:32548 | BP8965 | FJ1500M | muscle |
| muscle.subscapularis.left | FMA:13415 | BP8214 | FJ1504M | muscle |
| muscle.biceps_brachii.long_head.left | FMA:37687 | BP8816 | FJ1478M | muscle |
| muscle.biceps_brachii.short_head.left | FMA:37685 | BP9153 | FJ1512M | muscle |
| muscle.triceps_brachii.long_head.left | FMA:37700 | BP8344 | FJ1479M | muscle |

## H. Coordinate orientation

Canonical transform `(-x, z, -y)*0.001` **validated**: left on −X, superior on +Y, anterior heuristic on +Z. DEV markers/SVG only — not production Spatial routing.

## I. Skeletal↔muscle registration

Shared BP3D space; layer centroid separation ≈ **0.039 m**. Bounds overlap sensibly. No BP3D↔interim-exterior registration attempted.

## J. Derived-asset policy

**Commit:** optimized GLBs + manifest + LICENSE + build-report + orientation-check.  
**Regenerate:** raw OBJs, mapping tables, `raw-pre-meshopt/`.

## K. Canonical build command

```bash
npm run bp3d:build   # fetch→verify→ingest→optimize→orientation→integrity
```

## L. CI strategy

| Suite | Command | Network | When |
| --- | --- | --- | --- |
| Fast app CI | `npm test` / `typecheck` / `build` | No | Every PR |
| Anatomy integrity | `npm run bp3d:test` (also hooked from `npm test`) | No | Every PR |
| Full source rebuild | `npm run bp3d:build` | Yes (first cache) | Source updates, new packs, release validation |

## M / N. Verification results

- `npm test` — 50 passed  
- `npm run typecheck` — pass  
- `npm run build` — pass  
- `npm run bp3d:test` — pass  
- `npm run bp3d:build` — pass (cache reuse + checksum validation)

## O. Merge readiness

**Yes — ready to merge** as an offline anatomy-source pipeline prototype, provided reviewers accept that runtime layer integration remains a future slice. Production `adult-male` Spatial catalog is unchanged.
