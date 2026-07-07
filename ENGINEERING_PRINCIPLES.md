# PainLocator Engineering Constitution

PainLocator is not a generic demo application.

It is a professional clinical software platform built on the **Clinical Anatomy Engine (CAE)** and is intended for patients, physicians, therapists, researchers, and future healthcare integrations.

Every architectural, UI, and engineering decision must support this long-term vision.

---

## CAE Ecosystem Principle

**PainLocator is a flagship application built on the Clinical Anatomy Engine (CAE).**

The engine itself must remain **reusable** so future healthcare applications can leverage the same rendering, coordinate mapping, annotation, reporting, and AI infrastructure **without modification**.

This principle keeps CAE from becoming tightly coupled to PainLocator and makes it possible to build an **ecosystem of clinical applications** on the same foundation.

| Layer | Responsibility |
|-------|----------------|
| **CAE** (`src/engine/`) | Reusable clinical anatomy infrastructure |
| **PainLocator** (`src/features/`, `src/app/`, etc.) | Flagship pain-documentation application |

Never place PainLocator-specific workflow logic inside `src/engine/`. Never duplicate engine capabilities in application code.

---

## Product Philosophy

Prioritize the following in every decision:

1. Clinical clarity
2. Ease of patient use
3. Physician efficiency
4. Accessibility
5. Long-term maintainability
6. Extensibility
7. Professional medical presentation

**Rules:**

- Do not add features simply because they are technically possible.
- Every feature must solve a real clinical workflow.
- Always favor quality over quantity.

---

## User Experience Principles

PainLocator should feel like **professional medical software** — not a dashboard full of controls.

| Principle | Requirement |
|-----------|-------------|
| Anatomy first | The anatomy visualization is always the primary focus |
| Calm interface | Remain uncluttered and intuitive |
| Progressive disclosure | Expose advanced functionality only when needed |
| Whitespace | Preferable to clutter |
| Patient experience | Patients should never feel overwhelmed |
| Physician efficiency | Physicians should never need to hunt for information |

---

## Workflow Model

Every feature must belong to one workflow.

### Capture

- Record pain
- Create annotations
- Select anatomy
- Add notes

### Review

- Compare entries
- Edit annotations
- View timeline
- Review symptoms

### Clinical Analysis

- AI observations
- Pattern recognition
- Recovery trends
- Reporting
- Clinical documentation

**If a feature does not clearly belong to one workflow, reconsider its placement.**

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md#workflow-modes) for implementation details.

---

## Clinical Anatomy Engine (CAE)

The Clinical Anatomy Engine is the foundation of PainLocator — and must outlive any single application.

| Rule | Detail |
|------|--------|
| Separation | Keep engine code separated from application code |
| Reusability | Engine APIs must not assume PainLocator UI or workflows |
| Coordinates | Never duplicate coordinate mapping logic |
| Normalization | All pain annotations must use normalized coordinates (0–1) |
| Decoupling | Rendering and annotation must remain decoupled |
| Region detection | Must work independently of image assets |

Anatomy rendering must support future models **without architectural changes**:

- Adult Male ✅ (v0.1.0)
- Adult Female ✅ (v0.1.0)
- Child, Teen, Senior ⚠️ (plates exist; distinct assets planned)
- Pregnancy, Bariatric, Athletic (planned)

See [docs/CLINICAL_ANATOMY_ENGINE.md](./docs/CLINICAL_ANATOMY_ENGINE.md).

---

## UI Design Principles

- The anatomy should occupy the **majority** of available screen space
- Panels should support resizing
- Avoid modal overload
- Never obscure anatomy with unnecessary controls
- Toolbar buttons must remain visible in **Light and Dark** themes
- Theme switching must update every UI component
- **Never hardcode colors** — always use theme tokens
- Maintain WCAG-compliant contrast ratios

See [docs/UI_GUIDELINES.md](./docs/UI_GUIDELINES.md).

---

## Annotation Principles

Pain entries represent clinical observations.

A single pain entry may contain:

- One point
- Multiple points
- One region
- Multiple regions
- Polygons
- Future brush selections

Annotations must be **editable** and support:

- Move
- Resize
- Delete
- Merge *(planned)*
- Split *(planned)*
- Rename
- Recolor

### Data hierarchy

```text
Markers  →  belong to Entries
Entries  →  belong to Sessions
Sessions →  belong to Patients
```

See [docs/JSON_SCHEMA.md](./docs/JSON_SCHEMA.md) for session export structure.

---

## Reporting

Doctor reports must be suitable for clinical review.

### Required content

