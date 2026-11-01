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

- Ship reference overlay PNG assets under `public/anatomy/overlays/`
- Muscle, skeleton, nerve, and organ plates per view
- Overlay availability surfaced in Clinical Analysis visualization panel

Infrastructure exists in `src/engine/overlays/visualization-controller.js`; assets are not fully populated.

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

### Physician workflow

- Review queue and sign-off states
- Compare sessions across dates
- Annotation comments per region

## Production path (Clinic Map → Chart Complement → Service Line)

Commercial and engineering sequencing for clinic/hospital adoption lives in:

- [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) — build gates (tenancy, audit, chart-grade PDF, EHR complement)
- [BUSINESS_AND_GTM.md](./BUSINESS_AND_GTM.md) — Grok commercialization mandate (beachhead clinics first; hospitals later)

Do **not** treat health-system Epic/MyChart partnership pitches as near-term engineering work until paid-pilot gates are green and design-partner clinics are filing PDFs under a BAA.

### Near-term production slices (ordered)

| Slice | Focus |
|-------|--------|
| S0 | Demo hardening, claim fence, multi-view report design |
| S1 | Auth + visit links + server session store (Clinic Map) |
| S2 | Audit, wipe, delete/export, encryption at rest |
| S3 | Chart-grade multi-view PDF + clinic branding |
| S4 | Clinician review state + portable FHIR document export |
| S5–S7 | Admin/ops → PDF filing SOP → SMART/DocumentReference only after references |

## Long Term

- **CAE as standalone package** — extract `src/engine/` for reuse in other clinical apps
- **Collaborative sessions** — optional sync (requires backend; out of scope for current client-only architecture)
- **EHR integration** — FHIR or PDF handoff patterns (after Clinic Map production gates)
- **Mobile-optimized capture** — touch-first region tools

## How to Propose Work

Use feature branches as described in [CONTRIBUTING.md](./CONTRIBUTING.md):

- `feature/reporting-v2`
- `feature/clinical-overlays`
- `feature/ai-analysis`
- `feature/session-import-export`
- `feature/clinic-map-tenancy`
- `feature/chart-complement-fhir`

## Related Documents

- [PRODUCT_VISION.md](./PRODUCT_VISION.md)
- [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)
- [BUSINESS_AND_GTM.md](./BUSINESS_AND_GTM.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [AI_ROADMAP.md](./AI_ROADMAP.md)
- [CHANGELOG.md](./CHANGELOG.md)
