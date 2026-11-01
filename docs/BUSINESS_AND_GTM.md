# PainLocator Business & Go-To-Market Operating Plan

| | |
|---|---|
| **Owner** | Grok — commercialization (selling, marketing, partnerships, adoption) |
| **Founder** | Willis Pinkney — matt@prosperbusinessdepot.com |
| **Date** | 31 October 2026 |
| **Sprint window** | 2 November 2026 – 22 January 2027 |
| **Product baseline** | Early, pre-production clinical SaaS. Docs describe the **v0.1.0** foundation. `package.json` / changelog build is **5.5.0** (through 29 July 2026). Lead externally with “early clinical product,” never with “5.5” as if it were a mature major release. |
| **This document** | Operating plan. It is not a customer claim, a legal opinion, or evidence of FDA clearance, HIPAA certification, or an Epic partnership. None of those exist. |

**Mandate:** Grok owns commercialization execution; founder approves claims, price, and legal; engineering owns product gates.

Sell only what the repo can demonstrate today: a client-only pain-mapping web app on the Clinical Anatomy Engine. Patients and clinicians mark **where** it hurts, **how** it feels, and **how it changes**, then export a JSON session, a browser-print PDF, or a PNG snapshot. Session data stays in the browser (`localStorage`) unless someone exports a file. There are no accounts, no server sync, and no EHR write-back. Rule-based pattern notes are labeled **Assistive Clinical Observation — Not a Medical Diagnosis.**

---

## 1. Executive thesis (1 short paragraph)

Pain clinics still hand patients a paper body chart and a pen; PainLocator’s path to becoming the standard patient↔physician pain-communication tool is to replace that chart with a structured visual map and a fileable report, starting in independent pain practices that can say yes without a hospital committee, living beside MyChart, Epic, athenahealth, or eClinicalWorks as a complement, and only later becoming a health-system platform once tenants, a BAA, audit logs, and a real integration exist. The software that exists today is a demo-capable foundation, not production clinic SaaS, so Grok’s mandate is to earn design-partner pull and a precise price signal without collecting real patient data, without diagnostic claims, and without pitching an Epic listing or a cleared device we do not have.

---

## 2. Grok operating mandate (what Grok owns vs what founder/engineering owns)

Grok runs the commercial system. Willis remains the clinical voice, the relationship owner for people he already knows, and the person who approves claims, price, and legal commitments. Engineering decides how the product is built and when a gate is actually met. Grok does not ship code, sign contracts, or speak as a clinician.

| Grok owns | Willis owns | Engineering owns |
|---|---|---|
| ICP, target lists, and the rule for who is out of bounds | Whether a named clinician is approached, and every warm intro | CAE stays reusable (`src/engine/` has no PainLocator workflow) |
| Claim language drafts and the live talk track | Final approval of any sentence that leaves the building | What is actually on screen, including Spatial vs plate |
| Demo script, demo environment, and objection log | Showing up for the calls he chooses to take | Demo Mode staying isolated from real `localStorage` |
| Design-partner scope (unpaid, fictional data only) | Yes/no on each partner and on any use of his name | Readiness gates in §6; Grok does not declare them green |
| Pricing experiments and the flinch log | The price we are willing to invoice | No per-customer forks inside the engine |
| Pipeline, weekly scorecard, lost reasons | Entity, insurance, counsel, and signature | Auth, tenancy, audit, encryption, deletion |
| Partnership sequence and “not yet” replies to EHR vendors | Any public endorsement or society appearance | FHIR / PDF handoff design when that work is scheduled |
| First-draft MSA, BAA, and order-form checklists for counsel | Hiring counsel and accepting their edits | Subprocessor reality (what the host actually stores) |

**Grok’s weekly cadence**

- Monday: pipeline update (stages in §10). Empty stages stay empty.
- After every call: five lines — who, EHR if known, paper-diagram status, objection in their words, next step with a date.
- Friday: a ten-line note to Willis. Decisions needed are phrased as yes/no.
- No paid ads, no booth deposits, no marketplace applications, and no security questionnaire for a health system during this sprint.

**Grok does not**

- Promise FDA clearance, “HIPAA certified,” SOC 2, Epic App Orchard / Connection Hub / Showroom listing, or SMART on FHIR.
- Put real patient names, dates of birth, photos of marked paper charts, or clinical notes into email, Slack, feedback forms, or analytics.
- Tell a prospect the PDF is already their legal medical record. The report itself says it is patient-reported and not a physician assessment. The clinic files it the way they file the paper drawing.
- Demo dermatomes, myotomes, referred-pain overlays, or “suggested structures” as clinical features. Those are UI hooks; the datasets are not shipped.
- Treat BodyParts3D or the Spatial view as a finished, clinically validated anatomical model. Spatial is the current default locate surface and still falls back to plates. The prototype BodyParts3D pack is not the production Spatial model. Commercial use of any CC BY assets keeps the required attribution; counsel confirms that before a paid launch. Grok does not make the attribution claim in a sales deck.
- Use expert-witness or medico-legal interest as a logo, a channel ad, or a claim that the map proves injury, malingering, causation, or an impairment rating.

**How Grok and engineering sequence work**

Commercial pull does not jump the roadmap. The only engineering requests Grok will make in this sprint are blockers to a truthful demo (print path, demo isolation, disclaimer visibility) and the ordered gate list in §6. Spatial anatomy work continues under engineering’s plan. It is not the offer we sell.

---

## 3. ICP and beachhead (who to sell first; why not hospital system day 1)

### Beachhead

**Independent and small-group pain medicine practices in the United States: 1–8 physicians, owner or managing partner on site.** Interventional pain, spine-focused pain, and PM&R practices whose new-patient or follow-up packet still includes a body outline.

| | Beachhead clinic |
|---|---|
| **Buyer** | Practice owner or managing physician. Office manager is the blocker or the champion for “how does this get into the chart,” not the economic buyer. |
| **Users** | Patient (before the visit or in the waiting room), MA or front desk (starts the session and files the PDF), physician (looks at the map during the history). |
| **Job** | Replace the scribbled diagram with a map the patient can complete and the physician can re-open next visit, then file the same artifact they already scan. |
| **Trigger** | They are proud of the medicine and embarrassed by the paper. A new-patient packet PDF on their website that still contains a blank body outline is the best public signal. |
| **Economic fit** | A few hundred dollars a month can be approved by the owner. A hospital IT project cannot. |
| **Geography** | Where Willis can sit in the clinic. Remote demos are allowed; the first three design partners should be reachable without a national campaign. |

