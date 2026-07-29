# Roadmap

This document separates **shipped functionality** (v0.1.0) from **planned work**. Items are not committed to dates.

## Shipped — v0.1.0 (Foundation)

| Area | Status |
|------|--------|
| CAE modular architecture (`src/engine/`) | ✅ Shipped |
| Capture / Review / Clinical Analysis workflows | ✅ Shipped |
| Region-based `PainEntry` + `PainRegion` model | ✅ Shipped |
| Clinical anatomy PNG plates per model folder | ✅ Shipped |
| Normalized coordinate mapping | ✅ Shipped |
| Recovery timeline (Chart.js) | ✅ Shipped |
| Clinical documentation panel | ✅ Shipped |
| Rule-based AI pattern insights | ✅ Shipped |
| JSON session schema v1.0.0 + import/export | ✅ Shipped |
| Clinical report (browser print → PDF) | ✅ Shipped |
| PNG clinical snapshot export | ✅ Shipped |
| Semantic light/dark theme tokens | ✅ Shipped |
| Visualization modes: Standard, Heatmap, Reference | ✅ Shipped (reference assets probed at runtime) |

## Near Term

### Reporting v2

- Richer print layout and pagination
- Multi-view anatomy composites in reports
- Dedicated server-side PDF generation (optional; not in v0.1.0)

See [REPORT_SPEC.md](./REPORT_SPEC.md).

### Session portability

- Schema migration tooling for future `schemaVersion` bumps
- Partial session merge on import
- Validation UX improvements

See [JSON_SCHEMA.md](./JSON_SCHEMA.md).

### Clinical overlays

- ✅ Vector schematic overlays for muscle / skeleton / nerve / organ (always available in Clinical Analysis)
- ✅ Assistive dermatome / myotome / suggested / referred schematic datasets (`src/engine/overlays/overlay-datasets.js`)
- ✅ Optional SVG reference plates under `public/anatomy/overlays/` (probed at runtime; vector remains primary)
- High-fidelity atlas PNGs / diagnostic-grade plates remain future work

### Physician workflow

- ✅ Local review queue with clinical status: logged → ready for review → reviewed → signed off
- Compare sessions across dates (entry compare exists; cross-session merge still planned)
- Annotation comments per region

### EHR / FHIR handoff

- ✅ FHIR R4 **document Bundle** export (Composition + Patient + Observations) — portable handoff file, not a live EHR write API
- Live EHR write / SMART-on-FHIR sync remains long-term

## Medium Term

### Patient models

| Model | v0.1.0 | Planned |
|-------|--------|---------|
| Adult Male | ✅ Dedicated plates | — |
| Adult Female | ✅ Dedicated plates | — |
| Child | ⚠️ Reuses adult-male plates | Distinct pediatric plates |
| Teen | ⚠️ Reuses adult-male plates | Distinct teen plates |
| Senior | ⚠️ Reuses adult-male plates | Distinct senior plates |
| Athletic | UI placeholder only | New asset set |
| Bariatric | UI placeholder only | New asset set |
| Pregnancy | UI placeholder only | New asset set |

### AI and insights

- Expand rule libraries for triggers, quality, and region frequency
- Recovery trend narratives
- Optional external model integration (with explicit consent and labeling)

See [AI_ROADMAP.md](./AI_ROADMAP.md).

## Long Term

- **CAE as standalone package** — extract `src/engine/` for reuse in other clinical apps
- **Collaborative sessions** — optional sync (requires backend; out of scope for current client-only architecture)
- **Live EHR integration** — SMART-on-FHIR / write-back beyond portable document export
- **Mobile-optimized capture** — continued touch-first region tools

## How to Propose Work

Use feature branches as described in [CONTRIBUTING.md](./CONTRIBUTING.md):

- `feature/reporting-v2`
- `feature/clinical-overlays`
- `feature/ai-analysis`
- `feature/session-import-export`

## Related Documents

- [PRODUCT_VISION.md](./PRODUCT_VISION.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [AI_ROADMAP.md](./AI_ROADMAP.md)
- [CHANGELOG.md](./CHANGELOG.md)
