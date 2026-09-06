# PainLocator BP3D Full-Body Canonical Prototype — License

## Status

**Offline architecture prototype only.** Not wired into Patient or Clinician runtime.

## Upstream source

Derived from **BodyParts3D 4.0** element `FJ2810` (concept **FMA7163** / representation **BP9115**, English name *skin*), from the official DBCLS LSDB archive pack `isa_BP3D_4.0_obj_99.zip`.

- Publisher: Database Center for Life Science (DBCLS), ROIS
- License: **Creative Commons Attribution 4.0 International (CC BY 4.0)**
- License page: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
- Verified for PainLocator: 2026-09-06 (see `docs/BODYPARTS3D_SOURCE_PROVENANCE.md`)

## Required attribution

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International  
> https://dbarchive.biosciencedbc.jp/en/bodyparts3d/

Also cite: Mitsuhashi N, et al. *BodyParts3D: 3D structure database for anatomical concepts.* Nucleic Acids Res. 2009; PMID: 18835852.

## PainLocator modifications

- Coordinate remap to PainLocator canonical meters Y-up (+X anatomical right, +Z anterior): `(-x_mm, z_mm, -y_mm) * 0.001`
- Meshopt compression / optional LOD simplification for prototype payloads
- Manifest + validation metadata authored by PainLocator

## Redistribution

Redistributable with PainLocator when this attribution and provenance are retained.