### Who is explicitly out of the first list

- Hospital departments and IDN pain service lines (separate “later” list; no outreach this sprint).
- Any practice whose diagram already lives inside a tool they like (ask before pitching; Phreesia and similar intake products are the usual surprise).
- Chiropractic and wellness brands. The positioning would slide toward a consumer gadget.
- Pediatric practices. Child, teen, and senior models still reuse adult-male plates. Athletic, bariatric, and pregnancy models are placeholders.
- Plaintiff or defense firms. See §9. The buyer is a physician, if anyone.
- Direct-to-consumer “pain diary” as the business. A localStorage app on a personal phone is a demo, not retention.

### Why a hospital system is the wrong first sale

A chief of pain management is a design witness and, later, a champion. A chief is not a closed enterprise contract.

| A health-system deal requires | What exists today |
|---|---|
| Named production tenant, user provisioning, deprovisioning | One browser profile, `localStorage` |
| BAA and a security review that matches the architecture | No BAA is offered. Shared-PC localStorage is not a clinic deployment. |
| Often a SIG / CAIQ, pen test, and a hosting BA | Feedback can optionally POST to a server; analytics exist and default off. That is not a PHI platform. |
| Epic (or Cerner/Oracle Health) integration owner and a place the artifact lands | Roadmap: EHR/FHIR is long-term. No write-back. |
| 3+ referenceable clinics | Zero |
| CMIO, compliance, supply chain, and a physician champion aligned | One “no” from security becomes a file we have to explain for years |

Starting there spends the chief’s credibility on a questionnaire we would have to answer “no” to. The complement story (§4, rung 2) is how that chief’s clinic eventually uses PainLocator **inside** Epic: the chart stays Epic; the map replaces the paper diagram. That pitch waits for the gates in §6.

### Discovery questions on every call

Ask these before describing features. Write the answers down.

1. When a new patient tells you where it hurts, what do they touch — paper, a tablet intake, or nothing?
2. May we see a **blank** copy of that form? (No handwriting, no stickers, no photos of real charts.)
3. Who files it, and where does it land in the chart?
4. Which EHR do you actually document in?
5. What do you pay for intake or PROMs (Phreesia, PROMIS tablet, other), and does that tool’s body click replace the paper or sit beside it?
6. If the map were a PDF your MA uploaded the way they scan paper, would you use it next month, or do you need it launched from the EHR before you would try?
7. Who else has to say yes?

If the answer to 6 is “EHR launch or nothing,” park them on the later list. They are a future complement customer, not a beachhead design partner.

---

## 4. Offer ladder (standalone clinic SaaS → MyChart/Epic complement → health-system platform)

Three rungs. We are standing **below** rung 1 until the paid-pilot gates are green. This sprint sells rung 0 only.

| Rung | Name | Buyer | What they get | What we refuse to imply |
|---|---|---|---|---|
| **0 — now** | Design-partner working session | Beachhead physician | 20–40 minutes on **Demo Mode** fictional scenarios (Post-procedure, Lower-back, Sports injury). Side-by-side with their blank paper form. Written notes on what would have to be true for their MA to file a PDF. | Real PHI on our side. A pilot. An integration. A diagnosis. |
| **1 — first revenue** | **Clinic Map** (standalone clinic SaaS) | Same buyer, after §6 pilot gates | Clinic tenant, provider logins, patient visit link, front-desk wipe, PDF + PNG + JSON, BAA, a one-page “file it like the paper” SOP for whatever EHR they have | Write-back. SMART launch. “We are in Epic.” Multi-site SSO. |
| **2 — after references** | **Chart Complement** (MyChart / Epic and other EHRs) | Clinic that already lives in Epic, athena, or eCW and has used Clinic Map | Everything in Clinic Map, plus a written SOP for the attachment path that clinic’s analysts actually use (media tab, encounter document, MyChart message with PDF). Later, and only when built: SMART on FHIR launch and FHIR DocumentReference. | That MyChart is our module. That a listing exists. That the PDF writes itself into Hyperspace. |
| **3 — after security packet + references** | **Service Line** (health-system platform) | IDN pain service line, with a physician champion and an IT sponsor | Multi-site admin, SSO, audit export, training, named support, BAA, implementation, the handoff that rung 2 proved | A diagnostic module. Replacing the EHR. A date for FHIR that engineering has not committed. |

**Rung 1 workflow we are willing to describe as the product intent** (not as shipped behavior): the patient marks location, intensity, and quality before the visit; the physician opens the same map; the MA exports the PDF and files it where the paper diagram goes today; the next visit starts from the prior map instead of a blank outline. Timeline and structured regions are the difference from paper. The clinician still examines the patient and still writes the assessment.

**Rung 2 sentence, used only when they ask about Epic or MyChart:**

> You keep Epic. The map is the diagram your patient already draws. Today’s product does not launch inside Hyperspace and does not write back. The fileable output is a PDF your staff attaches the way they scan the paper sheet. A MyChart-adjacent flow — link in the reminder, PDF back to the clinic — is the complement we will design after clinics are filing that PDF on purpose. It is not built.

**Rung 3 is not quoted in this sprint.** If a system sends a security questionnaire, Grok replies that we are pre-production, declines the review, and asks for a physician who will do a fictional demo. A rejected review is a permanent artifact. We will not create one with a localStorage architecture.

---

## 5. Regulatory & trust posture (HIPAA BAA path, SaMD vs wellness/clinical-decision-support framing, disclaimers, malpractice/expert-witness adjacent use carefully)

Operating posture for Grok and Willis. **Counsel confirms before any paid agreement, any BAA, or any change to intended use.** This section is not a legal opinion and not a determination that any FDA exemption applies.

### Facts we state when asked

