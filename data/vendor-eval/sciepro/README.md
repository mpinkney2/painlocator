# SciePro evaluation drop folder

Place NDA/pilot SciePro sample files here (not committed):

```text
data/vendor-eval/sciepro/
  source/           # vendor OBJ/FBX/glTF as received
  landmarks.json    # vendor landmark meters (required ids — see harness docs)
  metadata.json     # optional structure id export from vendor
  derived/          # local conversions only (still gitignored)
```

Fill `data/anatomy-vendor/sciepro-to-fma-v0.template.json` → copy to
`data/vendor-eval/sciepro/sciepro-to-fma-v0.json` and set real `vendorStructureId`s.

Never invent SciePro IDs.
