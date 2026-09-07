# PainLocator — Production Anatomy Vendor Compatibility Decision

**Date:** 2026-09-07  
**Branch:** `cursor/production-anatomy-vendor-decision-83c7`  
**Status:** DECISION LOCKED  
**Supersedes waiting on:** public BodyParts3D 4.0 HD (see [`BODYPARTS3D_PRODUCTION_SOURCE_DECISION.md`](./BODYPARTS3D_PRODUCTION_SOURCE_DECISION.md))  
**Approved visual target:** [`PAINLOCATOR_APPROVED_ANATOMY_VISUAL_TARGET.md`](./PAINLOCATOR_APPROVED_ANATOMY_VISUAL_TARGET.md)

---

## Final recommendation (exactly one)

# **A. SciePro is preferred production geometry candidate.**

Do **not** continue polishing BP3D 99%.  
Do **not** wait indefinitely for a public BP3D 4.0 HD release.  
Do **not** purchase or integrate vendor assets until the evidence checklist below is closed.

### Evidence still required before purchase / license

1. **Evaluation sample** for the representative proof set (OBJ/FBX/glTF) under NDA/pilot terms.
2. Written confirmation that a **Realtime** or **Multi-Purpose** license covers PainLocator as a commercial web SaaS (multi-platform, multi-title if needed).
3. Written confirmation that PainLocator may convert to **optimized GLB + meshopt**, provided delivery is **Compiled Form** (encrypted/custom packaging — not raw public `.glb` URLs).
4. Vendor **coordinate system, units, origin, and landmark positions** sufficient for one global conformer into `painlocator-bp3d-canonical-v1`.
5. Export of **structure names / IDs + laterality** for the proof set; confirm Terminologia Anatomica ↔ FMA mapping assistance (or provide TA codes).
6. Real-time **LOD triangle budgets** for full-body Muscle / Skeletal WebGL.
7. Firm quote: Realtime (or Multi-Purpose) **adult male MSK** (± full systems, ± female).

Until those are confirmed, SciePro remains the **preferred candidate**, not a signed geometry vendor.

---

## Why not B / C / D

| Option | Rejected because |
| --- | --- |
| **B. Zygote** | Comparable visual pedigree, but realtime licenses are typically **royalty/subscription**, pricing is opaque, and offline evaluation samples are harder (GoToMeeting demos). Higher long-term cost/lock-in vs SciePro’s published one-time Realtime path. |
| **C. BioDigital SDK** | Fastest visual time-to-market and native FMA API IDs, but **does not own geometry or canonical coordinates**. Conflicts with CAE reuse, Spatial GLB packs, offline capture/reports, and PainLocator differentiation. |
| **D. Remain BP3D-only / wait for HD** | PR #19 proved public 4.0 HD **does not exist**. Waiting indefinitely was ruled out by this pass. |

**Not pursued as primary commercial geometry:** Z-Anatomy, Open Anatomy Project, historical BP3D 3.0 95%.

---

## Architecture to preserve

PainLocator durable identity remains CAE-owned:

```text
FMA structureId          e.g. FMA:34683
clinicalName
laterality               left | right | midline
layer                    surface | muscle | skeletal | …
region
coordinateFrameVersion   painlocator-bp3d-canonical-v1
canonicalBodyXYZ         runtime only (no persisted schema expansion in this pass)
```

Vendor mesh UUIDs / product IDs are **adapters only**.

```text
vendor structure
   → PainLocator vendor-map (build-time)
   → FMA structureId
   → painlocator-bp3d-canonical-v1
```

BodyParts3D remains the **semantic / FMA backbone and registration reference**, even when visual meshes come from SciePro.

---

## A. Candidate comparison

| Dimension | BP3D 4.0 99% | **SciePro** | Zygote | BioDigital |
| --- | --- | --- | --- | --- |
| Visual realism vs approved mockup | Fail | **Best public match** | Excellent | Excellent (hosted) |
| Full-body completeness | MSK curated OK | **3,600+ structures claimed** | Full multi-system collection | Full product library |
| Male / female | Male only | **Male + female (+ child)** | Male + female | Male + female |
| Muscle / skeletal | Yes (99%) | Yes | Yes | Yes |
| Nervous / organs | Not in current PL packs | Yes (licenseable) | Yes | Yes |
| Structure identity | Native FMA | TA labels → map to FMA | Named groups → map to FMA | Native FMA in API |
| FMA compatibility | Native | **HIGH-CONFIDENCE mapping** | HIGH-CONFIDENCE (precedent) | Native API |
| Canonical registration | Already in frame | **Likely** (global conformer TBD on sample) | Likely (TBD on sample) | **Weak** (vendor camera/scene) |
| WebGL suitability | Proven | **Explicit Realtime/WebGL license** | Realtime license exists | Embed/SDK |
| Runtime payload strategy | Regional GLB + meshopt | Same pattern + Compiled Form | Same + anti-extraction | Vendor CDN/SDK |
| Commercial licensing | CC BY 4.0 | **Realtime one-time (published tiers)** | Quote + often royalties | Recurring plans |
| Asset ownership/control | High | High (licensed files) | High (licensed files) | Low |
| Vendor lock-in | Low | Medium | Medium–high (royalties/SDK) | **High** |
| Implementation effort | Done (prototype) | Medium (map + pack + secure deliver) | Medium–high | Lower embed, high CAE rewrite risk |
| Long-term cost/risk | Free but visual fail | CapEx ~€30k–50k+ | Uncertain OpEx | Recurring + lock-in |

