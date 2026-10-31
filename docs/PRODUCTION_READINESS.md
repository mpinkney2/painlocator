# PainLocator Production Readiness Plan

**Status:** Engineering operating plan (aligned with commercial gates)  
**Date:** 2026-10-31  
**Companion:** [BUSINESS_AND_GTM.md](./BUSINESS_AND_GTM.md) (Grok commercialization mandate)  
**Baseline:** `main` at foundation + spatial anatomy work; product maturity = **early / pre-production clinical SaaS**

This document answers: *what must be true in the running product before PainLocator can be a clinic-trusted production tool*, and *in what order to build it* so hospital-system ambition does not skip the clinic beachhead.

---

## 1. Verdict on current state

PainLocator is a **strong clinical communication prototype**, not yet a production clinic system.

| Capability | Today | Production need |
|---|---|---|
| Patient marks pain on anatomy | ✅ Plates + Spatial locate | Keep; harden reliability |
| Capture / Review / Clinical workflows | ✅ Shipped | Keep progressive disclosure |
| JSON / PDF / PNG export | ✅ Client-side | Multi-view PDF; clinic branding |
| Demo Mode (fictional data) | ✅ Isolated storage | Keep forever for sales & training |
| Accounts / tenants / roles | ❌ | Required before real patients |
| Server sync / multi-device chart | ❌ | Required before clinician workflow |
| HIPAA BAA-capable architecture | ❌ | Required before paid pilots |
| EHR write-back / MyChart module | ❌ | Later; PDF attachment first |
| FHIR document export | ⚠️ On branch `cursor/clinical-queue-fhir-tools-48e7`, not `main` | Portable handoff only |
| Review queue / sign-off | ⚠️ On same branch, local only | Needed before EHR pitches |

**Commercial rule (from Grok plan):** do not collect real PHI and do not sell a clinic tenant until the paid-pilot gates below are green in product.

---

## 2. Production offer vs integration ambition

Build in three product stages that match the GTM offer ladder.

| Stage | Product name | Engineering outcome | Commercial use |
|---|---|---|---|
| **P0** | Demo / design-partner build | Stable Demo Mode, print path, disclaimers, no PHI hosting | Unpaid fictional demos only |
| **P1** | **Clinic Map** | Multi-tenant SaaS: auth, visit links, PHI store, audit, BAA-ready host, fileable multi-view PDF | Paid pilots → first revenue |
| **P2** | **Chart Complement** | Proven PDF filing SOP + clinician review state; optional FHIR DocumentReference export; later SMART launch | MyChart/Epic-adjacent, not “we are MyChart” |
| **P3** | **Service Line** | SSO, multi-site admin, security packet, support SLAs | Health-system pain service lines |

Hospital systems are **P3**. Clinics that still use paper body charts are **P1**. Do not invert that order.

---

## 3. Paid-pilot gates (must ship before revenue)

These mirror §6 of [BUSINESS_AND_GTM.md](./BUSINESS_AND_GTM.md). Engineering owns confirmation; marketing does not declare them green.

1. **Tenant isolation** — clinic / providers / patients are not one shared browser profile.
2. **Staff auth + expiring patient visit links** — front-desk tablet has explicit end-session wipe.
3. **PHI not only in shared `localStorage`** — physician opens the map on a different device than the patient.
4. **Encryption** in transit and at rest for PHI store.
5. **Audit log** of view / export / delete; clinic-exportable.
6. **Patient delete + export** documented and implemented.
7. **BAA-ready hosting + subprocessors** (counsel + ops; engineering supplies accurate data-flow diagram).
8. **Chart-grade PDF** — clinic name, visit date, identifiers clinic chooses, anatomy, region table, timeline, non-diagnostic disclaimer; no debug chrome.
9. **Front + back (minimum) in the filed artifact** — paper charts show both sides; one accidental view is not enough.
10. **Demo/fiction mode stays separate** from live tenants.
11. **Patient-visible copy review** (insights / peak-intensity wording) signed off by founder.
12. **Support path** (business-hours email minimum) documented.
13. **Cyber + tech E&O** is ops/legal — engineering supplies architecture description for the binder.
14. **Pilot scorecard hooks** — aggregate usage metrics without shipping PHI to marketing tools.

### Explicit non-gates for P1 (nice, not blocking single-provider clinics)

- Full physician review queue / sign-off UI (hard gate for **P2**)
- Live Epic / MyChart write-back
- Distinct pediatric / athletic / pregnancy anatomy plates
- Clinical-grade 3D / BodyParts3D as primary production atlas
- CAE npm package extraction

---

## 4. Engineering workstreams

### Workstream A — Stabilize the demoable clinical core (P0)

**Goal:** Every design-partner demo is truthful and calm.

| Item | Notes |
|---|---|
| Demo Mode reliability | Keep `painlocator_demo_entries` isolated; reset between prospects |
| Print / PDF path | Verify print CSS; disclaimer visible; document single-view limit until multi-view ships |
| Spatial + plate fallback | Spatial may remain default locate surface; plate path must always recover (`?plate=1` / Use 2D diagram) |
| Claim fence in UI | Keep **Assistive Clinical Observation — Not a Medical Diagnosis.** Never strengthen AI copy |
| Merge candidates from open branches | Evaluate `clinical-queue-fhir-tools` (queue + FHIR export + overlays) and mobile clinician-share for P0/P1 usefulness — merge only after conflict review against spatial `main` |
| Build always green | `npm run build` and `npm test` before milestone commits |

### Workstream B — Clinic Map backend & tenancy (P1)

**Goal:** Replace localStorage-as-database for real clinic use.

