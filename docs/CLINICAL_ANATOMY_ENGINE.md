# Clinical Anatomy Engine (CAE)

The **Clinical Anatomy Engine** is the reusable subsystem that powers anatomical rendering, coordinate mapping, pain region annotation, visualization overlays, and reporting primitives in PainLocator.

**PainLocator** is the flagship application built on CAE. **CAE** lives under `src/engine/` and is designed for eventual extraction into a standalone library (not yet published).

## Responsibilities

| Capability | Module | Description |
|------------|--------|-------------|
| Anatomy rendering | `anatomy/clinical-anatomy-engine.js` | Clinical plate display, viewport, renderer modes |
| Region definitions | `anatomy/regions.js` | `ANATOMY_REGIONS`, snapping, labels |
| Asset resolution | `anatomy/asset-paths.js` | `getAssetPath(model, view)` |
| Intensity colors | `anatomy/pain-colors.js` | `PAIN_COLORS` scale (0–10) |
| Coordinate mapping | `coordinates/anatomy-coordinate-mapper.js` | Client ↔ normalized (0–1) space |
| Data models | `annotations/pain-models.js` | `PainEntry`, `PainRegion` factories |
| Entry store | `annotations/pain-entry-store.js` | CRUD, undo/redo, localStorage |
| Markup rendering | `annotations/markup-renderer.js` | SVG region layers, interaction |
| Visualization | `overlays/visualization-controller.js` | Standard / heatmap / reference modes |
| Reporting | `reporting/*` | Session schema, export, clinical report HTML |

## ClinicalAnatomyEngine

Primary class: `ClinicalAnatomyEngine` (`src/engine/anatomy/clinical-anatomy-engine.js`).

### Configuration (constructor)

| Option | Default | Notes |
|--------|---------|-------|
| `modelType` | `"male"` | Maps to `adult-male` / `adult-female` via normalization |
| `viewType` | `"front"` | `front`, `back`, `left`, `right` |
| `rendererMode` | `"clinical"` | Clinical PNG plates vs prototype SVG |
| `physicianMode` | `false` | Clinical labels and advanced UI |
| `painStyle` | `"heatmap"` | Pin/region visual style |
| `markerStore` | — | `PainEntryStore` instance |
| `activeLayers` | skin only | Layer toggles (prototype mode) |
| `accessibility` | — | Contrast, colorblind, large targets |

### Events

The engine emits region/marker lifecycle events consumed by `src/app/bootstrap.js`:

- `regionplaced`, `regionselected`, `regionchanged`
- Legacy aliases: `markerplaced`, `markerselected`, `markermoved`

## Coordinate System

`AnatomyCoordinateMapper` maps pointer events to normalized coordinates:

- Origin: top-left of the anatomy image frame
- Range: `x` and `y` in `[0, 1]`
- Independent of display size (responsive)

Pain regions store `anchors[]` in this space. Reports and exports preserve four decimal places.

## Pain Region Model

Defined in `src/engine/annotations/pain-models.js`.

```text
PainRegion
├── id, entryId, view
├── patientLabel, physicianLabel
├── anatomyLayer, structureId, structureLabel
├── shape (circle | polygon | …)
├── anchors[{ x, y }]
├── radius, radiusY, opacity
└── createdAt, updatedAt
```

Region tools (`REGION_TOOLS`): `select`, `point`, `circle`, `polygon`, `brush`, `lasso`, `eraser`.

**Workflow note:** Capture mode exposes a subset in the UI; polygon/lasso and full metadata appear in Clinical Analysis.

## ClinicalMarkupRenderer

Renders pain regions as SVG overlays aligned to the clinical image frame. Handles:

- Selection and handles
- Intensity-based fill from `PAIN_COLORS`
- Preview while drawing (polygon, lasso, brush)
- Integration with `VisualizationController` CSS classes

## VisualizationController

`src/engine/overlays/visualization-controller.js`

### Base modes (shipped)

| Mode | Behavior |
|------|----------|
| `standard` | Default anatomy display |
| `heatmap` | Emphasized pain region saturation |
| `reference` | Reference overlay (vector schematics; optional asset plates) |

### Reference overlays

Definitions: muscle, skeleton, nerve, organ.

1. **Vector schematics** (primary) — `src/engine/overlays/overlay-datasets.js` draws educational region outlines from `ANATOMY_REGIONS` / dermatome bands. Always available in Clinical Analysis.
2. **Optional asset plates** — probed at:

```text
public/anatomy/overlays/overlay_{id}_{gender}_{view}.svg
public/anatomy/overlays/overlay_{id}_{gender}_{view}.png
```

Schematic SVGs ship for male/female × four views. High-fidelity diagnostic atlases are still a roadmap item — see [ROADMAP.md](./ROADMAP.md).

### AI / assistive overlay toggles

Toggles for suggested structures, referred pain, dermatomes, and myotomes render schematic datasets from `overlay-datasets.js`. These are **assistive / educational**, not diagnostic atlases. Label: "Assistive Clinical Observation — Not a Medical Diagnosis."

## Asset Layout

```text
public/anatomy/
├── adult-male/   front.png, back.png, left.png, right.png (+ SVG legacy)
├── adult-female/
├── child/        (v0.1.0: copies adult-male plates)
├── teen/
├── senior/
└── overlays/     schematic SVG reference plates (muscle/skeleton/nerve/organ)
```

## Boundary: CAE vs PainLocator

| Concern | CAE (`src/engine/`) | PainLocator (`src/features/`, `src/state/`) |
|---------|----------------------|---------------------------------------------|
| Render anatomy | ✅ | — |
| Store pain entries | ✅ (`PainEntryStore`) | — |
| Workflow modes | — | ✅ Capture / Review / Clinical |
| Timeline chart | — | ✅ `src/features/review/timeline.js` |
| Rule-based insights | — | ✅ `src/features/clinical-analysis/insights.js` |
| Theme / branding | — | ✅ `src/layout/`, `src/utils/theme-tokens.js` |
| Bootstrap / init | — | ✅ `src/app/bootstrap.js` |

## Future: Standalone Package

Planned extraction would publish CAE with a stable API surface (`ClinicalAnatomyEngine`, `PainEntryStore`, `ClinicalMarkupRenderer`, coordinate helpers). Not available in v0.1.0.

## Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [JSON_SCHEMA.md](./JSON_SCHEMA.md)
- [REPORT_SPEC.md](./REPORT_SPEC.md)
- [ROADMAP.md](./ROADMAP.md)
