# PainLocator — Product UX Architecture & Phase 2 Anatomy Pipeline

**Status:** Design lock (no implementation in this document)  
**Date:** 2026-09-06  
**Baseline:** `main` after [PR #7](https://github.com/mpinkney2/painlocator/pull/7) merge  
**Merge commit:** `fc34d83d1e12efbeabbac5d894082e69403b5f89`

**Baseline capabilities (shipped):**

- Spatial Manifest architecture + exterior GLB
- Stable `meshId`s; manifest-authoritative GLB integrity
- Runtime spatial attachments (session Map only)
- Plate default + Spatial lazy-load + clean plate fallback
- Persisted `PainEntry` / `PainRegion` schema unchanged (`view` + `anchors` + `anatomyLayer`)

**Non-goals for this document’s accompanying work:**

- Do **not** implement muscle / skeleton / nerve / organ layers
- Do **not** redesign the app in code
- Do **not** change persisted PainRegion schema
- Do **not** migrate to React
- Do **not** add diagnosis logic or speculative AI
- Do **not** turn PainLocator into an anatomy-learning atlas
- Do **not** remove plate fallback
- Do **not** start Slice 2 implementation yet

**Companion docs:** [PRODUCT_VISION.md](./PRODUCT_VISION.md), [SPATIAL_ANATOMY_PHASE2_DECISION.md](./SPATIAL_ANATOMY_PHASE2_DECISION.md), [CLINICAL_ANATOMY_ENGINE.md](./CLINICAL_ANATOMY_ENGINE.md), [UI_GUIDELINES.md](./UI_GUIDELINES.md)

---

## Thesis

PainLocator is **one clinical data platform** with **two purpose-built experiences**:

1. **Patient experience** — mobile-first, calm, “touch → describe → save”
2. **Clinician experience** — desktop/tablet-first spatial review console

Both share: **CAE**, pain store, anatomy identities, history, and reporting.  
Layout, density, terminology, and chrome differ.

---

## A. Current UX audit

Sources: `index.html`, `src/layout/styles.css`, `src/state/workflow.js`, `src/features/review/history-ui.js`, CAE spatial modules, `src/engine/annotations/pain-models.js`.

**Default anatomy mode today:** **plate (2D)**. Spatial is opt-in, lazy-loads Three + manifest + GLB, and falls back to plate on failure. Persisted region fields remain `view` + `anchors` + `anatomyLayer`.

### Disposition matrix

| Area | KEEP | SIMPLIFY | MOVE | HIDE UNTIL NEEDED | REMOVE FROM PRIMARY VIEW |
| --- | --- | --- | --- | --- | --- |
| **Capture** | Anatomy stage; Select/Point/Region/Eraser; intensity; quality/trigger pills; notes; Save | “Pain Quality (Qualitative Indicators)” → “How it feels”; fewer header actions | Enlarge nearer silhouette; duration nearer intensity | Timeline chart; Spatial toggle for first-run patients | Always-visible CAE Command Center while logging |
| **Review** | Timeline emphasis; entry list; trend summary; Share | Duplicate filters (toolbar vs timeline range/region) | Compare UI next to timeline selection | Capture form unless editing | Clinical-only CAE sections (already mostly hidden) |
| **Clinical Analysis** | Polygon; region editor; pattern notes + disclaimer; export | Duplicate Share (header + sidebar) | “Rendering Engine” / detail levels → settings drawer | Future profile tags; assistive overlays until data exists | “Future Operations: 3D Rotate…” placeholders; Prototype renderer |
| **CAE Command Center** | Patient model; Front/Back/Left/Right; Standard/Heatmap | Rename to “Body & view”; drop dual mobile/desktop titles | Accessibility → Help/settings | Collapse left rail on Capture (mobile already does ≤900px) | Engineering “CAE Command Center” name in patient Capture |
| **Anatomy toolbar** | Marking tools; Undo/Redo; Enlarge (plate-only) | Dense strip on mobile (overflow risk) | 2D/Spatial next to Body View, not marking tools | Spatial until proven load; Polygon until Clinical | “Phase 1 preview” copy on Spatial |
| **Right doc panel** | Mode title; intensity; symptoms; save validation; Review trends/list | Long accordion scroll; duplicate guidance hints | Active-entry summary tone per mode | Delete/advanced region until selection | “Dictate clinical observations…” in patient Capture |
| **Timeline** | Chart; a11y summary; click-to-select | Always-on in Capture | Primary home = Review | Filters until ≥1 entry | Full chart in Capture primary view |
| **Accessibility** | Contrast / colorblind / large targets; skip link; theme | Buried in left accordion | Into Help / header overflow | Fine when collapsed | From “command center” framing |
| **Plate / Spatial** | Plate default; Spatial opt-in; failure toast; snaps drive yaw | Patient labels: “Flat map” / “3D body” | Toggle into Body View | Spatial until first successful load or Clinical | Legacy “Phase 1” / “Future 3D Rotate” messaging |

### Cross-cutting problems

- **Anatomy competes with chrome** — left CAE stack + right doc + bottom timeline shrink the body.
- **Engineering language** — “CAE Command Center”, “Rendering Engine”, “Qualitative Indicators”, “Phase 1 preview”.
- **Duplication** — view selectors (desktop + mobile), export/import, insights, date filters, guidance strings.
- **Mobile** — long scroll past save CTA; crowded marking strip; Spatial drag vs mark conflict risk.
- **Clinician** — Clinical mode feels like Capture+ rather than a review console; body is not ~60–75% of the work area.

### What not to throw away

Three-workflow shell + progressive CSS disclosure (`show-clinical` / `show-review`) is the right **internal** spine. Plate-default + lazy Spatial + unchanged 2D schema is the correct Slice 1 contract. Fix **presentation shells**, not the engine boundary.

---

## B. Patient product architecture (Patient Capture)

**Primary devices:** phone / small tablet  
**Job:** communicate pain **without** anatomical knowledge  
**Core loop:** **TOUCH → DESCRIBE → SAVE**

### Capabilities

| Allowed | Forbidden in primary UI |
| --- | --- |
| Rotate body (gentle snap or free) | Clinical structure lists |
| Tap location; optional paint/brush | Advanced layer cockpit |
| Indicate radiation / path | FMA / mesh / structure IDs |
| Intensity + character | Technical renderer controls |
| Duration / timing / triggers / relief | Analysis / compare / report panels |
| Optional note or speech | Anatomy-learning navigation |
| Review before save | Engineering workflow labels |

### Experience principles

- Calm, premium healthcare — not a game, not a textbook
- One primary action per screen/sheet
- Body occupies most of the viewport on “Where?”
- Progressive sheets for describe/timing; never a permanent clinical sidebar
- Fail soft: if Spatial unavailable, plate capture still works

### Internal mapping

| Patient UX | Internal state (keep) |
| --- | --- |
| Locate | Capture workflow + plate/spatial displayMode |
| Describe | Entry draft fields (intensity, qualities, notes…) |
| Review (pre-save) | Draft summary → `PainEntryStore` save |
| History (optional later) | Review workflow, simplified chrome |

---

## C. Clinician console architecture

**Primary devices:** desktop / large tablet  
**Job:** interpret patient-reported spatial pain in anatomical context — fast

### Principles

- **Body is the primary workspace** (~60–75% of main visual area)
- Distinguish **patient-reported location** from **anatomical context**
- Depth tools are compact; not an atlas browser
- Avoid dashboard-card clutter and nested accordion forests

### Capabilities

- Rotate / orthographic snaps / zoom
- Inspect pain marks (intensity, quality, notes)
- Change anatomy depth (future layers)
- Compare visits
- Nearby-structure context (assistive, non-diagnostic)
- Generate / export findings
- Plate fallback always available

### Internal mapping

| Clinician UX | Internal state |
| --- | --- |
| Patient | Active patient/session selection |
| Anatomy | displayMode + layer pack + camera |
| History | Review timeline / entry list |
| Compare | Multi-entry selection + overlay |
| Report | Existing report/export pipeline |

---

## D. Consult / presentation mode

**Devices:** desktop, room display, shared tablet  
**Purpose:** clinician and patient look at the same anatomy together

| Keep visible | Hide |
| --- | --- |
| Large anatomy | Tool denseness |
| Selected pain overlay | Structure dictionaries |
| Optional contextual structures (ghosted) | Export/settings |
| Simple visit compare (A/B or onion-skin) | CAE command chrome |

**Define only now** — no implementation. Treat as a chrome profile over the clinician shell (`presentationDensity: "consult"`).

---

## E. Information architecture

### External labels (recommended)

| Audience | Nav labels | Avoid exposing |
| --- | --- | --- |
| **Patient** | Locate · Describe · Review | Capture / Clinical Analysis / CAE |
| **Clinician** | Patient · Anatomy · History · Compare · Report | Command Center / Rendering Engine |

### Mapping to existing internal workflows

```
EXTERNAL (patient)     INTERNAL (unchanged engine)
Locate              →  workflow=capture, tool=point|region
Describe            →  draft metadata panels / sheets
Review (save check) →  draft validate → store.save
Review (history)    →  workflow=review (simplified shell)

EXTERNAL (clinician)   INTERNAL
Patient             →  session/patient context
Anatomy             →  workflow=clinical|capture + spatial/plate
History             →  workflow=review
Compare             →  review compare selection
Report              →  export / print report
```

Internal `workflow` enum may remain `capture | review | clinical`.  
**Presentation mode** (`patientShell | clinicianShell | consultShell`) is a separate axis.

---

## F. Mobile patient flow

### Screen 1 — Where does it hurt?

```
┌─────────────────────────┐
│  Where does it hurt?    │
│                         │
│      ┌─────────┐        │
│      │  BODY   │        │
│      │ (large) │        │
│      └─────────┘        │
│   ↻ drag to turn        │
│                         │
│  [ + Add another spot ] │
│              [ Next ]   │
└─────────────────────────┘
```

- Minimal chrome; body ~80% of viewport
- Tap = point; optional long-press/drag = paint (progressive)
- Radiation: drag a path from origin mark (optional second gesture)
- Free rotate with light snap to front/back/sides preferred over hard lock
- Multiple sites: list chips under body (“Spot 1”, “Spot 2”)

### Sheet 2 — How does it feel?

Bottom sheet over dimmed body (body still faintly visible for context):

- Intensity 0–10 (large stepper / slider)
- Character chips: aching, burning, sharp, throbbing, tingling, numbness, pressure, …
- Optional: “moves / radiates” toggle if path not drawn

### Sheet 3 — When / what affects it?

- Duration, timing (constant / intermittent)
- Triggers / relief (chips + optional note)
- Optional speech-to-note (assistive, not required)

### Screen 4 — Review and save

- Thumbnail body with marks
- Plain-language summary (“Left shoulder · 6/10 · burning · since Monday”)
- Edit chips jump back to sheets
- **Save** primary; **Add another** secondary

### Gestures & a11y

| Topic | Recommendation |
| --- | --- |
| Onboarding | One-time coach marks: tap body → describe → save |
| Older patients | Large targets (≥44px); high-contrast option; reduce motion respects OS |
| Screen reader | “Mark on upper left chest”; intensity announced; sheets as dialogs |
| Failures | Spatial fail → plate automatically; never block save |

---

## G. Desktop clinician layout

```
┌──────────────────────────────────────────────────────────────┐
│ Patient name · Visit date · [Compare] · [Report] · ⋯         │
├──────────┬─────────────────────────────────────┬─────────────┤
│ Anatomy  │                                     │ Reported    │
│ controls │         HUMAN ANATOMY               │ pain        │
│ (narrow) │         VIEWPORT                    │             │
│          │         ~60–75% width               │ Context     │
│          │                                     │ (nearby)    │
├──────────┴─────────────────────────────────────┴─────────────┤
│ Visit / history timeline                                      │
└──────────────────────────────────────────────────────────────┘
```

### Left rail (compact — ~200–240px, collapsible)

- Display: Plate | Spatial
- View snaps: Front / Back / Left / Right
- Depth: Surface → Muscle → Skeletal → Neural → Internal *(future packs)*
- Tool: Select / Point / Region (clinical edit only when intentional)
- Opacity / ghost for non-focus layers
- **Not:** full FMA tree, renderer debug, duplicate export

### Right contextual panel (~280–320px)

1. **Patient-reported** (primary): sites, intensity, character, notes, timing  
2. **Anatomical context** (secondary, clearly labeled assistive): nearby structures  
3. Visit meta / disclaimer: “Assistive Clinical Observation — Not a Medical Diagnosis.”

Collapse right panel when viewport &lt; 1100px (icon to reopen).  
Collapse left to icon rail when &lt; 900px (tablet).

### Timeline (bottom)

- Always available in clinician shell; height ~120–160px resting, expand on focus
- Click visit → load overlays; Shift-click → compare
- Brush range for multi-visit onion-skin *(later)*

### Compare workflow

1. Select visit A (baseline) + visit B (current)  
2. Body shows A ghosted + B solid (or split)  
3. Right panel: delta summary (intensity, region change — see §M)

### Keyboard shortcuts (clinician)

| Key | Action |
| --- | --- |
| `1–4` | Front / Right / Back / Left |
| `[` `]` | Depth shallower / deeper |
| `Space` | Toggle plate ↔ spatial |
| `C` | Compare mode |
| `R` | Report |
| `Esc` | Clear selection / close panels |
| `?` | Shortcut help |

### Large monitor / tablet

- Ultrawide: keep body centered; do not stretch side rails past ~320px  
- Tablet landscape: icon left rail + optional overlay right sheet  
- Tablet portrait: fall back toward patient-like stacking with clinician terminology

---

## H. Visual design system

Avoid: sterile blue-only; pure black sci-fi; neon; textbook primaries; heavy glassmorphism; excessive gradients.

### Patient light

| Token role | Direction |
| --- | --- |
| Background | Warm neutral gray-cream `#F7F5F2`–`#F3F1EE` |
| Surfaces | White / `#FFFdf9` soft elevation, 12–16px radius sheets |
| Text | Near-ink `#1C1917`, secondary `#57534E` |
| Accent | Teal-slate `#0F766E` (actions) — not purple, not loud |
| Pain intensity | Sequential warm: `#FDE68A` → `#FB923C` → `#DC2626` (marks only) |
| Body tone | Desaturated skin-neutral `#D7C2B2` / cool clinical gray `#C5CCD6` for interim GLB |
| Sheets | Soft shadow, full-bleed bottom sheets; no multi-card dashboards |

### Clinical light

| Token role | Direction |
| --- | --- |
| Background | Cool gray `#F4F6F8` |
| Surfaces | White, tighter radius (8–10px), hairline borders `#E2E8F0` |
| Accent | Deep teal `#0D9488` / ink `#0F172A` |
| Structure layers | Desaturated: muscle dusty rose, bone warm gray, nerve muted gold, organs slate-blue |
| Pain marks | Remain highest chroma; anatomy stays subordinate |

### Clinical dark / slate

| Token role | Direction |
| --- | --- |
| Background | `#0B1220` / `#111827` |
| Surfaces | `#1F2937` |
| Text | `#E5E7EB` |
| Accent | `#2DD4BF` at low saturation for chrome only |
| Pain | Keep warm intensity ramp; never use red for chrome |

**Rule:** Pain color dominates **marks**, never the entire product shell.

Extend existing semantic tokens in `theme-tokens.css`; do not invent a second parallel system.

---

## I. Anatomy layer UX

Do **not** expose thousands of structures as primary controls.

### Conceptual depths

| Depth | Meaning | Initial ship intent |
| --- | --- | --- |
| **Surface** | Exterior envelope (Slice 1 done) | Now |
| **Muscle** | Major groups | Later pack |
| **Skeletal** | Major bones + joints | Later pack |
| **Neural** | Major nerves / plexuses | Later pack |
| **Internal** | Major organs | Later pack |

### Interaction model (recommended)

**Focus depth + ghosted context** (not exclusive wipe, not full uncontrolled compositing):

1. Clinician selects **Neural**
2. Surface → high transparency
3. Muscle → strongly dimmed
4. Neural → prominent
5. **Pain marks always on top**, visually distinct (shape + chroma + optional halo)

Optional per-layer opacity for power users, collapsed under “Advanced”.

Patient Capture: **Surface only** (no depth cockpit).

---

## J. Patient-reported location vs anatomical context

| Concept | Definition | UI treatment |
| --- | --- | --- |
| **Patient-reported location** | What the patient marked / described | Primary heading; always first |
| **Anatomical context** | Structures near the mark (assistive) | Secondary list; muted; explicit label |

**Example**

```
Reported location
  Left shoulder

Nearby structures (assistive — not a diagnosis)
  • Deltoid region
  • Acromioclavicular joint region
  • Rotator cuff region
```

**Rules**

- Never imply causation (“pain caused by…”)
- Always show disclaimer on clinician context panels
- Patient UI never shows FMA IDs; clinician may reveal IDs under “Details”
- Interim `PL:surface.*` IDs stay internal until FMA mapping exists

---

## K. BodyParts3D ingestion pipeline

Per [SPATIAL_ANATOMY_PHASE2_DECISION.md](./SPATIAL_ANATOMY_PHASE2_DECISION.md): **BodyParts3D / DBCLS (CC BY 4.0)** is the primary structure library. **Do not** ship raw BP3D into the browser.

```
BodyParts3D source (OBJ + FMA tables)
        ↓
source manifest (pinned archive version + checksums)
        ↓
license / provenance capture (CC BY 4.0 attribution bundle)
        ↓
FMA mapping (conceptId ↔ representationId ↔ PainLocator structureId)
        ↓
mesh normalization (meters, Y-up, origin, facing)
        ↓
mesh cleanup (non-manifold, normals, weld, name sanitize)
        ↓
structure grouping (Surface / Muscle / Skeletal / Neural / Internal)
        ↓
LOD generation (lod0 clinical review, lod1 mobile)
        ↓
compression (Meshopt preferred; Draco optional)
        ↓
GLB layer packs (per depth × region as needed)
        ↓
PainLocator Spatial Manifest (authoritative meshId / structureId)
        ↓
lazy runtime loading (already pioneered in PR #7)
```

### Toolchain recommendation

| Stage | Tooling |
| --- | --- |
| Orchestration | **Node** scripts (fit existing repo) calling CLI tools |
| Mesh convert / repair | **Python** (`trimesh` / `numpy-stl`) and/or **Assimp** |
| glTF graph ops | **`gltf-transform`** (CLI) for pack, inspect, meshopt |
| Stubborn cleanup | **Blender CLI** headless only as escape hatch — not the happy path |
| Manifest emit | Node — same schema family as Slice 1 |

Prefer **reproducible automation** + locked source checksums over hand-authored Blender scenes.

Interim exterior (PR #7) remains valid until BP3D exterior pack replaces it **with the same `meshId` contract where possible**.

---

## L. Spatial identity (future persistence)

Today (keep): runtime attachments + persisted `view` + `anchors` + `anatomyLayer`.

### Future additive `PainRegion.spatial` (schema-versioned, optional)

```json
{
  "schemaVersion": "spatial-attachment/1",
  "modelId": "adult-male",
  "sourceAssetVersion": "bp3d-2025-02-25+pl.1",
  "structureId": "FMA:12345",
  "meshId": "muscle.deltoid.L",
  "triangleIndex": 10422,
  "barycentric": { "u": 0.2, "v": 0.5, "w": 0.3 },
  "localPoint": { "x": 0.01, "y": 0.02, "z": 0.00 },
  "canonicalBodyXYZ": { "x": 0.12, "y": 1.35, "z": 0.08 },
  "surfaceUV": { "u": 0.42, "v": 0.61 }
}
```

| Field | Role |
| --- | --- |
| `modelId` + `sourceAssetVersion` | Survive asset revisions |
| `structureId` | Clinical identity (FMA when mapped; `PL:` interim OK) |
| `meshId` | Stable manifest mesh identity (not Three UUID) |
| `triangleIndex` + `barycentric` / `localPoint` | Remount binding |
| `canonicalBodyXYZ` | Cross-asset / compare normalization |
| `surfaceUV` | Optional alternate binding when UV-stable packs exist |

**Must survive:** reload, remount, new visits, reasonable asset revisions, interim→BP3D swap.  
**Must not rely on:** Three.js UUID.

When additive spatial lands, **2D fields remain required** for plate/reports/backward compatibility.

---

## M. Longitudinal architecture

### Compare visualization (future)

| Change | Visual |
| --- | --- |
| Intensity change | Mark chroma/size delta; numeric Δ in panel |
| Region contraction / expansion | Onion-skin outlines; area delta |
| Migration | Ghost trail or arrows between centroids |
| Radiation path changes | Path overlay A vs B |
| Resolved pain | Desaturated “resolved” marks on baseline only |

### Normalization required

1. Same `modelId` + documented `canonicalBodyXYZ` space  
2. Marks reprojected if `sourceAssetVersion` changes (via structureId + canonical point)  
3. Visit pair aligned to same view/yaw for plate screenshots; spatial uses shared camera rig  
4. Never compare across unmatched sex/model without explicit transform

---

## N. Responsive / view-shell recommendation

**Prefer:** shared application state + **separate patient and clinician view shells**  
**Avoid:** one DOM layout that tries to radically reflow into both products

### Shared

- CAE (`src/engine/`)
- `PainEntryStore` / models
- Anatomy identity + spatial manifest loader
- Reporting / session I/O
- Theme tokens
- Workflow/domain state

### Different

- Layout chrome
- Navigation labels
- Control density
- Default displayMode emphasis (patient: plate-first simplicity; clinician: spatial-ready)
- Terminology
- What’s permanently visible vs sheet/drawer

Implementation sketch: `patient-shell` vs `clinician-shell` mount the same engine adapters; media queries alone are insufficient for the IA split.

---

## O. Prioritized implementation sequence

Balance UX, anatomy fidelity, and architecture risk. **Do not** wait for all layers before improving UI.

| Order | Slice | Outcome | Risk notes |
| --- | --- | --- | --- |
| **1** | Product shell split / mode routing | `patientShell` vs `clinicianShell` over existing workflows | Low engine risk; unlocks UX |
| **2** | Patient mobile capture shell | Locate → Describe → Save sheets | Highest user-value; plate-first |
| **3** | Clinician anatomy console shell | Body-dominant layout; compact rails | Reuses Spatial from PR #7 |
| **4** | Consult chrome profile | Minimal presentation mode | Mostly CSS/chrome |
| **5** | BodyParts3D ingestion prototype | Offline pipeline → one muscle or skeleton pack | Hardest infra; isolate from UI |
| **6** | Additive persisted spatial identity | Optional `PainRegion.spatial` | Schema versioning discipline |
| **7** | First real layer packs (muscle **or** skeletal) | Manifest layers beyond surface | Only after pipeline + IDs |
| **8** | Nearby-structure context | Assistive lists; no diagnosis | Needs FMA mapping quality |
| **9** | Longitudinal compare | Visit A/B overlays | Needs canonical normalization |
| **10** | Female/other models | Parallel manifests | Don’t block male clinical path |

**Explicitly deferred:** atlas browsing, diagnostic AI, React migration, removing plate.

---

## P. Wireframe diagrams (markdown)

### Patient Locate

```
┌─────────────────────────┐
│ PainLocator        Help │
│ Where does it hurt?     │
│                         │
│        ████████         │
│        ██ BODY ██       │
│        ████████         │
│                         │
│  ○ Spot 1               │
│          [Describe →]   │
└─────────────────────────┘
```

### Patient Describe (sheet)

```
┌─────────────────────────┐
│ ▓▓▓ body (dimmed) ▓▓▓   │
│ ┌─────────────────────┐ │
│ │ How does it feel?   │ │
│ │ Intensity  ●────○ 6 │ │
│ │ [Aching][Burning]…  │ │
│ │         [Continue]  │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

### Clinician console

```
┌────────────────────────────────────────────┐
│ Ava N. · 2026-09-06 · Compare · Report     │
├──────┬──────────────────────────┬──────────┤
│ Depth│                          │ Reported │
│ Surf │        ANATOMY           │ L should.│
│ Musc │                          │ 6 · burn │
│ Skel │                          │──────────│
│ View │                          │ Context  │
│ Snap │                          │ Deltoid… │
├──────┴──────────────────────────┴──────────┤
│ ●──●────●── timeline                       │
└────────────────────────────────────────────┘
```

### Consult

```
┌────────────────────────────────────────────┐
│ Ava · visit compare                        │
│                                            │
│              LARGE BODY                    │
│           pain + soft context              │
│                                            │
│         [Exit presentation]                │
└────────────────────────────────────────────┘
```

---

## Q. Design token recommendations (conceptual)

| Token | Patient light | Clinical light | Clinical slate |
| --- | --- | --- | --- |
| `--bg` | `#F7F5F2` | `#F4F6F8` | `#0B1220` |
| `--surface` | `#FFFdf9` | `#FFFFFF` | `#1F2937` |
| `--text` | `#1C1917` | `#0F172A` | `#E5E7EB` |
| `--text-muted` | `#78716C` | `#64748B` | `#9CA3AF` |
| `--accent` | `#0F766E` | `#0D9488` | `#2DD4BF` |
| `--pain-3` | `#FBBF24` | same family | same family |
| `--pain-6` | `#F97316` | | |
| `--pain-9` | `#DC2626` | | |
| `--anatomy-muscle` | — | `#C4A4A4` | `#8B6F6F` |
| `--anatomy-bone` | — | `#D6D0C8` | `#A8A29E` |
| `--anatomy-nerve` | — | `#C6B57A` | `#A89B5C` |
| `--anatomy-organ` | — | `#9AA8B8` | `#6B7C8F` |
| `--disclaimer` | `#57534E` | `#475569` | `#9CA3AF` |

Map into existing CSS variables; keep WCAG contrast for text/chrome. Pain marks may use stronger chroma with non-color cues (shape, pattern).

---

## R. Major product / technical risks

| Risk | Mitigation |
| --- | --- |
| UI rewrite blocks anatomy pipeline | Sequence shells first, packs later (§O) |
| Atlas scope creep | Depth packs + focus/ghost; no primary FMA browser |
| Schema break for old sessions | Keep `view`/`anchors`/`anatomyLayer` required; spatial additive |
| BP3D male-only | Manifest modelId; female path later; don’t block |
| License / attribution drift | Pin archive version + provenance in every pack |
| Performance on mobile | Surface-only patient path; aggressive LOD; lazy packs |
| Over-trust in nearby structures | Label assistive; disclaimer; no causation language |
| Three UUID regressions | Manifest `meshId` remains durable key (PR #7 invariant) |
| Dual-shell divergence | Shared CAE + store; design tokens; contract tests |
| Compare without normalization | Require canonicalBodyXYZ + asset version strategy |

---

## S. Exact next implementation prompt

Use this as the **next** coding task (still **not** Slice 2 anatomy packs):

```text
PAINLOCATOR — NEXT IMPLEMENTATION: PRODUCT SHELL SPLIT (NO ANATOMY PACKS)

Repo: mpinkney2/painlocator
Base: current main (PR #7 merged)

Read and follow:
docs/PAINLOCATOR_PRODUCT_UX_AND_ANATOMY_ARCHITECTURE.md

Implement ONLY sequence item 1 (and optionally thin scaffolding for item 2):
Product shell split / mode routing.

DO:
- Add a presentationMode axis: patientShell | clinicianShell
  (consultShell may be stubbed, not fully styled)
- Map existing internal workflows (capture/review/clinical) into shells
  without renaming engine state enums unless necessary
- Patient shell: reduce chrome toward Locate/Describe/Review labeling;
  keep plate default; do not require Spatial
- Clinician shell: body-dominant layout scaffolding (left compact rail,
  center viewport, right contextual panel, bottom timeline slot)
- Preserve plate default, Spatial lazy-load, plate fallback
- Preserve PainEntry/PainRegion persisted schema exactly
- Keep CAE boundary clean (src/engine reusable)

DO NOT:
- implement BodyParts3D ingestion
- add muscle/skeleton/nerve/organ layers
- change persisted spatial schema
- migrate to React
- add diagnosis / nearby-structure intelligence
- remove plate mode
- full visual redesign polish (tokens may be stubbed)
- start longitudinal compare

Acceptance:
- User can switch patient vs clinician presentation
- Patient path remains usable on a narrow viewport
- Clinician path shows body as primary workspace scaffold
- Existing sessions load; reports unchanged
- npm test / typecheck / build pass
```

---

## Document control

| Field | Value |
| --- | --- |
| Authors | PainLocator design pass (post–PR #7) |
| Implements code? | **No** |
| Next code slice | Product shell split (prompt in §S) |
| Anatomy packs | After shells + BP3D pipeline prototype |

**Lock:** Product experience dual-shell model + BP3D ingestion architecture are the intended guide rails before deeper anatomy implementation.