| Topic | True statement |
|---|---|
| FDA | PainLocator is **not** FDA-cleared, approved, or registered as a medical device. We do not claim a 510(k), De Novo, or exemption as a settled fact. |
| HIPAA | There is **no** HHS “HIPAA certification,” and we will not say “HIPAA certified” or “HIPAA compliant” as a badge. No BAA is offered today. |
| Epic | We are **not** in App Orchard, Connection Hub, Showroom, or any Epic partner program. |
| Intended use we will defend | A communication and documentation aid for **patient-reported** pain location, intensity, quality, triggers, and change over time, for a licensed clinician to review. |
| What the patient entered | Subjective report. It is not an exam finding, a localization of a lesion, or a measure of impairment. |

### Claim fence

| Allowed | Forbidden |
|---|---|
| “Shows where the patient says it hurts, in a form you can file.” | “Diagnoses the cause of pain.” |
| “Assistive Clinical Observation — Not a Medical Diagnosis.” | “AI reads the body” or “clinical decision support” as a slogan |
| “Replaces the paper diagram, not the physician.” | “Proves injury, malingering, or causation.” |
| “You keep your EHR; staff file the PDF.” | “Epic-integrated,” “MyChart app,” “writes back to the chart.” |
| “Early product. Design partners use fictional cases until a BAA and tenant exist.” | “HIPAA certified.” “FDA cleared.” “SOC 2.” |
| “Pattern notes summarize logged entries (average intensity, most frequent mark, common trigger, peak ≥ 8).” | “Triage,” “alerts your doctor,” “detects radiculopathy,” treatment advice |
| “The clinician remains responsible for the assessment.” | Any sentence that creates a physician–patient relationship with PainLocator or with Willis |

Shipped wording to keep aligned with the UI and the report, not to paraphrase into something stronger:

- On-screen label: **Assistive Clinical Observation — Not a Medical Diagnosis.**
- Peak note, when a logged intensity is ≥ 8: “Peak intensity N/10 was logged. Worth reviewing with a clinician.”
- Report lines include: patient-reported content only; not a diagnosis, medical record, or physician assessment; observations summarize recorded entries and are not a medical diagnosis; the document does not replace professional medical evaluation.

Before any waiting-room pilot, counsel and Willis review whether “Worth reviewing with a clinician” stays clinician-facing. It must not read as the software directing emergency care.

### SaMD, CDS, and why “wellness app” is the wrong shelter

The current product records and displays what a person logs, then prints simple counts and averages over those logs. That is the documentation posture we sell.

FDA device status depends on **intended use**, not on our preference. Non-device clinical decision support under the 21st Century Cures Act (FD&C Act §520(o)(1)(E)) is a narrow set of criteria for certain software that supports or recommends prevention, diagnosis, or treatment to a health care professional and lets that professional independently review the basis. Grok will not tell customers we already sit in that safe harbor. Counsel maps intended use before we add recommendations.

These moves are **out of bounds** unless counsel and a quality plan explicitly take them on. They are also out of the sales story:

- Suggesting structures, dermatomes, myotomes, or referred-pain fields as findings (hooks exist; datasets do not).
- Language such as “likely radiculopathy,” “consistent with,” or treatment suggestions.
- Analyzing medical images or signals.
- Autonomous patient alerts that function as triage.
- Impairment ratings, IME opinions, or causation statements.

Calling the product a general-wellness app to avoid FDA, while selling it to pain clinics as a clinical tool, is inconsistent and creates FTC and liability problems. The category we use is **patient-reported communication and documentation**. If a future version’s intended use is a device, the path is a real regulatory program (quality system, submission if required), not a new slogan.

### HIPAA and the BAA path

A clinic that puts patient identity together with a pain map is handling PHI. PainLocator becomes a business associate when we create, receive, maintain, or transmit that PHI for the clinic. A static demo where data never leaves the user’s browser is not a BAA program. It is also not an acceptable production deployment: a shared front-desk browser with `localStorage` mixes patients and is invisible to the physician on another computer.

| Stage | When | Commercial rule |
|---|---|---|
| **0 — now** | This entire 90-day sprint | No BAA. Demos use Demo Mode only (`painlocator_demo_entries` stays separate from real entries). Do not put the app on a clinic kiosk. If a clinician emails real PHI, delete it, reply that we cannot receive it, and do not continue the thread with the content. Leave analytics off. Do not point feedback at a webhook for commercial demos. The optional `/api/feedback` path and any host access logs are reasons to treat “we have no server” as false comfort. |
| **1 — before any paid pilot or any real patient** | Gates in §6 | Legal entity identified. Counsel-reviewed privacy policy, clinic MSA, patient terms, and BAA. Every subprocessor that can access PHI has a BAA — confirm the **current** hosting plan in writing; do not assume today’s Vercel project is eligible. Encryption in transit and at rest, access control, audit of view/export/delete, backup, retention, deletion, incident process. Workforce rule: support does not need to read pain maps to do the job. Cyber and tech E&O bound. Risk analysis started under the HIPAA Security Rule. Say “we sign a BAA and maintain safeguards,” and describe the actual controls. |
| **2 — before a health-system security review** | After rung 1 references | Architecture and data-flow one-pager that matches production, pen test or a dated engagement, audit export, SSO, deprovisioning, subprocessor list, incident one-pager. SOC 2 is a likely later ask. It is not a beachhead requirement and is not promised for this sprint. |

Minimum necessary applies to us too. Marketing, analytics, and model training do not receive pain maps, notes, or identifiers. The product already intends analytics to exclude clinical content and to default off. Keep that invariant when a tenant exists.

### Malpractice and expert-witness-adjacent use

Willis’s conversations with pain-management expert witnesses and a chief of pain management are **discovery**: they are evidence that paper diagrams are still normal. They are not an endorsement, a design-partner logo, or a channel.

Paper pain diagrams already show up in consult notes and sometimes in independent medical examinations as **what the patient marked**. PainLocator can aim to be a cleaner version of that form. The examining or treating physician remains the author of any clinical or expert opinion.

| Permitted use | Not our product |
|---|---|
| Contemporaneous patient-reported map, like a pain diary or paper diagram | Proof of injury or of symptom magnification |
| A physician expert chooses to use the form while they examine | PainLocator, Willis, or Grok as the expert |
| Clinic files the PDF in the chart they already keep | “Medico-legal grade,” “court-ready,” “admissible” as a feature |
| IME physician wants a consistent blank for patients to mark | Impairment rating, AMA guide automation, causation report |

