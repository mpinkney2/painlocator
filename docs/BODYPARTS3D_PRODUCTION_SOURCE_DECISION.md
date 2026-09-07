# BodyParts3D — Production Source Decision

**Date:** 2026-09-07  
**Branch:** `cursor/bp3d-production-source-tier-83c7`  
**Status:** DECISION LOCKED — stop polishing 99% as production master  
**Companion artifacts:** [`visual-targets/bp3d-source-tier-comparison/`](./visual-targets/bp3d-source-tier-comparison/)

---

## Final required decision

### Is the current BodyParts3D source tier capable of producing the approved realistic full-body PainLocator anatomy?

# **NO**

The current production pin (`isa_BP3D_4.0_obj_99.zip`, 99% polygon reduction) is a **prototype-resolution** archive. It successfully proved ingestion, FMA identity, canonical framing, and clinician layer UX. It **cannot** meet the approved clinician visual target (realistic musculature / head / hands / feet comparable to modern anatomy education software).

Further materials, lighting, or meshopt polish on 99% geometry will not close the gap.

---

## A. Source archives evaluated

| Archive | Version | Reduction | Official? | Size | Entries | License |
| --- | --- | --- | --- | --- | --- | --- |
| `isa_BP3D_4.0_obj_99.zip` | **4.0 LATEST** | **99%** | Yes (current download page) | ~136 MB | 2,234 elemental | **CC BY 4.0** |
| `partof_BP3D_4.0_obj_99.zip` | 4.0 LATEST | 99% | Yes | ~62 MB | 1,258 | CC BY 4.0 |
| `BodyParts3D_3.0_obj_95.zip` | **3.0 historical** | **95%** | Yes (20110915 tree) | ~522 MB | organ-ID OBJs | **CC BY-SA 2.1 Japan** |
| `BodyParts3D_3.0_obj_99.zip` | 3.0 historical | 99% | Yes | ~128 MB | organ-ID OBJs | CC BY-SA 2.1 Japan |
| Rel. 1.0 / 2.0 STL/VTK 1%–10% | older | different ratio definition | Yes (historical dirs) | smaller | legacy IDs | historical CC BY-SA |

**Critical official fact:** BodyParts3D **Release 4.0 does not publish any mesh archive finer than 99%**.  
LSDB download index + `LATEST/` directory listing (verified 2026-09-07) contain only the two 99% zips.

DBCLS Release 3.0 README: *“A polygon mesh with the reduction rate of 95% is more precise than that with 99% because 95% has five times more polygons (triangles) than 99%.”*

---

## B. Current 99% source verdict

| Criterion | Verdict |
| --- | --- |
| Provenance / checksum pin | OK — `data/bodyparts3d/ARCHIVE.sha256` |
| FMA mapping (IS-A) | OK — FJ element model |
| Canonical frame compatibility | OK — `painlocator-bp3d-canonical-v1` |
| Browser performance | OK for regional packs |
| Overview recognizability | Partial — readable at body scale |
| Close-up head / hand / foot / knee | **Fail vs approved mockup** |
| Production visual north star | **Fail** |

**Do not keep optimizing this tier as the production geometry master.**

---

## C. Chosen production BP3D source

### Not available in the public 4.0 distribution.

| Desired production master | Status |
| --- | --- |
| Official BodyParts3D **4.0** mesh archive at **≤95% reduction** (or unreduced elemental OBJs) with the **same FJ / FMA tables** and **same 4.0 coordinates** | **Not published** on LSDB |
| Interim: continue shipping 99% behind feature flags for pipeline / UX testing only | Allowed as **prototype / fallback** |
| Historical 3.0 95% as production master | **Rejected** (see stop conditions) |

### What source/data change is required next

1. **Request from DBCLS / NBDC** an official **BodyParts3D 4.0 higher-detail** elemental mesh distribution (≤95% reduction or full resolution), under the current **CC BY 4.0** license, with:
   - FJ element file IDs (or an authoritative map to them)
   - Identical 4.0 coordinate system (Release 4.0 *shifted* skeletal coordinates vs 3.0)
   - SHA-256 pins publishable in `ARCHIVE.sha256`
2. Until that exists, PainLocator **must not claim** mockup-grade anatomy from BP3D.
3. Do **not** silently substitute a non-BP3D commercial atlas without an explicit product/legal decision.

---

## D. Representative structure comparison (geometry-only)

Built with identical transform `(x,y,z)_mm → (-x,z,-y)*0.001`, identical clinical materials, no extra decimation.

Artifacts:

- Report: `docs/visual-targets/bp3d-source-tier-comparison/comparison-report.json`
- Interactive page: `docs/visual-targets/bp3d-source-tier-comparison/index.html`
- GLBs: `.../glb/a-4.0-99/` vs `.../glb/b-3.0-95/`
- Screenshots: `.../screenshots/` (when generated)