- Patient information
- Date/time
- Anatomy views
- Annotated regions
- Pain severity
- Timeline
- Trigger factors
- Pain quality
- Notes
- AI observations (non-diagnostic)
- Metadata

### Supported formats (v0.1.0 foundation)

| Format | Status |
|--------|--------|
| PDF | Browser print |
| JSON | Session export |
| PNG | Clinical snapshot |
| Print | Native |
| Secure sharing | User-controlled file export |

**Never expose debug information in reports.**

See [docs/REPORT_SPEC.md](./docs/REPORT_SPEC.md).

---

## JSON Standard

Exported JSON is intended for **long-term interoperability**.

- Document the schema
- Support future import
- Never break backward compatibility without versioning
- Always include schema version metadata

See [docs/JSON_SCHEMA.md](./docs/JSON_SCHEMA.md).

---

## AI Principles

Artificial Intelligence is **assistive**. It is **never diagnostic**.

AI should:

- Summarize
- Recognize trends
- Identify recovery patterns
- Suggest follow-up questions
- Identify documentation gaps

AI must **never claim a diagnosis**.

All AI output must be clearly labeled:

> **Assistive Clinical Observation — Not a Medical Diagnosis.**

See [docs/AI_ROADMAP.md](./docs/AI_ROADMAP.md).

---

## Code Architecture

Favor **maintainability** over speed.

| Prefer | Avoid |
|--------|-------|
| Composition over inheritance | Duplicated state |
| Reusable components | Duplicated business logic |
| Descriptive names | Abbreviations |
| Small focused modules | Monolithic files |

### Directory responsibilities

| Path | Role |
|------|------|
| `src/engine/` | CAE — anatomy, coordinates, annotations, overlays, reporting primitives |
| `src/features/` | Workflow-specific application logic |
| `src/state/` | Application state |
| `src/ui/` | Reusable UI behaviors |
| `src/layout/` | Shell, theme, resizers |
| `src/utils/` | Shared helpers |
| `src/types/` | Type definitions |

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) and [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md).

---

## Documentation

Documentation is part of the product.

Whenever architecture changes, update:

- [README.md](./README.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/ROADMAP.md](./docs/ROADMAP.md)
- [docs/CHANGELOG.md](./docs/CHANGELOG.md)
- [docs/JSON_SCHEMA.md](./docs/JSON_SCHEMA.md)
- [ENGINEERING_PRINCIPLES.md](./ENGINEERING_PRINCIPLES.md) *(this document)*

Documentation should never fall behind implementation.

---

## Git Standards

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use |
|--------|-----|
| `feat:` | New functionality |
| `fix:` | Bug fixes |
| `refactor:` | Code organization |
| `docs:` | Documentation |
| `style:` | Formatting only |
| `perf:` | Performance |
| `test:` | Tests |
| `build:` | Build system |
| `ci:` | CI configuration |

**Rules:**

- Every milestone should compile successfully (`npm run build`)
- Never commit broken builds
- Tag meaningful releases (e.g. `v0.1.0`)
- Use descriptive commit bodies for milestone checkpoints

---

## Accessibility

The application should be usable by:

- Patients
- Physicians
- Older adults
- Users with limited vision
- Color-blind users
- Keyboard-only users

**Accessibility is not optional.**

See [docs/UI_GUIDELINES.md](./docs/UI_GUIDELINES.md).

---

## Performance

- Lazy load large anatomy assets
- Avoid unnecessary re-renders
- Optimize canvas interactions
- Maintain smooth interactions while dragging annotations
- Future-proof rendering for high-resolution anatomy

---

## Future Development

Every new feature should **strengthen the platform** rather than complicate it.

- Favor scalable architecture
- Build reusable systems
- Think in terms of years, not weeks

See [docs/ROADMAP.md](./docs/ROADMAP.md) and [docs/PRODUCT_VISION.md](./docs/PRODUCT_VISION.md).

---

## Final Engineering Principle

> **Never sacrifice long-term maintainability for short-term speed.**

If multiple implementations are possible, choose the one that will still be understandable, extensible, and professionally maintainable two years from now.

**Build PainLocator as if it will become the industry standard for clinical pain documentation.**

---

## Related Documents

- [docs/PRODUCT_VISION.md](./docs/PRODUCT_VISION.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/CLINICAL_ANATOMY_ENGINE.md](./docs/CLINICAL_ANATOMY_ENGINE.md)
- [docs/UI_GUIDELINES.md](./docs/UI_GUIDELINES.md)
- [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md)
- [docs/ROADMAP.md](./docs/ROADMAP.md)
