# Changelog

All notable changes to PainLocator are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/).  
Versioning: [Semantic Versioning](https://semver.org/) for application releases; git tags (e.g. `v0.1.0`) mark foundation milestones.

## [v0.1.0] — 2026-07-07

**Initial Clinical Anatomy Engine foundation**

PainLocator transitions from prototype to platform. This release establishes the baseline architecture for future clinical development.

### Added

#### Platform & architecture

- Modular project structure under `src/engine/`, `src/features/`, `src/layout/`, `src/state/`, `src/ui/`, `src/utils/`, `src/app/`
- Clinical Anatomy Engine (CAE) as reusable infrastructure in `src/engine/`
- TypeScript checkJs foundation (`tsconfig.json`, `npm run build`)
- Anatomy assets under `public/anatomy/{model}/{view}.png`

#### Workflows

- **Capture** — quick pain logging with compact timeline
- **Review** — history, trend summary, entry compare, edit mode
- **Clinical Analysis** — full clinical tools, visualization, export, AI panel

#### Clinical features

- Region-based pain annotation (`PainEntry` + `PainRegion`)
- Tools: select, point, circle, polygon, brush, lasso, eraser
- Intensity scale (0–10) with color-mapped regions
- Symptom pills: quality, triggers, ease-after
- Clinical notes with optional speech dictation
- Recovery timeline chart (Chart.js)
- Undo/redo in `PainEntryStore`
- Patient models: adult-male, adult-female, child, teen, senior
- Body views: front, back, left, right

#### Engine (CAE)

- `ClinicalAnatomyEngine` — clinical plate rendering
- `AnatomyCoordinateMapper` — normalized coordinate mapping
- `ClinicalMarkupRenderer` — SVG pain region overlay
- `VisualizationController` — standard, heatmap, reference modes
- `ANATOMY_REGIONS` snapping and labels

#### Reporting & data

- JSON session schema v1.0.0 with import/export
- Clinical consultation report (browser print → PDF)
- PNG clinical snapshot export
- Rule-based AI pattern insights (non-diagnostic)

#### UI & theming

- Semantic theme tokens (light/dark)
- Theme-aware PainLocator branding
- Collapsible clinical documentation panel
- Resizable left/right panels
- `DEV_MODE` debug overlay (`?dev=1` only)

### Known limitations

- Child, teen, and senior models reuse adult-male plates
- Reference overlay PNGs probed but not fully shipped
- PDF export depends on browser print dialog
- AI insights are rule-based only (no ML)
- Client-only storage (localStorage); no sync

### Documentation

- Foundation `/docs` architecture and vision documentation
- [ENGINEERING_PRINCIPLES.md](./ENGINEERING_PRINCIPLES.md) — engineering constitution

---

## Unreleased

Planned work is tracked in [ROADMAP.md](./ROADMAP.md) and [AI_ROADMAP.md](./AI_ROADMAP.md).

[Unreleased]: https://github.com/mpinkney2/painlocator/compare/v0.1.0...main
[v0.1.0]: https://github.com/mpinkney2/painlocator/releases/tag/v0.1.0