We do not sponsor law-firm marketing, plaintiff or defense. We do not white-label the product as a litigation tool. An expert who wants early access follows the same design-partner rules as a treating clinic: fictional data until stage 1 safeguards exist, same disclaimer, no co-branded opinions.

Clinic malpractice coverage stays with the clinic. Our exposure is product, privacy, and errors-and-omissions. Terms must say the clinician is responsible for the assessment, the data are patient-reported, and there is no warranty of diagnostic accuracy. Counsel writes that; Grok does not freelance it in email.

---

## 6. Product readiness gates for revenue (must-have before paid pilots; must-have before EHR partnership pitches)

Grok may not invoice, may not accept a verbal “send the BAA,” and may not book an EHR vendor meeting until the relevant column is true **in the running product**, confirmed by engineering. Slides do not clear gates.

### Sell only this, until the gates move

| Demoable now | Say it is in progress or absent |
|---|---|
| Capture, Review, Clinical Analysis | Accounts, roles, review queue, sign-off |
| Patient-reported regions, intensity, quality, triggers, notes; browser speech dictation where the browser supports it | Server sync, multi-device chart for the physician |
| Recovery timeline | Multi-view PDF composite (report is the **current view** only; layout depends on the browser’s print dialog) |
| JSON session export/import; PNG snapshot; browser-print PDF | Server-side PDF, digital signature, FHIR |
| Demo Mode with three fictional scenarios and a guided walkthrough | Real-patient pilot hosting |
| Adult male and adult female plates; front, back, left, right views | Distinct child, teen, senior, athletic, bariatric, pregnancy anatomy |
| Rule-based pattern notes and the disclaimers in §5 | ML, LLM, diagnosis, treatment recommendations |
| Spatial locate as the current default interaction, with plate fallback | “Clinically validated 3D,” production BodyParts3D, FMA-complete anatomy |
| Light/dark theme; feedback form with local fallback | A clinic-branded, debug-free, multi-patient production service |

Known report limits to say **before** a physician discovers them: one anatomy view per print, no signature line, browser-dependent PDF, pattern notes are rules over logged entries, and the report is not itself the legal chart.

### Must-have before a paid pilot (rung 1)

All of these. A missing row means the offer stays rung 0.

1. **Tenant isolation.** A clinic, its providers, and its patients are not one shared browser profile.
2. **Staff authentication** and a patient **visit link** that expires. Front-desk tablet has an explicit end-session wipe.
3. **PHI is not stored only in shared `localStorage`.** The physician can open the patient’s map on a different computer from the one the patient used.
4. **Encryption** in transit and at rest on the system that holds PHI.
5. **Audit log** of view, export, and delete; the clinic can export that log.
6. **Delete and export** of a patient’s session, written into the order form (who can request it, and how fast).
7. **BAA signed** with the clinic and with subprocessors; Security Rule risk analysis started; privacy policy and MSA reviewed by counsel.
8. **PDF a physician will put in a chart:** clinic name, the identifiers the clinic chooses to include, visit date, anatomy image, region table, timeline, the non-diagnostic disclaimer, no debug or engine-version trivia, no “prototype” badge.
9. **Front and back** (at minimum) captured on purpose and visible in the filed artifact. A single accidental view is not a replacement for the paper sheet, which shows both sides.
10. **Demo/fiction remains a separate mode** and cannot merge into a live clinic tenant.
11. **Copy review** of every patient-visible insight, including the peak-intensity sentence, completed and signed off by Willis.
12. **Support expectation in writing** (business-hours email is enough) and a named human.
13. **Cyber + tech E&O** bound, entity that signs is the entity on the invoice.
14. **Pilot scorecard** from §10 agreed in the order form, including the rule that we stop if PHI shows up through a side channel.

Physician review queue and sign-off are on the medium-term roadmap. They are not in the hard gate above because a single-provider clinic can review the map in person. They **are** a hard gate for rung 2. Do not describe a queue as if it exists.

### Must-have before an EHR partnership pitch

A “pitch” means asking Epic, Oracle Health, athenahealth, eClinicalWorks, or a health-system integration team for a technical evaluation, listing, or build slot. Answering a physician’s question “does it work with Epic?” with the rung-2 sentence in §4 is not a pitch.

1. At least **three** clinics have finished a scoped pilot and will take a reference call.
2. Security packet matches production: data flow, subprocessors, BAA, incident one-pager, access control, and a pen test or a signed engagement.
3. A one-page **integration stance** engineering will stand behind: what is buildable first (PDF attachment SOP already proven in those clinics) and what is not scheduled (SMART launch, DocumentReference write-back). Roadmap language in `docs/ROADMAP.md` already marks EHR/FHIR as long-term. The pitch uses the engineer’s current commitment, not the long-term bullet.
4. **Session schema compatibility** promised to customers (schema is versioned in product; the commercial promise is still unwritten).
5. **Clinician review state** on the artifact that would land in the chart (roadmap: review queue and sign-off). A patient-exported file alone is a weak thing to ask an EHR vendor to ingest.
6. **Multi-view report** so the attachment shows the body the way the paper form does.
7. Admin: invite user, remove user, export audit.
8. Named engineering owner and a Monday-morning SOP the clinic analyst can follow.
9. Public claim remains: we are not listed and not a partner.

---

## 7. 90-day GTM sprint (week-by-week actions Grok would drive: outreach, demos, pilots, content, pricing experiments)

Window: **Monday 2 November 2026 through Friday 22 January 2027.** US clinic calendars go dark around Thanksgiving (26 November), Christmas, and New Year’s. Weeks 4, 8, and 9 are internal on purpose. A week with zero external meetings is a valid result if the calendar says so.

**Sprint targets (outcomes, not activity theater)**

| Signal by 22 January 2027 | Target |
|---|---|
| Named beachhead clinics on the list, with source URL | 40 |
| Personalized first touches Willis has approved | 20 |
| Conversations held with a pain physician or the person who owns the paper form | 10 |
| Blank paper diagrams collected | 8 |
| Design partners who completed 3 sessions | 3 |
| Paid pilots or invoices | **0** (expected until §6 is green) |
| Real PHI received by us | **0** |
| Price card shown to every design partner | 100% of partners |
| Claim sheet approved by Willis | Yes |

