# PainLocator — Approved Anatomical Visual Target (LOCKED)

**Date:** 2026-09-07  
**Status:** Product visual north star — locked

## Approved references

| File | Theme |
| --- | --- |
| [`painlocator-clinician-anatomy-target-light.png`](./visual-targets/painlocator-clinician-anatomy-target-light.png) | Light clinician workspace |
| [`painlocator-clinician-anatomy-target-dark.png`](./visual-targets/painlocator-clinician-anatomy-target-dark.png) | Dark clinician workspace |

These mockups define the **finished anatomical appearance** PainLocator must converge on.

## What “done” looks like

A realistic, full-body adult human anatomical figure with:

- recognizable musculature, tendons, and bone form
- adult human proportions (not capsule/mannequin)
- clinical (not game-like) materials and lighting
- interactive 3D: rotate, snap Front/Back/Left/Right, mark pain
- selectable BP3D/FMA structures in clinician Muscle/Skeletal depths

This target applies across:

| Surface | Requirement |
| --- | --- |
| **Clinician** Spatial viewport | Muscle / Skeletal match target quality |
| **Patient** Spatial viewport | Smooth, human exterior (Surface) — not exposed atlas musculature by default; same underlying body architecture |
| **Reports / PDF / PNG exports** | Output images use the same anatomical representation family (not legacy plate silhouette as the long-term default) |
| **History / review snapshots** | Same visual system |

## Explicitly rejected as finished visuals

- Segmented gray capsule / mannequin exterior as production anatomy
- Left-shoulder-only BP3D as the finished clinician body
- Flat 2D plate silhouettes as the long-term clinical anatomy identity
- Decorative non-FMA meshes that abandon BodyParts3D identity

Interim assets may remain as **fallback / compatibility** only.

## Current engineering position (honest)

| Layer | Today | vs target |
| --- | --- | --- |
| Vite Spatial boot | Working (PR #16 lineage) | Required foundation ✓ |
| Styled exterior | Procedural silhouette — **fallback only**, not production Surface | **not** target |
| Full-body BP3D | 851 structures behind `?fullBodyAnatomy=1` from **99%** archive | Coverage ✓; **source tier FAIL** for mockup |
| Reports / exports | Prefer Spatial WebGL capture when Spatial-primary; plate fallback | Wiring improving; geometry still 99%/silhouette |

**Source-tier decision (2026-09-07):** See [`BODYPARTS3D_PRODUCTION_SOURCE_DECISION.md`](./BODYPARTS3D_PRODUCTION_SOURCE_DECISION.md).

Verdict: **NO** — official BodyParts3D **4.0 publishes only 99%** meshes. Historical 3.0 **95%** is ~4× denser but wrong release/frame/license for production master.

## Path to close the gap (ordered)

1. ~~Visual fidelity audit of 99%~~ → **DONE: 99% cannot meet target.**
2. **Vendor geometry path (preferred):** SciePro evaluation sample → FMA map → global canonical registration → Realtime license — see [`PRODUCTION_ANATOMY_VENDOR_DECISION.md`](./PRODUCTION_ANATOMY_VENDOR_DECISION.md).
3. **Optional parallel:** obtain official BP3D 4.0 ≤95% / HD elemental OBJs from DBCLS if ever published.
4. Build production muscle/skeletal packs + LODs **from the chosen visual master** (never upsample 99%).
5. **Surface** production exterior derived from the same canonical frame.
6. Materials / lighting / camera polish on production geometry.
7. Spatial PNG/PDF capture then default-cutover after human visual QA.

## Non-negotiables

- Preserve `painlocator-bp3d-canonical-v1`
- Preserve FMA / BP3D structure identity
- No regional registration hacks
- Assistive labeling only — never diagnostic claims
- Patient must not see FMA/BP3D chrome by default

## Final bar

A clinician (and patient Surface view / report output) should open PainLocator and immediately recognize a **credible human anatomical model** in the family of these mockups — not an engineering prototype mesh.