Public SciePro list prices (starting at): **€29,900** single (male or female); **€49,900** full collection (male + female). Exact Realtime SKU must be confirmed with sales.

---

## B. Compatibility architecture (vendor-neutral)

### Proposed build-time / runtime manifest fields

*(Design only — **no persisted session schema change**.)*

```json
{
  "anatomyVendor": "sciepro",
  "vendorModelVersion": "SP-ONE-male-<version>",
  "vendorStructureId": "vendor-native-id-or-path",
  "fmaStructureId": "FMA:34683",
  "clinicalName": "Acromial part of left deltoid",
  "laterality": "left",
  "layer": "muscle",
  "region": "shoulder-left",
  "canonicalRegistrationVersion": "painlocator-bp3d-canonical-v1",
  "vendorMapVersion": "sciepro-to-fma-v0",
  "mappingConfidence": "HIGH-CONFIDENCE",
  "sourceRepresentationId": null
}
```

Renderer / clinician selection UI consume **PainLocator-normalized** metadata (`fmaStructureId`, `clinicalName`, `laterality`, `layer`), never raw vendor taxonomy.

### Registration rule

Allowed: **one model-level** uniform scale + rotation + translation from a documented anatomical landmark set (vertex/head, shoulders, humeral heads, elbows, hips, knees, ankles, body center).

Not allowed: per-region patches, shoulder hacks, limb-specific offsets.

If a global conformer cannot register the vendor body to `painlocator-bp3d-canonical-v1` within clinical landmark tolerances, that vendor is **incompatible** with the current CAE architecture.

---

## C. FMA mapping effort (representative proof set)

SciePro publishes **Terminologia Anatomica**-aligned English labels, **not** native FMA IDs. Mapping is therefore adapter work.

Confidence scale: `EXACT` | `HIGH-CONFIDENCE` | `MANUAL-REVIEW` | `NO-MATCH`

| Region | PainLocator target FMA | Layer | Expected vendor label family | Confidence (pre-sample) |
| --- | --- | --- | --- | --- |
| Skull | `FMA:46565` (skull) / cranial bones as needed | skeletal | Skull / cranium parts | HIGH-CONFIDENCE → MANUAL-REVIEW for compounds |
| Deltoid (L) | `FMA:34683` acromial part of left deltoid | muscle | Deltoid (parts) | HIGH-CONFIDENCE |
| Scapula (L) | `FMA:13396` left scapula | skeletal | Left scapula | HIGH-CONFIDENCE |
| Humerus (L) | `FMA:23131` left humerus | skeletal | Left humerus | HIGH-CONFIDENCE |
| Pectoralis major (L) | `FMA:34691` clavicular part of left pectoralis major | muscle | Pectoralis major (parts) | HIGH-CONFIDENCE |
| Pelvis / hip (L) | `FMA:16587` left hip bone | skeletal | Left hip bone / os coxae | HIGH-CONFIDENCE |
| Quadriceps (L) | `FMA:38931` left vastus lateralis (+ siblings) | muscle | Vastus / quadriceps group | HIGH-CONFIDENCE |
| Patella (L) | `FMA:24487` left patella | skeletal | Left patella | HIGH-CONFIDENCE |
| Tibia (L) | `FMA:24478` left tibia | skeletal | Left tibia | HIGH-CONFIDENCE |
| Foot (L) | `FMA:24498` left calcaneus (+ metatarsals as needed) | skeletal | Calcaneus / foot bones | HIGH-CONFIDENCE |

**No structure is `EXACT` until the vendor sample’s native IDs are in hand.**  
Academic precedent: Zygote internal names were manually mapped to FMA (~693 meshes) in prior research — same class of effort expected for SciePro TA labels.