If week 7 ends with fewer than five conversations, stop adding cold names. The next sprint uses only warm introductions. Widening to hospital systems is not the recovery move.

### Demo rules (every week)

- Use **Demo Mode** only. Scenarios already in the product: Post-procedure, Lower-back, Sports injury. Reset demo between prospects.
- Prefer the Lower-back scenario for pain clinics. Let them drive the pointer if they will.
- Rehearse Spatial boot **and** the plate path (`?plate=1` / “Use 2D diagram”) before the first external demo. If Spatial fails, continue on plates without apologizing into a 3D roadmap speech.
- End on the **print preview**. Read the disclaimer aloud. State the single-view limit.
- Do not open overlay toggles for structures, referred pain, dermatomes, or myotomes.
- Do not use `?dev=1`.
- Time box: **12 minutes of product**, then their paper form, then the ask.

**12-minute spine**

| Minute | Move |
|---|---|
| 0–1 | “Clinics still use a paper outline. This is a structured version of that drawing. It does not diagnose.” |
| 1–5 | Their hands: mark a region, set intensity, save. Patient path if the shell is in front of them (locate → describe). |
| 5–7 | Review: timeline for that fictional scenario. |
| 7–10 | Open the clinical report. Show anatomy image, region table, disclaimer. |
| 10–12 | Stop sharing. Ask what their MA would do with that PDF tomorrow. |

**Ask at the end of a good call:** unpaid design partner, eight weeks, fictional cases only, 25 minutes a week, they show us a blank form, we do not take patient data. Or a clean no.

### Week 1 — 2–8 November — stand up the system

- Draft the one-page claim fence from §5 and send it to Willis for line edits.
- Open the pipeline sheet (stages in §10). Columns: clinic, city, physician, role, source URL, paper-diagram found (Y/N), EHR if public, last touch, next step, objection, stage.
- Write the target-list method: independent pain practices; skip hospital department pages; prioritize clinics that publish a new-patient PDF containing a body outline.
- Write the 12-minute script above against the current build. Run it once alone, including a print preview.
- Send Willis the eight-question guide for the chief and the expert witnesses (§11). Grok does not email them.
- Draft the 120-word outreach note (below) and hold it.

**Outreach note (founder voice, Willis edits before anyone sends it):**

> Subject: The body chart and the pen
>
> Dr. [Name] — I’m Willis Pinkney. I built PainLocator after seeing, including from pain physicians, how often the “where does it hurt” step is still a paper outline.
>
> It is a visual map: the patient marks location and intensity, and the clinic can print a one-visit report. It is a communication and documentation aid. It is not a diagnosis, and it is not connected to Epic or any EHR.
>
> I am not asking you to install it. I am asking for 20 minutes to mark a fictional case and to look at your blank form beside it, so I can see where it would fail in your clinic.
>
> — Willis
> matt@prosperbusinessdepot.com

No attachments. No screenshots of real anatomy marks. No “AI-powered.”

### Week 2 — 9–15 November — list and first ten

- Build 40 rows. At least 15 should have a public blank diagram or a new-patient packet URL. Record EHR only when the site states it.
- Willis approves the first 10 names. Grok sends those 10 from his confirmed address, or Willis sends them himself. One physician per clinic. No mail-merge voice.
- Book on two specific times. Qualification line if they reply “we’re on Epic”: use the rung-2 sentence and still offer the fictional session.

### Week 3 — 16–22 November — hold calls

- Target: first conversations happen this week. Cap at two a day so notes actually get written.
- Every call ends with a next step dated, or a lost reason from §10.
- Collect blank forms. Store them in a folder labeled “blank templates,” never “patient charts.”
- Log EHR mix. This decides which complement SOP matters later. It does not start an integration.

### Week 4 — 23–29 November — Thanksgiving internal week

- No new cold email Thursday–Sunday. Monday–Wednesday: finish notes and hold only calls already booked.
- Code objections into a short list: paper already gone, intake vendor good enough, Epic-or-nothing, patients won’t do it, price fear, “is this a device?”, no time, wrong specialty.
- Update the demo script with the two objections we actually heard. Feature requests go to a parking lot Willis and engineering can ignore until gates are the priority.

### Week 5 — 30 November–6 December — second ten, biased

- Send the next 10 only in the segment that responded (for example interventional spine with a public packet, if that is what week 3 showed).
- If warm intros exist, they replace cold names one-for-one. Warm first.
- Start the design-partner email scope for anyone who already said yes: unpaid, fictional data, 25 minutes weekly, eight weeks, they may stop anytime, we will not accept PHI, success is “your MA can explain the PDF,” not a testimonial.

### Week 6 — 7–13 December — three partners and a price card

- Convert up to three design partners. If only one is real, do not pad with friendly non-buyers.
- Session 1 agenda: they mark; we watch; we do not pitch.
- Show the three price cards in §8 as **hypotheses**. Ask what they pay for intake and for dictation. Record the flinch and who signs the check.
- Grok prepares the counsel scope (intended use, when a BAA is triggered, disclaimer, IME language, entity) so Willis can send it when he is ready. No counsel spend without his number.

### Week 7 — 14–20 December — MA test and content

- Session 2: an MA or front-desk person completes a fictional capture and finds the PDF without Grok driving. If they cannot, the offer is not ready to describe as “staff files it,” and the notes say so.
- Draft, for Willis’s voice, a single long post: he was the patient; a chief of pain still had paper; what he is building; the disclaimer in the same piece. Publish only if he wants his name on it. Grok does not post as Willis.
- Draft the MA script card (quarter page): “This replaces the paper drawing. It does not diagnose. Mark where it hurts. We print it into your chart.” Hold the card until a real pilot exists. Design partners may react to the wording.

### Week 8 — 21–27 December — holiday internal week

- No new outreach.
- Pricing debrief: if most partners flinch at the clinic anchor, write the revised card. Do not publish a public price page.
- Hand engineering a single ordered gap list: the §6 paid-pilot gates, top to bottom, with demo blockers separated from tenant work. One list, not a roadmap rewrite.
- Request cyber / tech E&O quotes only if Willis has approved the broker conversation.

