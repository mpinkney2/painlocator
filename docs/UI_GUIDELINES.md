# UI Guidelines

PainLocator v0.1.0 uses a **semantic theme token** system. Components should reference CSS variables — not hard-coded colors — so light and dark modes remain readable.

Implementation: `src/layout/theme-tokens.css` (tokens) and `src/layout/styles.css` (components).

## Design Goals

1. **Clinical credibility** — calm, precise, professional
2. **Readable in both themes** — no light-on-light or dark-on-dark failures
3. **Progressive disclosure** — Capture is simple; Clinical Analysis reveals depth
4. **Accessible focus** — visible keyboard focus rings
5. **Consistent branding** — PainLocator wordmark readable in all modes

## Theme Tokens

### Surfaces

| Token | Usage |
|-------|--------|
| `--background` | Page background |
| `--surface` | Panels, header |
| `--surface-secondary` | Cards, nested areas |
| `--surface-elevated` | Modals, menus |
| `--border` | Default borders |
| `--border-strong` | Emphasis, print tables |

### Text

| Token | Usage |
|-------|--------|
| `--text-primary` | Body text, headings |
| `--text-secondary` | Supporting text |
| `--text-muted` | Labels, hints |
| `--text-inverse` | Text on saturated backgrounds |

### Actions

| Token | Usage |
|-------|--------|
| `--primary` | Primary buttons |
| `--primary-contrast` | Text on primary buttons |
| `--accent` | Highlights, active tools, chart line |
| `--accent-subtle` | Hover/active backgrounds |

### Status

| Token | Usage |
|-------|--------|
| `--danger` | Errors, delete, high-severity alerts |
| `--success` | Positive status (e.g. loaded) |
| `--warning` | Caution, loading |

Legacy aliases (`--bg`, `--text`, `--muted`, `--card`) map to semantic tokens for backward compatibility.

## Light and Dark Mode

- Default: **light**
- Toggle: header **Dark Mode** / **Light Mode** button
- Persistence: `localStorage` key `painlocator_theme`
- Body class: `theme-dark` when dark

Charts read tokens via `getThemeToken()` and refresh on theme change (`updateChartTheme()`).

## Branding

Header lockup (`index.html`):

```text
PainLocator
Powered by Clinical Anatomy Engine
```

| Element | Token |
|---------|--------|
| "Pain" | `--brand-pain` → `--text-primary` |
| "Locator" | `--brand-locator` → `--accent` |
| Tagline | `--brand-tagline` → `--text-muted` |

Do not place the wordmark on a fixed dark header in light mode — header uses `--header-bg`.

## Layout Regions

| Region | Location | Notes |
|--------|----------|-------|
| Header | Top | Brand, workflow tabs, theme, export |
| CAE Command Center | Left sidebar | Model, view, visualization, tools |
| Anatomy stage | Center | Clinical plate + region overlay |
| Recovery Timeline | Bottom (under anatomy) | Chart.js line chart |
| Clinical documentation | Right sidebar | Intensity, symptoms, notes, export |

Panel widths are resizable; positions stored in `painlocator_layout`.

## Workflow UI

CSS body classes drive visibility:

| Class | Effect |
|-------|--------|
| `wf-capture` | Compact timeline, capture tools |
| `wf-review` | Large timeline, review tools, hides capture form |
| `wf-clinical` | Shows clinical-only sections (`.show-clinical`) |
| `review-editing` | Re-enables capture form in Review mode |

Workflow toggle: header buttons **Capture**, **Review**, **Clinical Analysis**.

## Components

### Buttons

| Class | Use |
|-------|-----|
| `.btn-primary` | Save, export, primary actions |
| `.btn-secondary` | Secondary export options |
| `.btn-ghost` | Tertiary, clear, import |
| `.btn-toggle` | Workflow mode tabs |

### Forms

- **Intensity hero** — full-width slider at top of documentation panel; color follows intensity
- **Pills** — quality, triggers, ease-after multi-select
- **Accordions** — collapsible sections in sidebars

### Anatomy toolbar

Region tools: `.region-tool` with `.active` state using `--accent` tokens.

### Charts

Timeline uses `--chart-line`, `--chart-fill`, `--chart-grid`, `--chart-ticks`.

## Accessibility (v0.1.0)

### Shipped

- `:focus-visible` ring via `--focus-ring`
- High contrast mode toggle (recolors tokens via `.high-contrast-active`)
- Color blind safe theme toggle (`.colorblind-active`)
- Large touch targets toggle (`.large-targets-active`)
- `aria-label` on key header actions

### Guidelines for contributors

- Maintain WCAG AA contrast for `--text-primary` on `--surface`
- Never rely on color alone for intensity — slider shows numeric value
- Label AI output as non-diagnostic (see [REPORT_SPEC.md](./REPORT_SPEC.md))

## Dev-Only UI

Renderer debug badge is hidden unless `DEV_MODE` is true (`?dev=1`). Do not expose in production builds.

## Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [PRODUCT_VISION.md](./PRODUCT_VISION.md)
- [REPORT_SPEC.md](./REPORT_SPEC.md)