| Structure | A tris (4.0 99%) | B tris (3.0 95%) | B/A |
| --- | --- | --- | --- |
| Acromial left deltoid | 1,300 | 29,076 | **22.4×** |
| Clavicular left pectoralis major | 1,846 | 9,212 | **5.0×** |
| Left scapula | 28,106 | 121,816 | **4.3×** |
| Left humerus | 3,844 | 16,492 | **4.3×** |
| Left first metacarpal | 578 | 2,480 | **4.3×** |
| Left hip bone | 2,332 | 9,470 | **4.1×** |
| Left vastus lateralis | 6,688 | 94,474 | **14.1×** |
| Left patella | 310 | 1,338 | **4.3×** |
| Left femur | 3,204 | 13,202 | **4.1×** |
| Left tibia | 1,692 | 6,822 | **4.0×** |
| Medial head left gastrocnemius | 3,842 | 65,138 | **17.0×** |
| Left calcaneus | 1,288 | 5,652 | **4.4×** |

**Median B/A ≈ 4.3×** (matches DBCLS “five times” guidance for bones; some muscles far higher).

Interpretation: the visual shortfall is **source decimation**, not Three.js materials.

---

## E–Y (condensed delivery map)

| Item | Result |
| --- | --- |
| E. Visual QA | Comparison page + GLBs + screenshots under `docs/visual-targets/bp3d-source-tier-comparison/` |
| F. FMA mapping | 4.0 IS-A tables unchanged; comparison uses official concept IDs |
| G–H. Full-body packs | **Not rebuilt from wrong tier** — existing `?fullBodyAnatomy=1` 99% packs remain prototype |
| I. Pack architecture | Keep regional lazy packs; remap when 4.0 HD lands |
| J. LOD strategy | **Canonical master = future 4.0 HD** → derive LOD0/1/2 from it. Never upsample 99%. |
| K. Exterior | Mannequin/styled silhouette = **fallback only**; production exterior must derive from canonical HD frame |
| L. Pipeline | `npm run bp3d:compare-source-tiers`; future `bp3d:build:production` gated on HD pin |
| M. Payloads | 99% full-body MSK ~35.5 MB meshopt (prototype). HD will need stricter regional LOD. |
| N–P. Materials / lighting / camera | Already clinical-oriented in Spatial; cannot rescue 99% topology |
| Q–S. Selection / markers / patient isolation | Unchanged; patient still never loads clinician packs |
| T–U. Browser / tests | Unit + integrity + comparison script; full HD browser QA blocked on source |
| V. Licensing | 4.0 = CC BY 4.0; 3.0 95% = CC BY-SA 2.1 JP — evaluation only |
| W. Limitations | No official 4.0 HD; 3.0≠4.0 coordinates; adult male only |
| X. vs approved mockup | Still prototype / atlas — **not** mockup parity |
| Y. Merge recommendation | **Draft only** — merge docs/decision + comparison tooling; **do not** cut over production anatomy |

---

## Stop conditions triggered

| Condition | Triggered? |
| --- | --- |
| Higher-detail BP3D **4.0** source cannot be verified | **YES** — not published |
| FMA mappings differ unexpectedly (3.0 vs 4.0 file model) | **YES** for using 3.0 as master |
| Higher-detail licensing unclear / ShareAlike | **YES** for 3.0 95% as product master |
| Visual quality still cannot approach approved reference on 99% | **YES** |
| Manual regional registration required to force 3.0 into 4.0 frame | Would be required — **STOP** |

---

## LOD architecture (when 4.0 HD exists)

```text
Official BP3D 4.0 high-detail OBJs  ← production master of truth
        │
        ├─ LOD2  close inspection / selected region
        ├─ LOD1  default clinician full-body
        └─ LOD0  mobile / zoomed-out / first paint
```

**Never** derive LOD2 by “enhancing” 99% meshes.

---

## Mannequin / styled exterior policy

The segmented / procedural exterior is **not** the production human representation.

Allowed roles only:

- development fallback
- Spatial boot failure fallback
- legacy compatibility

Production stack:

```text
Styled human exterior (canonical-derived)
        │
Canonical BP3D frame (painlocator-bp3d-canonical-v1)
        │
Full-body muscle / skeletal (from 4.0 HD when available)
```

---

## Checksums (evaluation)

| File | SHA-256 |
| --- | --- |
| `isa_BP3D_4.0_obj_99.zip` | `40665852c49f218326590e204db91064a1ecfc3c6f8cbd7bbbcaac62c7cd409e` (pinned) |
| `BodyParts3D_3.0_obj_95.zip` | `4b4faf3b043f54aa9e5de3cdef584381793434ddb7472855b8d9abebdee002de` (evaluation pin; not production) |

---

## Attribution

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International  
> https://dbarchive.biosciencedbc.jp/en/bodyparts3d/

Historical 3.0 evaluation assets additionally require CC BY-SA 2.1 Japan attribution when redistributed.

Citation: Mitsuhashi N, et al. *BodyParts3D: 3D structure database for anatomical concepts.* Nucleic Acids Res. 2009.
