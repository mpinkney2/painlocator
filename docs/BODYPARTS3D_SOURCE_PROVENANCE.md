# BodyParts3D — Source Provenance (PainLocator Phase 2 Slice 2)

**Status:** verified for offline ingestion prototype (not production runtime wiring)  
**Verified:** 2026-09-06  
**Canonical product name:** BodyParts3D / Anatomography (DBCLS)

PainLocator uses the official **DBCLS LSDB Archive** distribution. Do **not** pin third-party mirrors when the official archive is available.

---

## Canonical source

| Field | Value |
| --- | --- |
| Database | BodyParts3D |
| Publisher | Database Center for Life Science (DBCLS), ROIS |
| Archive portal | https://dbarchive.biosciencedbc.jp/en/bodyparts3d/ |
| Download index | https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html |
| License page | https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html |
| Data root (pin) | https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/ |
| NBDC ID | nbdc00837 |
| DOI | 10.18908/lsdba.nbdc00837-000 |
| Citation | Mitsuhashi N, et al. *BodyParts3D: 3D structure database for anatomical concepts.* Nucleic Acids Res. 2009; PMID: 18835852 |

---

## Version / archive identifier

| Field | Value |
| --- | --- |
| Mesh release | **BodyParts3D 4.0** |
| Polygon pack used | `isa_BP3D_4.0_obj_99.zip` (IS-A tree, **99% polygon reduction**) |
| Archive directory stamp | LATEST listing last-modified **2013-05-22** for mesh zip; README/license updated **2025-02-27** |
| Mapping tables | `isa_parts_list_e.txt`, `isa_element_parts.txt` (same LATEST tree) |
| PainLocator pin label | `bodyparts3d-4.0-isa-obj99` |

**Why 99% pack:** still clinically usable elemental meshes, much smaller than unreduced OBJs, appropriate for a reproducible prototype before higher-fidelity packs.

---

## License (current)

| Field | Value |
| --- | --- |
| License | **Creative Commons Attribution 4.0 International (CC BY 4.0)** |
| License page updated | **2025-02-27** |
| ShareAlike | **No** on the official LATEST license page |
| Commercial use | Permitted under CC BY 4.0 with attribution |
| PainLocator decision | Redistributable in product builds **when attribution + provenance are retained** |

### Required attribution text

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International  
> https://dbarchive.biosciencedbc.jp/en/bodyparts3d/

Also cite Mitsuhashi et al. (2009) in documentation and LICENSE files shipped beside derived GLBs.

### Historical header vs current archive license

The embedded OBJ headers reflect historical licensing text (CC BY-SA 2.1 Japan). PainLocator's use of this archive is based on the current official DBCLS archive license page, verified on **2026-09-06** (CC BY 4.0):

https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html

Derived-asset LICENSE files cite CC BY 4.0 and retain archive URL, license URL, verification date, attribution, citation, and source checksums. Commercial release should retain contemporaneous license evidence in product compliance records. This note records provenance facts; it is not a legal determination or legal advice.

---

## Source formats

| Artifact | Format | Role |
| --- | --- | --- |
| Element meshes | Wavefront OBJ (`FJ####.obj` / `FJ####M.obj`) | Geometry |
| Concept ↔ representation map | TSV `isa_parts_list_e.txt` | `concept id` (FMA) ↔ `representation id` (BP…) ↔ English name |
| Concept ↔ element file map | TSV `isa_element_parts.txt` | `concept id` ↔ one or more `element file id` (FJ…) |
| Inclusion / compound tables | TSV (IS-A / PART-OF) | Hierarchy (not required for Slice 2 prototype) |

### ID model (do not invent IDs)

```text
FMA concept id          e.g. FMA23131  →  PainLocator structureId = FMA:23131
representation id       e.g. BP9191
element file id         e.g. FJ3262     →  source OBJ basename
```

English names in the IS-A parts list are preferred FMA names assigned by BodyParts3D.

---

## Source file inventory (pinned)

### Committed in git