Estimated mapping effort for full MSK clinician set: **days–low weeks** for HIGH-CONFIDENCE bulk map + clinician MANUAL-REVIEW queue for compounds/parts.

---

## D. Canonical registration feasibility

| Vendor | Feasibility | Notes |
| --- | --- | --- |
| SciePro | **Conditionally compatible** | Full-body male built as one coherent model → expect one global TRS. Must validate landmarks on sample. |
| Zygote | Conditionally compatible | Same: systems share proportion; CT-based skeleton foundation. Must validate on sample. |
| BioDigital | **Poor fit** | Scene/camera owned by embed; PainLocator would not own mesh-space registration for CAE markers/exports. |
| BP3D 99% | Compatible but visual fail | Already in `painlocator-bp3d-canonical-v1`. |

**Gate:** run landmark residual report (mean/max mm) after global conformer; reject regional patches.

---

## E. Licensing risk

### SciePro (public facts)

| Fact | Source |
| --- | --- |
| Realtime license covers WebGL / Unity / Unreal interactive apps | sciepro.com licensing terms + library T&Cs |
| Must ship **Compiled Form** with **anti-extraction** (no raw `.obj/.fbx/.glb/.gltf` on public URLs) | library.sciepro.com terms §6.3 |
| Modification of meshes/textures allowed under Realtime | FAQ + Realtime description |
| Attribution not generally required for 3D Realtime (encouraged academically) | T&Cs §8 |
| Medical accuracy disclaimer — licensee verifies clinical fitness | T&Cs medical accuracy clause |
| Starting prices published (€29.9k / €49.9k) | sciepro.com/pricing |
| Formats: FBX, OBJ, DCC projects; textures TIFF/EXR/JPG | licensing-terms FAQ |

**Must confirm with vendor (not assumed):** SaaS multi-tenant hosting, Vercel CDN packaging strategy, whether meshopt GLB inside encrypted bundles is accepted, pathology/skin variants, update/upgrade fees.

### Zygote (public facts)

| Fact | Source |
| --- | --- |
| Male+female multi-system collection; ~9.9M tris (collection listing) | zygote.com product page |
| OBJ / Maya / Max / C4D / Blender; grouping; UVs; optional textures | product page |
| Real-time software licenses **generally royalties or subscriptions** + anti-extraction | zygote.com/help FAQ |
| Pre-purchase evaluation typically remote demo, not file drop | FAQ |
| Price: speak to sales | product page |

### BioDigital (public facts)

| Fact | Source |
| --- | --- |
| Viewer API / Content API / mobile SDKs | biodigital.com developer toolkits |
| FMA IDs supported in scene show/select APIs | human-api docs |
| Business/school plans required for embed/API | pricing.biodigital.com |
| Geometry remains platform-hosted | product model |

---

## F. Vendor lock-in assessment

| Vendor | Lock-in | Exit path |
| --- | --- | --- |
| SciePro | Medium | Own optimized packs + FMA map; swap visual vendor later if map preserved |
| Zygote | Medium–high | Same map pattern, but royalty contracts harden lock-in |
| BioDigital | High | Rebuild Spatial/CAE path; lose offline GLBs |
| BP3D | Low | Already open CC BY — visual inadequate |

PainLocator reduces lock-in by keeping **FMA + canonical frame** as the durable layer.

---

## G. Cost / ownership considerations

| Path | Rough public cost signal | Ownership |
| --- | --- | --- |
| SciePro Realtime male | from ~€29,900 (+ Realtime tier confirmation) | Licensed files; PainLocator controls runtime packs |
| SciePro male+female | from ~€49,900 | Same |
| Zygote realtime | Opaque; often ongoing royalties | Licensed files + ongoing fees |
| BioDigital | Recurring business plan | Embed only |
| BP3D 99% | Free | Own packs — wrong visual tier |

Prefer **one-time geometry CapEx** (SciePro) over royalty OpEx for a clinical SaaS with CAE reuse across future apps.

---

## H. Representative proof plan

1. Send outreach (Section I) to **SciePro first**, Zygote second (backup).
2. Under NDA/pilot, obtain proof-set meshes + naming table + coordinate notes.
3. Build throwaway adapter:
   - vendor → FMA map CSV (confidence column)
   - global landmark conformer → `painlocator-bp3d-canonical-v1`
   - side-by-side GLB with BP3D 99% + approved mockup screenshots
4. Accept SciePro only if:
   - visual QA passes mockup bar at overview + head/hand/knee/foot
   - global registration residuals acceptable
   - Realtime Compiled Form workable with CAE Spatial loader
