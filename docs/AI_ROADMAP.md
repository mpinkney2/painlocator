# AI Roadmap

PainLocator v0.1.0 includes **rule-based pattern analysis** — not machine learning, not diagnostic AI, and no external model API calls.

Implementation: `src/features/clinical-analysis/insights.js` → `generateInsights()`

## What Exists Today

### Rule-based insights

When entries exist for the current patient model, `generateInsights()` produces:

| Output | Logic |
|--------|--------|
| Average severity | Mean intensity across entries |
| Region frequency | Most common `patientLabel` / `physicianLabel` via `getRegionDisplay()` |
| Trigger frequency | Most common trigger tag |
| High severity alert | Fires when any entry `intensity >= 8` |

### UI surfaces

| Surface | Workflow |
|---------|----------|
| AI Clinical Insight accordion | Clinical Analysis |
| Pattern Analysis modal | Header **AI Analysis** button |
| Clinical report AI section | Export Clinical Report (PDF) |

All surfaces label observations as **non-diagnostic**.

### Visualization AI toggles (foundation)

`VisualizationController` exposes toggles for:

- Suggested structures
- Referred pain zones
- Dermatomes (nerve root)
- Myotomes (muscle chains)

These are **UI and state hooks** in `src/engine/overlays/visualization-controller.js`. Full anatomical datasets and rendering for these overlays are **not shipped** in v0.1.0.

## What Does Not Exist Today

- No LLM or cloud inference
- No training data pipeline
- No automated diagnosis or treatment recommendations
- No predictive recovery modeling
- No natural-language report generation beyond template HTML

## Design Principles for Future AI

1. **Transparency** — show which rules or models produced each observation
2. **Non-diagnostic** — never imply diagnosis; suitable for patient-reported data only
3. **On-device first** — prefer local inference for privacy
4. **Opt-in** — explicit consent before any external API
5. **Clinician override** — future physician workflow must allow dismiss/annotate AI suggestions

## Near-Term Roadmap

### Expanded rule library

- Trend detection (increasing/decreasing intensity over timeline)
- Co-occurrence of triggers and regions
- Duration and time-of-day patterns
- Compare mode insights in Review workflow

### Recovery narratives

Template-based summaries, e.g.:

> "Over the last 7 days, average intensity decreased from 7 to 4, with fewer knee regions marked."

Still rule-generated — not generative ML unless explicitly added later.

### Structure suggestions

When AI overlay toggle `suggested` is enabled, highlight anatomical regions that match frequent pain anchors using `ANATOMY_REGIONS` snapping data.

## Medium-Term Roadmap

### Optional external models

- Summarize entry notes for clinician preview (with redaction controls)
- Classify free-text notes into quality/trigger tags (assistive, not authoritative)

Requires privacy review and user consent — out of scope for v0.1.0.

### Recovery insights dashboard

- Week-over-week intensity bands
- Region heat accumulation across sessions
- Export insights block in JSON session schema (future field)

## Long-Term Roadmap

- On-device small models for offline clinics
- Integration with CAE overlay layers (dermatomes, referred pain fields)
- Physician feedback loop to improve rule weights (still not autonomous diagnosis)

## Related Code

| File | Role |
|------|------|
| `src/features/clinical-analysis/insights.js` | `generateInsights()`, `updateInsights()` |
| `src/engine/reporting/clinical-report.js` | Embeds insights in printable report |
| `src/engine/overlays/visualization-controller.js` | AI overlay toggle state |

## Related Documents

- [REPORT_SPEC.md](./REPORT_SPEC.md)
- [ROADMAP.md](./ROADMAP.md)
- [PRODUCT_VISION.md](./PRODUCT_VISION.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