### Week 9 — 28 December–3 January — holiday internal week

- No outreach. Clinics are not buying.
- Prepare the education list for week 10 (names only, no send): fellowship program directors and one society education contact. Channels in §9.
- Write the complement SOP as a one-pager with a banner: **Attachment workflow we can coach. Write-back not built.** Include Epic media/encounter language only as staff instructions they must verify locally, plus the same idea for athena and eCW if those EHRs showed up in the pipeline.

### Week 10 — 4–10 January — resume, teach, don’t sponsor

- Send five education asks: a 20-minute “paper diagram” teaching demo for residents or a society webinar slot. No booth, no sponsorship check.
- Third design-partner session: “Would you pay the anchor price the month a BAA and a real tenant exist, and what would you need to see that month?”
- Re-rank the 10 clinics most likely to be paid pilot #1 **when** gates are green. Ranking criteria: champion is the owner, paper is still in use, they completed a session with their own hands, EHR objection is “we can attach a PDF.”

### Week 11 — 11–17 January — kill or keep

- Pipeline review with Willis (30 minutes). Lost reasons required on every dead row.
- If the modal answer is “call us when it is in Epic,” document that the beachhead message failed or the ICP is wrong. Do not open an Epic vendor application this week.
- If three partners are active and the price range is coherent, pre-write the paid-pilot order form **as a draft for counsel**, with the §10 success and stop rules. Do not send it to a clinic.

### Week 12 — 18–22 January — decision memo

Deliver a three-page memo to Willis:

1. What physicians actually use for the diagram (paper, Phreesia, EHR scribble, nothing).
2. EHR mix and the exact words they used about Epic.
3. Price range and who holds the card.
4. Whether the beachhead stands (recommendation: narrow or hold; hospital systems stay closed).
5. Which §6 gates are still open.
6. The ten clinics, in order, that may be invited to a paid pilot **after** gates, and the sentence we will use.
7. Go / no-go on a second 90 days of outreach.

No new channel in week 12.

---

## 8. Pricing & packaging hypotheses (clinic seats, per-provider, enterprise)

These are experiments to say out loud to design partners. They are not a public price list and not a quote. Paper is approximately free. The alternative that matters is the intake tool they already pay for, or the two minutes of MA time to scan a diagram. We do not show an ROI spreadsheet with invented minutes saved. The pilot measures behavior; the price test measures flinch.

**Recommended anchor to say first:** Hypothesis A. If four of five buyers flinch before feature objections, the next conversation uses Hypothesis B. Do not average them into a third number on the call.

| | Hypothesis A — clinic seat (say this first) | Hypothesis B — per provider | Hypothesis C — enterprise (do not quote this sprint) |
|---|---|---|---|
| **Who** | 1–6 provider independent pain clinic | Same, if they buy software per doctor | Pain service line, 15+ providers, IT involved |
| **Price** | **$349 per clinic / month**, includes 2 provider seats; **+$99** each additional provider | **$129 per provider / month**; annual prepay at **$99 per provider / month** ($1,188 / provider / year) | **$25,000** implementation, then **$89 per provider / month**, annual only, floor 15 providers |
| **4-provider example** | $349 + $198 = **$547 / month** | $516 / month, or $396 / month annual | Not offered |
| **Includes** | Visit links, provider login, PDF/PNG/JSON, BAA, business-hours email, “file the PDF” SOP | Same | SSO, admin, audit export, security-review support, training, named contact, handoff that actually exists |
| **Excludes** | EHR API, SSO, custom anatomy, on-site training, diagnosis | Same | Diagnostic claims, custom SaMD work, a date for an unbuilt integration |
| **When it can be invoiced** | After §6 paid-pilot gates | After the same gates | After §6 EHR-pitch gates and a real security packet |

**Paid pilot (only after gates):** 50% of the chosen hypothesis for 90 days, maximum eight clinics, then full price or end. No perpetual free, no “we’ll comp it if you give us a logo.” Design partners in this sprint stay at **$0** and do not receive a production tenant.

**Annual Clinic Map:** two months waived on Hypothesis A ($3,490 for the base 2-seat clinic, plus add-on providers at 10× $99). Offer annual only after a monthly pilot, not before.

**Packaging names**

| Package | Rung | Commercial shape |
|---|---|---|
| Design partner | 0 | $0, time-boxed, fictional data, no SLA |
| Clinic Map | 1 | Hypothesis A or B |
| Chart Complement | 2 | Clinic Map price **+$50 per provider / month** once we are actually coaching an EHR-specific filing SOP and audit export is live. Do not charge the plus until that SOP has been used on real (properly covered) visits. |
| Service Line | 3 | Hypothesis C |

**Will not price**

- Per-map or per-click fees (they punish the behavior we want).
- Percent of collections.
- A patient-paid consumer subscription.
- Data licensing, model training on clinic data, or ads.
- A different price for “medico-legal mode.” There is no such mode.

**What the pilot order form measures, so price has a denominator**

A 90-day Clinic Map pilot at one site is successful only if all of the following are true, using counts the clinic is willing to share as aggregates (no PHI sent to Grok):

- In a pre-agreed half-day clinic, at least **60%** of new visits where they would have used the paper diagram instead have a completed map.
- The physician reports, weekly, whether they looked at the map during the visit, target **at least half** of those mapped visits.
- An MA files the PDF without a PainLocator person in the room, demonstrated twice.
- Zero PHI incidents and zero diagnostic-claim incidents.
- They can name the person who would approve the undiscounted invoice.

Miss on the first or second bullet: the workflow failed, and we do not “save” it with a discount. Miss on safety: stop the pilot.

---

## 9. Partnership playbook (Epic App Orchard / Connection Hub, MyChart-adjacent workflows, pain societies, residency programs, med-mal / IME channels)

Sequence is the strategy. Every row below is **later than a design partner**, except the teaching conversations in weeks 10–11, which are educational and use fictional data.

### Epic App Orchard / Connection Hub

Epic’s historical app program was App Orchard. Current vendor-facing and customer-facing programs are referred to as Connection Hub and Showroom. We are in none of them. Grok will use those names accurately and will not abbreviate our status into “Epic partner.”