Recommended shape (CAE stays client-reusable; app gains a thin clinical service layer):

```
Patient device ──visit link──▶ PainLocator App (CAE)
Clinician device ──auth──────▶ PainLocator App (CAE)
                │
                ▼
        Clinical API (new)
         • Auth / roles
         • Tenants / visits
         • Encrypted session store
         • Audit events
         • Export jobs (PDF/JSON/FHIR document)
```

| Module | Responsibility | CAE boundary |
|---|---|---|
| Tenant & identity | Clinic org, providers, invite/remove | App (`src/features/` or new `src/services/`) — not engine |
| Visit sessions | Create link, expire, wipe kiosk | App |
| Session persistence | Store schema-versioned session JSON | Engine keeps schema; API stores blobs |
| Audit | view / export / delete events | App |
| Reporting | Multi-view PDF, clinic letterhead | Engine reporting + app clinic metadata |

**Do not** put clinic workflow, billing, or EHR credentials inside `src/engine/`.

### Workstream C — Chart-grade reporting (P1 → P2)

| Priority | Deliverable |
|---|---|
| P1 | Multi-view anatomy composite in PDF (front+back minimum) |
| P1 | Clinic letterhead / visit metadata fields |
| P1 | Remove prototype/debug from print surface |
| P2 | Clinician review / sign-off status on export |
| P2 | FHIR R4 document Bundle export (portable file — not live write API) |
| P3 | Server-side PDF if browser print is insufficient for enterprise |

Existing branch work (`fhir-export.js`, review queue) is a starting point for P2, not a substitute for tenancy.

### Workstream D — EHR complement (P2), not App Orchard day one

**First integration is operational, not API:**

1. Clinic MA files PDF where paper diagram is scanned today.
2. Document one SOP per EHR that beachhead clinics actually use (athena, eCW, Epic media/encounter, etc.).
3. Only after three clinics file PDFs under a BAA: design SMART on FHIR launch + DocumentReference write-back with a named engineering owner.

MyChart positioning: **appointment reminder / message carries a visit link; PDF returns to clinic**. PainLocator does not become a MyChart module until a health system explicitly builds that path.

### Workstream E — Anatomy & clinical credibility (parallel, non-blocking for P1)

Continue Spatial / BP3D work under existing phase docs, but:

- Do not sell “clinically validated 3D localization.”
- Keep plate fallback.
- Do not enable dermatome / referred-pain overlays in customer demos until datasets and clinical review exist.
- Pediatric / specialty models remain roadmap, not beachhead blockers.

---

## 5. Suggested implementation slices

Ordered for commercial pull without skipping trust.

| Slice | Outcome | Unlocks |
|---|---|---|
| **S0** | Demo hardening + claim fence audit + multi-view report design | Honest design partners |
| **S1** | Auth prototype (single clinic sandbox) + visit links + server session store | Internal dogfood with fictional PHI-shaped data |
| **S2** | Audit log, wipe, delete/export, encryption at rest | Counsel can review BAA packet |
| **S3** | Chart-grade multi-view PDF + clinic branding | Paid pilot artifact |
| **S4** | Merge/adapt review queue + FHIR document export | P2 complement readiness |
| **S5** | Admin: invite/remove users, export audit, support runbook | Pilot operations |
| **S6** | First EHR attachment SOP (no API) proven with one design clinic | Chart Complement narrative |
| **S7** | SMART / DocumentReference only when S6 + references exist | Health-system conversations |

---

## 6. Architecture principles that must not regress

From the engineering constitution and product vision:

1. **CAE remains reusable** — no PainLocator tenancy logic in `src/engine/`.
2. **Normalized coordinates (0–1)** — server stores the same schema; no duplicated mapping.
3. **Assistive only** — never diagnostic; label forever.
4. **Privacy by design** — analytics off by default; never send regions/notes to marketing beacons.
5. **Schema versioning** — every persisted session carries `schemaVersion`; migrations documented in `JSON_SCHEMA.md`.
6. **`npm run build` must pass** before milestone commits.

---

## 7. Definition of “production model app”

PainLocator is a **production model** for clinic use when:

- A patient can complete a visit link on a phone/tablet without training beyond a one-line MA script.
- A clinician can open that map on another device before or during the encounter.
- An MA can produce a front+back PDF and file it like today’s paper diagram.
- A BAA can be signed against a real architecture diagram.
- Demo Mode still exists for training and sales without touching live data.
- Public claims still say: not FDA-cleared, not an Epic partner, not a diagnosis tool.

It is **not** “production for hospital systems” until P3 gates (SSO, security packet, references, integration stance) are met. That is intentional.

---

## 8. Immediate engineering next actions

1. Treat this document + [BUSINESS_AND_GTM.md](./BUSINESS_AND_GTM.md) as the dual operating plan (build vs sell).
2. Audit current Demo Mode + print path against the 12-minute GTM demo script.
3. Decide merge strategy for `clinical-queue-fhir-tools` after spatial conflict review.
4. Draft S1 data-flow diagram (entities, what is PHI, where stored, subprocessors).
5. Do **not** stand up production PHI hosting until founder confirms legal entity + counsel budget (GTM §11).

---

## Related documents

- [BUSINESS_AND_GTM.md](./BUSINESS_AND_GTM.md) — Grok commercial operating plan
- [PRODUCT_VISION.md](./PRODUCT_VISION.md)
- [ROADMAP.md](./ROADMAP.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [JSON_SCHEMA.md](./JSON_SCHEMA.md)
- [REPORT_SPEC.md](./REPORT_SPEC.md)
- [ENGINEERING_PRINCIPLES.md](../ENGINEERING_PRINCIPLES.md)
