# Architecture

PainLocator v0.1.0 is a **client-only** web application: vanilla JavaScript modules loaded via script tags, no bundler at runtime. TypeScript is used for type-checking only (`npm run build`).

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      PainLocator App                         │
│  index.html  →  src/app/bootstrap.js  →  src/features/*       │
│              →  src/state/*  →  src/ui/*  →  src/utils/*     │
└──────────────────────────┬──────────────────────────────────┘
                           │ uses
┌──────────────────────────▼──────────────────────────────────┐
│              Clinical Anatomy Engine (CAE)                     │
│  src/engine/anatomy | coordinates | annotations | overlays   │
│                    | reporting                               │
└──────────────────────────┬──────────────────────────────────┘
                           │ reads
┌──────────────────────────▼──────────────────────────────────┐
│              public/anatomy/{model}/{view}.png                 │
└─────────────────────────────────────────────────────────────┘
```

## Directory Layout

| Path | Responsibility |
|------|----------------|
| `src/engine/` | **CAE** — reusable clinical anatomy infrastructure |
| `src/features/` | PainLocator workflow features (app-specific) |
| `src/layout/` | Shell CSS, theme tokens, panel resizers |
| `src/ui/` | Generic UI behaviors (context menu) |
| `src/state/` | Application state and workflow mode |
| `src/types/` | TypeScript definitions (`index.d.ts`) |
| `src/utils/` | Theme helpers, forms, dev mode |
| `src/app/` | Bootstrap and initialization |
| `public/anatomy/` | Anatomy plate assets |

### Engine (`src/engine/`)

| Module | Key files |
|--------|-----------|
| `anatomy/` | `clinical-anatomy-engine.js`, `regions.js`, `asset-paths.js`, `pain-colors.js` |
| `coordinates/` | `anatomy-coordinate-mapper.js` |
| `annotations/` | `pain-models.js`, `pain-entry-store.js`, `markup-renderer.js` |
| `overlays/` | `visualization-controller.js` |
| `reporting/` | `session-schema.js`, `session-io.js`, `clinical-report.js` |

See [CLINICAL_ANATOMY_ENGINE.md](./CLINICAL_ANATOMY_ENGINE.md).

### Features (`src/features/`)

| Folder | Responsibility |
|--------|----------------|
| `capture/` | Entry CRUD, speech dictation |
| `review/` | Timeline chart, history UI, region tools, compare |
| `clinical-analysis/` | Rule-based `generateInsights()` |

## Script Load Order

Defined in `index.html`. Engine modules load before app modules:

1. `dev-mode.js`
2. Engine: regions → pain-models → coordinate mapper → entry store → panel resizers → asset paths → pain colors → visualization → CAE core → markup renderer
3. App: theme tokens → app state → forms → features → reporting → UI → workflow → bootstrap

## Data Model

### PainEntry

A saved or draft pain log session unit. Stored in `PainEntryStore` (`src/engine/annotations/pain-entry-store.js`).

Fields include: `id`, `patientModel`, `intensity`, `quality[]`, `triggers[]`, `easesAfter[]`, `duration`, `whenOccurring`, `note`, `regions[]`, timestamps.

### PainRegion

A marked area on an anatomy view. Anchors use **normalized coordinates** (0–1) relative to the image frame.

Shapes: `circle`, `polygon` (and tools for `point`, `brush`, `lasso` via `REGION_TOOLS`).

### Persistence

| Key | Purpose |
|-----|---------|
| `painlocator_pain_entries` | Primary entry store (localStorage) |
| `painlocator_layout` | Panel widths |
| `painlocator_theme` | Light/dark preference |

Legacy keys are migrated on load (`painlocator_markers`, `painlocator_entries`).

## Workflow Modes

Controlled by `state.workflowMode` in `src/state/app-state.js` and `applyWorkflowMode()` in `src/state/workflow.js`.

| Mode | Body class | `physicianMode` | UI emphasis |
|------|------------|-----------------|-------------|
| `capture` | `wf-capture` | `false` | Compact timeline, capture tools, log form |
| `review` | `wf-review` | `false` | Large timeline, filter, compare, edit entry |
| `clinical` | `wf-clinical` | `true` | Full tools, visualization, AI, export |

CSS in `src/layout/styles.css` toggles `.show-clinical`, `.show-review`, `.show-capture-form`, etc.

## Recovery Timeline

Implemented in `src/features/review/timeline.js` using **Chart.js**:

- Line chart of intensity over time
- Click a point to select an entry
- Colors follow `PAIN_COLORS` and theme tokens

## Reporting Pipeline

```
PainEntryStore  →  buildSessionExport()     →  JSON file
                →  buildClinicalReportHtml() →  window.print() (PDF)
                →  captureAnatomyMapDataUrl() →  PNG download
```

See [JSON_SCHEMA.md](./JSON_SCHEMA.md) and [REPORT_SPEC.md](./REPORT_SPEC.md).

## Anatomy Assets

Resolved by `getAssetPath()` in `src/engine/anatomy/asset-paths.js`:

```
public/anatomy/{model}/{view}.png
```

Models: `adult-male`, `adult-female`, `child`, `teen`, `senior`.

Views: `front`, `back`, `left`, `right`.

## Dev Mode

Renderer debug overlay (Renderer / Patient / View / Asset / Status) is shown only when `DEV_MODE === true` (`?dev=1` in URL). See `src/utils/dev-mode.js`.

## Type Checking

`tsconfig.json` includes `src/**/*.js` with `allowJs`. No emit — validation only.

## Related Documents

- [CLINICAL_ANATOMY_ENGINE.md](./CLINICAL_ANATOMY_ENGINE.md)
- [JSON_SCHEMA.md](./JSON_SCHEMA.md)
- [UI_GUIDELINES.md](./UI_GUIDELINES.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