| Step | What Grok does | Gate |
|---|---|---|
| 1 | Learn, from beachhead clinics, the EHR mix. Expect athenahealth, eClinicalWorks, AdvancedMD, DrChrono, and Epic-employed outliers. | Weeks 3–7 notes |
| 2 | For any Epic clinic that still wants a conversation, offer rung 0 only. Describe PDF attachment as staff work they already do for paper. | Rung-2 sentence |
| 3 | After three clinics are filing PDFs under a BAA, ask **one** friendly analyst where a PDF is stored (media, encounter document, or elsewhere). Watch; do not build. | §6 pitch gates started |
| 4 | Apply to Epic’s vendor program only with a security packet that matches production and an app that can survive a review. | §6 pitch column fully green |
| 5 | Integration order, when engineering schedules it: clinician-reviewed PDF first, then SMART on FHIR launch for context, then FHIR DocumentReference write. | Engineering commitment, not this plan |

A Showroom listing is a consequence of a working complement, not a lead-gen tactic. Do not pay for a listing motion in this sprint. Do not tell the chief we are “going into Epic” this quarter.

**MyChart-adjacent workflow (direction, not a feature):**

1. Now: patient completes a fictional map in a demo; staff see a PDF.
2. Clinic Map: appointment reminder contains a visit link; patient completes the map; MA downloads the PDF and attaches it. MyChart is not involved.
3. Later complement: the same link is the thing staff paste into an existing MyChart message or questionnaire process the health system already approves. We do not become MyChart.
4. Much later: Epic-integrated questionnaire or SMART launch, if and when step 4 above is real.

If a clinic’s analysts forbid outside links, that clinic is not a rung-1 customer. Park them.

**Other EHRs.** Same playbook, likely sooner than Epic for this beachhead. One filing SOP per EHR that design partners actually use. Zero APIs until the PDF path is a habit. Grok will not start three marketplace listings.

### Pain societies

Useful societies for **education**, not for a booth budget: American Academy of Pain Medicine (AAPM), American Society of Interventional Pain Physicians (ASIPP), North American Neuromodulation Society (NANS), American Society of Pain and Neuroscience (ASPN), American Society of Regional Anesthesia and Pain Medicine (ASRA Pain Medicine). Confirm the right education contact; do not buy a mailing list.

Offer: 20 minutes, fictional case, “why the paper diagram fails the second visit,” disclaimer slide in the first three minutes. No exhibit-hall contract in the next 90 days. A webinar slot is enough.

### Residency and fellowship programs

PM&R residencies and pain fellowships (anesthesiology-based and PM&R-based) are the adoption path that outlives a single clinic champion. A fellow who learned on a fictional teaching file takes the habit to the first job.

Offer a program director: one noon conference, Demo Mode, no patient data, no recruitment pitch in the first ten minutes. Leave a one-page “what this is / what this is not.” Do not provide a shared login on the current build for a call room full of trainees — that is the shared-browser problem. Teaching is screen-share until tenants exist.

Success for this channel in the sprint: **two** program directors accept a date, or a clear no. Not a curriculum rewrite.

### Med-mal and IME channels

The economic buyer, if this channel ever exists, is the **examining physician**, not the law firm and not the insurer’s marketing team.

| Do | Do not |
|---|---|
| If an IME physician asks, run the same design-partner rules and the same disclaimer | Advertise to plaintiff or defense counsel |
| Describe the output as a patient-marked diagram the expert may choose to attach to **their** report | Claim admissibility, scientific validity, or bias detection |
| Keep Willis’s expert-witness conversations in the discovery log, with permission | Name those experts in any public material |
| Let counsel read any case-study sentence before it is saved | Publish “used in litigation” stories |

A firm that wants a white-label “litigation pain map” is a decline. It pulls intended use toward expert-opinion software and will contaminate the clinical brand.

### What Grok will say to every partner type

One paragraph, then stop:

> PainLocator is an early visual record of where the patient says it hurts, built to replace the paper body chart. Clinicians keep their EHR and their judgment. We are not a diagnostic device, we are not FDA-cleared, we are not an Epic partner, and we do not take real patient data until a clinic BAA and a real tenant exist. If you want a 20-minute fictional demo, we can do that.

---

## 10. Metrics that matter (leading + lagging)

Review every Friday. A metric with no source does not get a number. Do not backfill “interested” as a stage.

### Pipeline stages

| Stage | Definition | Sprint target |
|---|---|---|
| 0 Target | Named clinic, source URL, in ICP | 40 |
| 1 Touched | Approved email or warm intro actually sent | 20 |
| 2 Conversation | Live call with the physician or the form owner | 10 |
| 3 Blank form | Blank diagram or packet in the folder | 8 |
| 4 Hands-on demo | They marked and they saw print preview | 6 |
| 5 Design partner | Email scope accepted | 3 |
| 6 Active partner | Three sessions completed | 3 |
| 7 Pilot-ready | §6 paid-pilot gates green **and** they asked to pay | 0 expected |
| 8 Paid | Invoice sent under a BAA | 0 expected |
| Lost | Reason code required | — |

**Lost-reason codes:** `no-paper`, `intake-vendor`, `ehr-or-nothing`, `wants-diagnosis`, `no-time`, `price`, `not-buyer`, `wrong-specialty`, `employed-cant-buy`, `no-response`.

### Leading (this sprint)

| Metric | Source | Why it matters |
|---|---|---|
| Conversations held / week | Pipeline | The only activity number that counts |
| Share of targets with a public paper diagram | List | Confirms we are calling the actual beachhead |
| Hands-on rate | Demos where they marked ÷ conversations | Tests “patients and MAs can do this,” not our narration |
| Objection mix | Call notes | Decides whether the next ten names change |
| EHR mix | Call notes | Decides which filing SOP is worth writing |
| Price flinch at Hypothesis A | Partner notes | Decides A vs B before any public price |
| Who signs the check | Partner notes | Owner vs “talk to corporate” |
| Claim-fence violations | Outbound email, deck, UI screenshots we send | Any one is a stop-and-correct |
| PHI incidents | Inbox, feedback, analytics | Target is zero; one incident ends the thread and gets documented |
| Counsel scoped / insurance quoted | Yes/no from Willis | Gates outside engineering |

### Lagging (do not invent; report only after rung 1 exists)

