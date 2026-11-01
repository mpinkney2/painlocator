# Product Vision

PainLocator is an interactive clinical pain mapping and recovery documentation platform. It helps patients and clinicians record **where** pain occurs on the body, **how** it feels, and **how it changes over time** — using a visual, anatomy-first interface rather than free-text alone.

## Problem

Pain is difficult to communicate consistently across visits. Patients struggle to describe location and progression; clinicians lack structured, visual records that map symptoms to anatomy and timeline.

## Solution

PainLocator combines:

1. **Anatomical pain mapping** — mark pain on clinical body plates
2. **Structured symptom capture** — intensity, quality, triggers, duration, notes
3. **Recovery timeline** — visualize intensity trends across entries
4. **Clinical documentation** — exportable reports and portable session files

All processing runs **client-side** in the browser. Data remains on the user's device unless they explicitly export or share a file.

## Product Layers

| Layer | Role |
|-------|------|
| **PainLocator** | Flagship application — workflows, UI, clinical documentation |
| **Clinical Anatomy Engine (CAE)** | Reusable infrastructure under `src/engine/` — rendering, coordinates, annotations, overlays, reporting |

See [CLINICAL_ANATOMY_ENGINE.md](./CLINICAL_ANATOMY_ENGINE.md) for the engine boundary.

## Target Users

| User | Primary workflow | Goal |
|------|------------------|------|
| Patient / self-tracker | Capture | Log pain quickly between visits |
| Patient reviewing history | Review | Understand patterns and compare entries |
| Clinician / advanced user | Clinical Analysis | Detailed annotation, metadata, export, observations |

## Core Workflows (v0.1.0)

PainLocator organizes the UI into three workflow modes. See [ARCHITECTURE.md](./ARCHITECTURE.md#workflow-modes).

| Mode | Intent |
|------|--------|
| **Capture** | Fast logging — compact tools, intensity hero, save entry |
| **Review** | History — emphasized timeline, trend summary, compare, edit entry |
| **Clinical Analysis** | Full clinical toolkit — polygon/lasso, visualization, AI panel, export |

## Design Principles

1. **Anatomy-first** — pain is anchored to normalized coordinates on clinical plates
2. **Progressive disclosure** — simple capture by default; clinical depth when needed
3. **Privacy by default** — local storage; no automatic network transmission
4. **Clinical credibility** — readable reports, structured data, non-diagnostic AI labeling
5. **Engine separation** — CAE can evolve independently of PainLocator features

## What Exists Today (v0.1.0)

- Region-based pain entries with undo/redo
- Five patient model folders (`adult-male`, `adult-female`, `child`, `teen`, `senior`)
- Recovery timeline chart (Chart.js)
- Rule-based pattern insights (not machine learning)
- JSON session export/import ([JSON_SCHEMA.md](./JSON_SCHEMA.md))
- Clinical report via browser print ([REPORT_SPEC.md](./REPORT_SPEC.md))
- PNG clinical snapshot export
- Light/dark semantic theme system ([UI_GUIDELINES.md](./UI_GUIDELINES.md))

## What Is Not in Scope (Yet)

Future directions are tracked in [ROADMAP.md](./ROADMAP.md) and [AI_ROADMAP.md](./AI_ROADMAP.md). v0.1.0 does **not** include server sync, accounts, diagnostic AI, or a published CAE npm package.

## Path to clinic and health-system adoption

PainLocator’s intended clinical job is to replace the paper body chart + pen with a structured visual map patients can complete and physicians can review — as a **complement** to MyChart/Epic (and other EHRs), not as a diagnostic device.

Operating plans:

| Doc | Owner | Purpose |
|-----|-------|---------|
| [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) | Engineering | Production gates for Clinic Map → Chart Complement → Service Line |
| [BUSINESS_AND_GTM.md](./BUSINESS_AND_GTM.md) | Grok (commercialization) | Beachhead ICP, 90-day GTM sprint, pricing, partnerships |

Beachhead: independent pain clinics still using paper diagrams. Hospital systems come after tenancy, BAA-ready architecture, and reference clinics.

## Success Metrics (Future)

As the product matures, success will be measured by:

- Time to complete a pain entry in Capture mode
- Clarity and completeness of exported clinical reports
- Session portability (export → import fidelity)
- Clinician adoption of structured pain maps in consultation prep
- (Later) Share of agreed visit types with a filed map PDF; in-visit clinician use rate

## Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) — technical structure
- [ROADMAP.md](./ROADMAP.md) — planned development
- [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) — production finish plan
- [BUSINESS_AND_GTM.md](./BUSINESS_AND_GTM.md) — commercialization / GTM
- [CHANGELOG.md](./CHANGELOG.md) — release history
