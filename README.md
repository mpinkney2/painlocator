# PainLocator

PainLocator is an interactive clinical pain mapping and recovery documentation platform powered by the **Clinical Anatomy Engine (CAE)**.

All session data stays in the browser (localStorage). No server, accounts, or network calls are required for normal use.

## Status

**v0.1.0** — Foundation Release

Establishes the baseline CAE architecture, modular project structure, and core clinical workflows for future development.

## Core Workflows

| Workflow | Purpose |
|----------|---------|
| **Capture** | Quick pain logging — mark regions, set intensity, symptoms, and notes |
| **Review** | History — timeline, trends, compare entries, edit past records |
| **Clinical Analysis** | Full clinical tools — polygon/lasso, metadata, AI insights, export |

## Features

- Interactive anatomical pain mapping
- Region-based symptom annotation
- Recovery timeline visualization
- Structured clinical documentation
- AI-assisted clinical observations (non-diagnostic)
- Physician-oriented reporting
- JSON session import/export
- Clinical snapshot and PDF report foundation
- Light/dark theme with semantic design tokens

## Documentation

Full project documentation lives in [`/docs`](./docs/):

| Document | Description |
|----------|-------------|
| [PRODUCT_VISION.md](./docs/PRODUCT_VISION.md) | Product goals, users, and design principles |
| [ROADMAP.md](./docs/ROADMAP.md) | Shipped vs planned features |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Technical structure and data model |
| [CLINICAL_ANATOMY_ENGINE.md](./docs/CLINICAL_ANATOMY_ENGINE.md) | CAE modules and boundaries |
| [UI_GUIDELINES.md](./docs/UI_GUIDELINES.md) | Theme tokens, layout, accessibility |
| [JSON_SCHEMA.md](./docs/JSON_SCHEMA.md) | Session export/import format |
| [REPORT_SPEC.md](./docs/REPORT_SPEC.md) | Clinical report and export behavior |
| [AI_ROADMAP.md](./docs/AI_ROADMAP.md) | Rule-based insights today; AI future |
| [CONTRIBUTING.md](./docs/CONTRIBUTING.md) | Development workflow and PR guidance |
| [ENGINEERING_PRINCIPLES.md](./docs/ENGINEERING_PRINCIPLES.md) | Engineering constitution and standards |
| [CHANGELOG.md](./docs/CHANGELOG.md) | Release history |

## Clinical Anatomy Engine

PainLocator is built on the **Clinical Anatomy Engine (CAE)**, a reusable subsystem for:

- Anatomy rendering
- Coordinate mapping
- Region-based annotation
- Visualization overlays
- Clinical documentation
- Reporting and export workflows

**PainLocator** is the flagship clinical application. **CAE** (`src/engine/`) is the reusable infrastructure that can support future products or a standalone package.

## Architecture

```
src/engine/          Clinical Anatomy Engine (reusable)
  anatomy/           Regions, plates, CAE core
  coordinates/       Normalized coordinate mapping
  annotations/       Pain regions, entry store, markup renderer
  overlays/          Visualization modes
  reporting/         Session schema, clinical reports, import/export

src/features/        PainLocator workflow features
  capture/           Entry logging, speech dictation
  review/            Timeline, history, compare
  clinical-analysis/ Clinical insights

src/layout/          Shell styles, theme tokens, panel resizers
src/ui/              Generic UI behaviors
src/state/           App state, workflow mode
src/types/           TypeScript definitions
src/utils/           Theme helpers, forms, dev mode
src/app/             Bootstrap / initialization

public/anatomy/      Anatomy plate assets per patient model
  adult-male/
  adult-female/
  child/
  teen/
  senior/
```

## Roadmap

See [docs/ROADMAP.md](./docs/ROADMAP.md) for shipped vs planned work. Highlights:

- Improved clinical reports
- PDF export (browser print) — [shipped foundation](./docs/REPORT_SPEC.md)
- PNG clinical snapshots — [shipped](./docs/REPORT_SPEC.md)
- Session import/export — [shipped v1.0.0](./docs/JSON_SCHEMA.md)
- Additional anatomical overlays (muscle, nerve, organ)
- Pediatric, senior, athletic, and bariatric model support
- AI-assisted recovery insights
- Physician review workflow enhancements
- Possible future CAE extraction as a standalone npm package

## Development

```bash
npm install
npm start          # serves at http://localhost:5500
npm run build      # TypeScript check (tsc --noEmit)
```

Open the app:

**http://localhost:5500/?v=5.3**

> Use a local server (`npm start` or `./start.sh`) for speech recognition and correct asset loading. Opening `index.html` directly may limit some browser APIs.

### Project scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Python static server (port 5500) |
| `npm run build` | Run TypeScript validation |
| `npm run typecheck` | Alias for build |

## Development Workflow

`main` is the stable release branch.

Future work should happen on feature branches, for example:

- `feature/workflow-ui`
- `feature/reporting-v2`
- `feature/ai-analysis`
- `feature/clinical-overlays`
- `feature/session-import-export`

Tag releases on `main` (e.g. `v0.1.0`) after review and verification. See [CONTRIBUTING.md](./docs/CONTRIBUTING.md).

## Privacy

- Pain entries are stored in `localStorage` under `painlocator_pain_entries`.
- Export/import uses JSON files you control — nothing is sent automatically.
- Use **Clear Data** in the app to wipe local storage.

## License

Private / unreleased — see repository owner for terms.
