# BodyParts3D prototype pack — license & attribution

Derived from **BodyParts3D** (DBCLS), official LSDB Archive distribution.

## License

Creative Commons Attribution 4.0 International (CC BY 4.0)

https://creativecommons.org/licenses/by/4.0/

Official archive license page (authoritative; updated 2025-02-27):

https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html

## Required attribution

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International

## Citation

Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K.
BodyParts3D: 3D structure database for anatomical concepts.
Nucleic Acids Research. 2009. PMID: 18835852.

## PainLocator modifications

- Subset selection (left shoulder skeletal + muscle)
- Coordinate normalization to PainLocator meters / Y-up / +X anatomical right
- Degenerate-face cleanup only (no silent hole-filling)
- GLB packaging + Meshopt optimization
- Stable `meshId` / `FMA:` `structureId` metadata via PainLocator manifest

## Status

**Prototype only.** Not registered as the production Spatial default model.
