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

1. Draws clinical plate for current `model` + `view`
2. Overlays pain regions with intensity colors from `PAIN_COLORS`
3. Labels regions with entry region IDs (e.g. `1A`)
4. Returns a PNG data URL embedded in the report

**Scope:** Current view only in v0.1.0. Multi-view composites are planned ([ROADMAP.md](./ROADMAP.md)).

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
- Clinician header/footer customization
- Live SMART-on-FHIR write-back (beyond portable Bundle export)

### FHIR document export (current)

Clinical Analysis → Report / Export → **EHR handoff (FHIR JSON)** produces a FHIR R4 `Bundle` of type `document` with `Composition`, `Patient`, and pain `Observation` resources. This is a **portable handoff file**, not a live EHR API.

## Related Documents

- [JSON_SCHEMA.md](./JSON_SCHEMA.md)
- [AI_ROADMAP.md](./AI_ROADMAP.md)
- [UI_GUIDELINES.md](./UI_GUIDELINES.md)
- [CLINICAL_ANATOMY_ENGINE.md](./CLINICAL_ANATOMY_ENGINE.md)