| Path | Purpose |
| --- | --- |
| `data/bodyparts3d/ARCHIVE.sha256` | SHA-256 pins for zip + mapping tables |
| `data/bodyparts3d/subset/left-shoulder/source-manifest.json` | Curated subset + FMA ids + per-OBJ checksums |
| `data/bodyparts3d/subset/left-shoulder/obj.sha256` | Per-OBJ checksum list |
| `data/bodyparts3d/subset/left-shoulder/fma-verification.json` | Generated FMA verification table |
| `public/anatomy/spatial/prototype-bp3d/{skeletal,muscle}.glb` | Optimized layer packs |
| `public/anatomy/spatial/prototype-bp3d/manifest.json` | PainLocator prototype manifest |
| `public/anatomy/spatial/prototype-bp3d/LICENSE.md` | CC BY 4.0 attribution |
| `public/anatomy/spatial/prototype-bp3d/build-report.json` | Build/validation report |
| `public/anatomy/spatial/prototype-bp3d/orientation-check.json` | Orientation validation summary |

### Fetched / regenerated locally (not committed)

| Path | Purpose |
| --- | --- |
| `data/bodyparts3d/cache/isa_BP3D_4.0_obj_99.zip` | Official archive (~136 MB) |
| `data/bodyparts3d/cache/isa_*.txt` | Official mapping tables |
| `data/bodyparts3d/cache/subset/left-shoulder/obj/*.obj` | Extracted subset OBJs |
| `public/anatomy/spatial/prototype-bp3d/raw-pre-meshopt/` | Pre-meshopt GLBs |

```bash
npm run bp3d:fetch   # download + checksum + extract subset only
npm run bp3d:build   # full clean rebuild
```

---

## Checksum strategy

1. Pin `isa_BP3D_4.0_obj_99.zip` by SHA-256 in `ARCHIVE.sha256`.
2. Pin mapping TSV checksums in the same file.
3. After extract, verify each subset OBJ against `obj.sha256`.
4. Pipeline refuses to emit GLBs if checksums mismatch (unless `--skip-checksum` for local experiments).
5. Derived GLB + PainLocator manifest get their own SHA-256 recorded in the build report.

---

## Coordinate system (source)

BodyParts3D OBJ headers report bounds in **millimeters**. Empirical left-humerus bounds:

- Units: **mm**
- Up axis: **+Z** (cranial)
- Laterality: **+X toward anatomical left** (left humerus has X≈140–241)
- Right-handed

PainLocator canonical space (documented in `tools/bp3d-ingest/README.md`):

- Units: **meters**
- Up: **+Y**
- Facing: **+Z toward viewer (anterior)** after remapping
- Laterality: **+X toward anatomical right** (matches interim adult-male exterior)

Transform applied by the ingest pipeline (no unexplained constants beyond this documented remap):

```text
(x_mm, y_mm, z_mm)_BP3D
  → scale 0.001
  → (x_m, y_m, z_m) = (-x_mm, z_mm, -y_mm) * 0.001
```

---

## Known limitations

- Adult **male** only in BodyParts3D 4.0.
- 99% reduction pack is already decimated; further Meshopt compression is preferred over aggressive re-decimation.
- Compound FMA concepts may map to **multiple** FJ element files; Slice 2 selects elemental left-shoulder concepts with 1:1 FJ files.
- Stale license headers inside OBJ files (see above).
- Not a diagnostic atlas; anatomical context only.
- Full-body ingest of ~2k meshes is explicitly out of scope for this slice.

---

## What this slice does / does not do

| Does | Does not |
| --- | --- |
| Offline reproducible ingest for a left-shoulder subset | Replace `adult-male/exterior-lod0.glb` |
| Emit prototype skeletal + muscle GLBs + manifest | Wire layers into the production viewer |
| Preserve FMA structure IDs from official tables | Invent FMA IDs or browse an atlas UI |
| Record provenance + CC BY 4.0 attribution | Ship unclear-license mirrors |
