# Contributing

Thank you for contributing to PainLocator and the Clinical Anatomy Engine (CAE).

## Repository

- **GitHub:** [github.com/mpinkney2/painlocator](https://github.com/mpinkney2/painlocator)
- **Stable branch:** `main`
- **Release tags:** semver tags on `main` (e.g. `v0.1.0`)

## Development Setup

```bash
git clone https://github.com/mpinkney2/painlocator.git
cd painlocator
npm install
npm start
```

Open **http://localhost:5500/?v=5.3**

### Verify before submitting

```bash
npm run build    # TypeScript check (tsc --noEmit)
```

Manual smoke test:

1. **Capture** — mark region, save entry
2. **Review** — timeline, select entry, compare (if ≥2 entries)
3. **Clinical Analysis** — export JSON, PNG, print report

## Branching Strategy

`main` is the stable release branch. Do not commit directly to `main` for feature work.

Create a feature branch from `main`:

```bash
git checkout main
git pull
git checkout -b feature/your-feature-name
```

Suggested branch prefixes:

| Prefix | Example |
|--------|---------|
| `feature/` | `feature/clinical-overlays` |
| `fix/` | `fix/timeline-theme-colors` |
| `docs/` | `docs/report-spec-update` |

Examples aligned with the roadmap:

- `feature/workflow-ui`
- `feature/reporting-v2`
- `feature/ai-analysis`
- `feature/clinical-overlays`
- `feature/session-import-export`

## Code Organization

| Change type | Location |
|-------------|----------|
| Reusable anatomy/rendering | `src/engine/` |
| Workflow-specific UI/logic | `src/features/` |
| App state / workflow mode | `src/state/` |
| Shared UI behavior | `src/ui/` |
| Styles / theme | `src/layout/` |
| Types | `src/types/` |
| Helpers | `src/utils/` |
| Documentation | `docs/` |

Read [ARCHITECTURE.md](./ARCHITECTURE.md), [CLINICAL_ANATOMY_ENGINE.md](./CLINICAL_ANATOMY_ENGINE.md), and [ENGINEERING_PRINCIPLES.md](./ENGINEERING_PRINCIPLES.md) before moving code across the CAE boundary.

## Coding Guidelines

1. **Do not break client-only privacy** — avoid adding network calls without explicit product approval
2. **Use theme tokens** — see [UI_GUIDELINES.md](./UI_GUIDELINES.md)
3. **Preserve normalized coordinates** — pain regions stay in 0–1 space
4. **Label AI output** — non-diagnostic disclaimers required for any new insight surface
5. **Minimize scope** — prefer focused PRs over large refactors
6. **No bundler required** — scripts load via `index.html`; maintain load order when adding files

## Documentation

Update `docs/` when changing:

- Session schema → [JSON_SCHEMA.md](./JSON_SCHEMA.md)
- Report layout → [REPORT_SPEC.md](./REPORT_SPEC.md)
- Architecture boundaries → [ARCHITECTURE.md](./ARCHITECTURE.md)
- Engineering standards → [ENGINEERING_PRINCIPLES.md](./ENGINEERING_PRINCIPLES.md)
- Shipped features → [CHANGELOG.md](./CHANGELOG.md)

## Commits

Use clear, imperative messages:

```text
feat: add overlay availability indicator
fix: restore chart colors on theme toggle
docs: update session schema examples
```

Tag releases on `main` after review:

```bash
git tag -a v0.2.0 -m "Description"
git push origin main --tags
```

## Pull Requests

Include:

- Summary of change
- Workflow modes tested (Capture / Review / Clinical Analysis)
- `npm run build` result
- Screenshots for UI changes

## Dev Mode

Append `?dev=1` to the URL to show CAE renderer debug overlay. Never enable `DEV_MODE` by default in production.

## Questions

Open a GitHub issue for architectural questions, bug reports, or roadmap discussion.

## Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [ROADMAP.md](./ROADMAP.md)
- [CHANGELOG.md](./CHANGELOG.md)
