# Clinical Report Specification

PainLocator v0.1.0 generates **consultation-style clinical reports** for printing or saving as PDF via the browser's print dialog. Implementation: `src/engine/reporting/clinical-report.js`.

## Export Paths

| Method | UI entry | Output |
|--------|----------|--------|
| Clinical Report (PDF) | Export modal / sidebar | `window.print()` → user saves as PDF |
| Clinical Snapshot (PNG) | Export modal / sidebar | PNG download of annotated current view |
| Session (JSON) | Export modal / sidebar | Portable session file ([JSON_SCHEMA.md](./JSON_SCHEMA.md)) |

There is **no server-side PDF renderer** in v0.1.0.

## Report Generation Flow

```text
buildSessionExport()  ─┐
generateInsights()    ─┼→  buildClinicalReportHtml()  →  #printReport  →  window.print()
captureAnatomyMapDataUrl() ─┘
```

`printClinicalReport()` is aliased as `printReport()`.

## Report Sections

The HTML report (`<article class="clinical-report">`) includes:

| Section | Content |
|---------|---------|
| **Header** | PainLocator branding, title, visit date |
| **Patient & Session** | Model, view, workflow, entry/region counts |
| **Annotated Anatomy** | PNG composite of current view + pain regions |
| **Pain Summary** | Average/peak intensity, quality and trigger aggregates |
| **Pain Regions** | Table: ID, patient label, clinical label, view, shape |
| **Pain Timeline** | Table: entry #, date/time, intensity, region count |
| **Clinical Notes** | Aggregated notes from all entries |
| **Entry Detail** | Per-entry breakdown (intensity, quality, triggers, regions) |
| **AI Observations** | Rule-based insights with non-diagnostic disclaimer |
| **Session Metadata** | Schema version, app/engine version, timestamps |

## Annotated Anatomy Image

`captureAnatomyMapDataUrl()`:

1. **Prefer Spatial WebGL** when `state.engine.isSpatialMode()` — snap view, force one frame, return PNG (`SpatialAnatomyRenderer.captureViewDataUrl` / `SpatialSceneController.captureFrameDataUrl`). Pain markers already in the 3D scene are included.
2. Otherwise draw the clinical **2D plate** for `model` + `view` and overlay intensity-colored regions (legacy / `?plate=1` path).
3. Returns a PNG data URL embedded in the report or downloaded as “Anatomy snapshot”.

**Note:** Spatial exports match the live body (Surface / Muscle / Skeletal). They do not yet equal the approved mockup until a higher-detail BP3D 4.0 source exists ([BODYPARTS3D_PRODUCTION_SOURCE_DECISION.md](./BODYPARTS3D_PRODUCTION_SOURCE_DECISION.md)).

**Scope:** Multi-view PDF figures call the same capture helper per view.

## AI Observations Block

Content from `generateInsights()` (`src/features/clinical-analysis/insights.js`):

- Average severity across entries
- Primary symptomatic region (frequency)
- Common functional triggers
- High-severity alert when peak intensity ≥ 8

### Required disclaimer (shipped)

Reports include explicit text that AI observations:

- Are generated from logged symptom patterns only
- **Do not constitute** a medical diagnosis, treatment plan, or clinical decision

## Print Styling

Print CSS in `src/layout/styles.css` (`@media print`):

- Hides application chrome (`.app` children except `#printReport`)
- Uses semantic tokens adapted for print (`--surface`, `--text-primary`, `--border-strong`)
- Tables: `.report-table`, `.report-table-meta`
- Page-break avoidance on `.report-section`

## Data Sources

| Report field | Source |
|--------------|--------|
| Entries, regions | `PainEntryStore.entries` (current patient model) |
| Timeline rows | `buildSessionTimeline()` |
| Notes aggregate | `buildSessionNotes()` |
| Patient model label | `formatPatientModelLabel()` |
| Metadata versions | `SESSION_SCHEMA_VERSION`, `APPLICATION_VERSION`, `ENGINE_VERSION` |

## Limitations (v0.1.0)

| Limitation | Notes |
|------------|-------|
| Browser-dependent PDF | Layout varies by browser print engine |
| Single anatomy view | No automatic front/back composite |
| No digital signature | Report is patient-exported documentation |
| Rule-based AI only | Not a clinical decision support system |

## Future Enhancements

See [ROADMAP.md](./ROADMAP.md):

- Dedicated PDF layout engine
- Multi-view anatomy appendix
- Clinician header/footer customization
- FHIR DocumentReference compatibility research

## Related Documents

- [JSON_SCHEMA.md](./JSON_SCHEMA.md)
- [AI_ROADMAP.md](./AI_ROADMAP.md)
- [UI_GUIDELINES.md](./UI_GUIDELINES.md)
- [CLINICAL_ANATOMY_ENGINE.md](./CLINICAL_ANATOMY_ENGINE.md)
