# PainLocator Demo-Ready Polish — Architecture & Plan

## Architecture discovered

PainLocator is a **client-only** vanilla JS SPA (Vite for `dev`/`preview`; production `build` copies static assets). Scripts load as globals via ordered `<script>` tags in `index.html`.

| Layer | Path | Role |
|-------|------|------|
| CAE | `src/engine/` | Anatomy plates, normalized coordinates, annotations, reporting |
| App features | `src/features/` | Capture CRUD, Review timeline/history, Clinical insights |
| State | `src/state/` | Global `state`, workflow modes (`capture` / `review` / `clinical`) |
| Layout / UI | `src/layout/`, `src/ui/` | Theme tokens, styles, resizers, context menu |
| Persistence | `localStorage` | `painlocator_pain_entries`, layout, theme |

**Data model:** `PainEntry` → `PainRegion[]` with view-scoped normalized anchors (0–1). Session JSON export schema `1.0.0`. Chart.js and Lucide load from CDN.

**Workflows:** Capture (log), Review (timeline/history), Clinical Analysis (tools, share, import).

## Priority gaps addressed in this effort

1. Print report hidden (ancestor `.app { display:none }` in print CSS)
2. Auto-draft on load creates phantom “Entry #1”
3. Empty-save UX, toast/status feedback, deletion undo
4. Review entry list hidden behind `.show-capture-form`
5. Basic trend/timeline; no demo, feedback, analytics, or tests

## Implementation phases

| Phase | Focus |
|-------|--------|
| 1 | Stabilize save/validation/empty states, print fix, draft lifecycle, undo, a11y basics |
| 2 | Demo Mode namespace, scenarios, guided walkthrough, isolation |
| 3 | Feedback form, service abstraction, Vercel serverless endpoint, fallback |
| 4 | Timeline filters, trend-summary engine, entry interaction |
| 5 | Clinician report polish, privacy/safety, tests, build verification |

## Design constraints

- Preserve visual identity and existing routes/workflow modes
- Keep CAE reusable (`src/engine/` free of PainLocator-only workflow)
- Version local schema; migrate safely
- Separate demo storage from real user data
- No diagnostic claims; assistive/disclaimer language only