5. Only then negotiate purchase. **No automatic integration in this pass.**

---

## I. Exact vendor outreach questions

### Shared technical sample request (SciePro + Zygote)

**Subject:** PainLocator — evaluation sample request (WebGL clinical anatomy SaaS)

We are evaluating production anatomy geometry for PainLocator, a clinical pain-mapping application built on our Clinical Anatomy Engine (CAE). BodyParts3D remains our FMA semantic backbone; we need higher-fidelity visual meshes registered into our canonical body frame.

Please provide a **pilot/evaluation license** and representative geometry for:

| Structure | Laterality |
| --- | --- |
| Skull / cranial vault | midline |
| Deltoid (preferably partitioned) | left |
| Scapula | left |
| Humerus | left |
| Pectoralis major (preferably partitioned) | left |
| Pelvis / hip bone | left |
| Quadriceps (vastus lateralis minimum) | left |
| Patella | left |
| Tibia | left |
| Foot (calcaneus + one metatarsal) | left |

**Please answer:**

1. Available formats: OBJ / FBX / glTF / glTF-Binary? Native DCC project?
2. Per-structure **vertex and triangle counts** (and any realtime LOD variants).
3. **Coordinate system**: units, up-axis, facing axis, origin location.
4. Naming hierarchy and **stable structure IDs** (export a CSV/JSON of id → English name → laterality → system).
5. Materials/textures: maps included? PBR channels? License to downsample?
6. LOD strategy for full-body interactive WebGL.
7. Male/female models: shared landmark alignment strategy?
8. **WebGL / browser redistribution terms** for a multi-user SaaS (compiled/encrypted delivery OK?).
9. Anti-extraction / secure delivery requirements (may we convert to meshopt GLB inside encrypted bundles?).
10. Permission to retain an **internal FMA mapping table** (vendor id → `FMA:*`) as our durable ID?
11. Can we run offline landmark registration to an external canonical frame?
12. Pilot/evaluation license duration, fee, and NDA process.
13. Ballpark quote for Realtime (or equivalent) license: adult male musculoskeletal (± full systems, ± female).

Contacts: SciePro `contact@sciepro.com` · Zygote sales via zygote.com (+1 801 765-4141).

### BioDigital (only if revisiting option C)

Confirm: offline Spatial capture for PDF/PNG, custom surface-attached pain markers in engine-owned coordinates, FMA completeness for MSK selection, Enterprise pricing, and whether raw mesh export is ever available (expected: no).

---

## J. Final recommendation

**A — SciePro preferred production geometry candidate.**

Preserve BP3D/FMA as semantic backbone. Treat SciePro meshes as the visual layer behind a vendor-neutral FMA map and a single global canonical registration. Keep Zygote as backup quote. Reject BioDigital as primary for CAE ownership reasons. Do not expand BP3D 99% further.

---

## K. Next implementation step

1. **Human:** send Section I outreach to SciePro (and Zygote backup).  
2. **Engineering (after sample lands):** implement **build-time-only** `vendor-map` + global conformer prototype under `tools/anatomy-vendor/` (no session schema change).  
3. Visual QA vs approved mockups; registration residual report.  
4. If gates pass → license negotiation → production pack pipeline mirroring current regional GLB architecture with Compiled Form delivery.  
5. Keep `?fullBodyAnatomy=1` BP3D 99% as prototype fallback until cutover.

---

## Appendix — vendor abstraction sketch (non-persisted)

```text
public/anatomy/spatial/
  vendor/
    sciepro/
      manifest.json          # anatomyVendor, vendorModelVersion, packs[]
      maps/sciepro-to-fma-v0.json
      registration/sciepro-to-canonical-v1.json   # single TRS + landmarks
      packs/...glb           # FMA-normalized mesh names preferred
```

Runtime selection events emit `fmaStructureId` + clinical metadata only.

---

## Attribution / sources (public pages consulted 2026-09-07)

- https://www.sciepro.com/faq  
- https://www.sciepro.com/licensing-terms  
- https://www.sciepro.com/pricing  
- https://www.sciepro.com/model-male  
- https://library.sciepro.com/en/terms-conditions  
- https://www.zygote.com/help  
- https://www.zygote.com/poly-models/3d-human-collections/3d-male-female-anatomy-collection  
- https://www.biodigital.com/product/developer-toolkits  
- https://pricing.biodigital.com/business.html  
- https://human-api.biodigital.com/docs/ (FMA object APIs)  
- Prior academic Zygote↔FMA mapping precedent (AMIA 2006 Biolucida/Zygote note)

This document records engineering/product evaluation facts. It is not a legal opinion or purchase authorization.