| Metric | Definition |
|---|---|
| Paid clinics | Invoices under BAA |
| Maps per clinic per week | Aggregate from the tenant, not emailed PHI |
| Filing rate | Share of agreed visit types with a PDF in the chart, clinic-reported |
| In-visit use | Physician weekly tally: looked at the map or did not |
| 90-day retention | Still filing in week 12 of the pilot |
| Time from invite to submitted map | Product metric, once links exist |
| Support contacts per clinic | Load on the “business hours” promise |
| Net revenue | Cash, not pipeline |

### Product metrics Grok may cite only if measured on fictional demo tasks

- Time to first saved mark after the walkthrough starts (watch it; do not publish a target as a claim).
- Whether the MA found Export without help.
- Whether print preview showed the disclaimer without scrolling past it in confusion.

### Guardrails (override every target)

- Diagnostic wording in a deck, email, or demo → correct the artifact the same day and tell Willis.
- Real PHI offered or received → refuse or delete, do not “just this once.”
- A request to fill out a hospital security review → decline, using §4.
- A request to demo overlay “AI anatomy” → decline, using §2.

---

## 11. Founder asks / decisions needed from Willis

Each item is a decision, not a brainstorm. Grok will proceed with the recommended default if Willis has not answered within seven days, **except** items marked **block**. Block items stop outbound use of his name, legal spend, or clinical intros.

| # | Decision | Recommendation if he wants a default | Block? |
|---|---|---|---|
| 1 | Which legal entity will eventually contract and sign BAAs — existing Prosper Business Depot entity, a new PainLocator entity, or undecided? | Leave undecided and sign nothing. Do not put a company name on an order form. | **Block** on any contract |
| 2 | Approve the §5 claim fence and the week-1 email wording, including the from-address `matt@prosperbusinessdepot.com`. | Hold all sends until approved. | **Block** on outreach |
| 3 | May Grok receive a warm intro to the chief of pain and to the expert witnesses, or will Willis keep those conversations himself? | Grok does not contact them. Send Willis the question list below. | **Block** on those names |
| 4 | Will he be the public voice (email, the long post, a noon conference), with Grok drafting? | Yes for email he approves; no public post until he opts in. | Block on anything published under his name |
| 5 | Confirm he will hold the line in the room: **no real patients on the current app**, even if a friend offers. | That is the rule. | **Block** — this is the safety line |
| 6 | Cities he will actually visit in the next 90 days, so the first 40 names match his geography. | Build the list nationally from public packets, and mark “can visit” only where he says. | No |
| 7 | Budget ceiling for counsel consult, cyber/E&O quotes, and incidental tools (scheduling, a workspace for the pipeline). | Grok spends $0 until he names a ceiling. | **Block** on spend |
| 8 | When engineering tradeoffs arise, pilot gates (§6) come before more sales surface for Spatial and before any marketplace work. | Adopt that order for commercial requests. Engineering still owns the technical plan. | No — he should confirm |
| 9 | List any implied endorsement already given (advisor title, “we’re working with X,” a slide, a quote). | Assume none and make no logos. | **Block** if a name might be used |
| 10 | Is pain-medicine independent practice the beachhead he wants, or does he want occ-med / IME physicians first? | Pain-medicine clinics first. IME only as §9, same rules. | No — default stands |
| 11 | One sitting to mark this plan: accept, or strike sections. | The plan is in force as written for Grok’s outbound behavior; his name still waits on rows 2–5. | Block on his name only |

**Question list for the chief and the expert witnesses** (Willis asks; 30 minutes; Grok writes the answers if invited):

1. In the clinics you see, what share of pain histories still start with a paper body outline?
2. What do you hate about that artifact when you are the treating physician, and when you are reviewing someone else’s record?
3. What would a replacement have to show for you to let an MA hand it to a patient next clinic?
4. Where would the output have to land (scanned media, the note, a patient message) before it is real?
5. Which sentence would make you throw it out — diagnosis, “AI,” too many clicks, pediatric body that is actually an adult, a 3D model that is wrong?
6. Is a PDF the clinic files enough for a year, if the map itself is better than paper?
7. What must never be claimed if a map shows up in an IME or a legal file?
8. Who are two physicians, still in practice, who still use the paper form and might talk to Willis?

No recording of those calls unless the guest agrees. No quotes reused publicly from row 9’s rule.

---

## 12. Immediate next 10 actions (numbered, concrete)

1. **Willis marks §11** in one sitting (accept, strike, or default), and confirms whether `matt@prosperbusinessdepot.com` may appear on outreach he has approved.
2. **Grok sends Willis the claim fence** as a one-page extract of §5 (allowed sentences, forbidden sentences, shipped disclaimer quotes) within the same week this plan is accepted.
3. **Grok opens the pipeline sheet** with the stages and lost-reason codes in §10 and a rule that stage 7+ stays empty until engineering says the §6 paid-pilot column is green.
4. **Grok builds the first 40 clinic rows** from public sources only: independent pain practices, source URL on every row, hospital departments excluded, at least 15 rows pointing at a public new-patient packet or blank diagram.
5. **Grok rehearses the 12-minute demo** on the current build in Demo Mode (Lower-back), including print preview, a Spatial-failure fallback to plates, and a spoken disclaimer — before any prospect sees it.
6. **Willis edits or approves the 120-word note** in week 1; Grok sends **zero** email until that approval, then sends only the first 10 names he has also approved.
7. **Grok gives Willis the eight-question guide** in §11 for the chief and the expert witnesses, and does not contact those people directly.
8. **Grok writes the engineering gap list** as the §6 paid-pilot gates in order, labeled “commercial request, not a roadmap replacement,” and stops adding feature wishes to it during the sprint.
9. **Willis names a counsel budget or explicitly defers it**; if he names it, Grok sends a scoped ask covering intended use, BAA trigger, disclaimer, patient-visible peak-intensity wording, and IME/marketing language. Grok does not retain counsel alone.
10. **Grok puts the week-12 decision memo on the calendar for 22 January 2027** and runs the Friday ten-line note every week until then, including holiday weeks that correctly say “no external activity.”

Until action 6 is done, the commercial program is preparation only. That is the correct speed for a product that cannot yet hold a clinic’s patients.
