/**
 * CareChronology data contracts and adapters (prototype).
 * Pure ESM. No network, persistence, patient identifiers, or EHR credentials.
 * All built-in fixtures are fictional. Never infer clinical causation.
 */
export const DEMO_PATIENT = Object.freeze({
  name: "Avery Morgan",
  id: "SYN-0001",
  episode: "Left knee recovery",
  subtitle: "Post-procedure recovery and follow-up",
  fictional: true
});

const source = (label, id) => ({ label, id, system: "Synthetic demonstration", verified: false });
const painRegion = (x, y) => ({ view: "front", label: "Left knee", shape: "circle", anchors: [{ x, y }], radius: 0.042 });
export const DEMO_EVENTS = Object.freeze([
  { id: "e01", date: "2026-01-06T14:00:00Z", kind: "visit", title: "Orthopedic consultation", summary: "The care team discussed knee symptoms, treatment options, and the proposed care plan.", clinician: "Orthopedic specialist", source: source("Specialist visit note", "SYN-VISIT-01") },
  { id: "e02", date: "2026-01-08T09:00:00Z", kind: "lab", title: "Baseline bloodwork", summary: "Baseline results recorded before the procedure.", value: 13.8, unit: "g/dL", test: "Hemoglobin", code: "718-7", source: source("Laboratory result", "SYN-LAB-01") },
  { id: "e03", date: "2026-01-21T11:00:00Z", kind: "procedure", title: "Knee procedure", summary: "Procedure documented by the surgical care team.", clinician: "Orthopedic surgical team", source: source("Procedure summary", "SYN-PROC-01") },
  { id: "e04", date: "2026-01-22T13:00:00Z", kind: "medication", title: "Recovery medication plan", summary: "A post-procedure medication and recovery plan was reviewed.", clinician: "Discharge team", source: source("Discharge instructions", "SYN-MED-01") },
  { id: "e05", date: "2026-01-24T10:00:00Z", kind: "symptom", title: "PainLocator symptom entry", summary: "Patient reported left knee discomfort during early recovery.", intensity: 7, quality: ["Aching"], regions: [painRegion(0.59, 0.73)], note: "More noticeable when standing.", source: source("PainLocator sample entry", "SYN-PAIN-01"), reportedBy: "Patient" },
  { id: "e06", date: "2026-02-01T10:00:00Z", kind: "lab", title: "Follow-up bloodwork", summary: "Hemoglobin value recorded in the follow-up laboratory report.", value: 12.2, unit: "g/dL", test: "Hemoglobin", code: "718-7", source: source("Laboratory result", "SYN-LAB-02") },
  { id: "e07", date: "2026-02-02T14:00:00Z", kind: "visit", title: "Follow-up visit", summary: "The care team reviewed recovery progress and documented next steps.", clinician: "Orthopedic specialist", source: source("Office visit note", "SYN-VISIT-02") },
  { id: "e08", date: "2026-02-08T10:00:00Z", kind: "symptom", title: "PainLocator symptom entry", summary: "Patient reported pain severity 4 out of 10.", intensity: 4, quality: ["Stiffness"], regions: [painRegion(0.585, 0.735)], note: "More comfortable on short walks.", source: source("PainLocator sample entry", "SYN-PAIN-02"), reportedBy: "Patient" },
  { id: "e09", date: "2026-02-16T10:00:00Z", kind: "lab", title: "Follow-up bloodwork", summary: "Repeat hemoglobin value documented.", value: 13.2, unit: "g/dL", test: "Hemoglobin", code: "718-7", source: source("Laboratory result", "SYN-LAB-03") },
  { id: "e10", date: "2026-03-01T10:00:00Z", kind: "symptom", title: "PainLocator symptom entry", summary: "Patient reported pain severity 2 out of 10.", intensity: 2, quality: ["Intermittent ache"], regions: [painRegion(0.59, 0.73)], note: "Occasional mild discomfort after activity.", source: source("PainLocator sample entry", "SYN-PAIN-03"), reportedBy: "Patient" },
  { id: "e11", date: "2026-03-06T16:00:00Z", kind: "communication", title: "Care-team communication", summary: "A fictional follow-up message summarizes the documented recovery plan.", clinician: "Care coordinator", source: source("Example patient message", "SYN-MSG-01") }
]);

export const KIND_LABELS = Object.freeze({
  visit: "Visit", lab: "Laboratory", procedure: "Procedure",
  medication: "Medication", symptom: "PainLocator", communication: "Message", diagnosis: "Condition"
});

const text = (value, limit = 300) => String(value == null ? "" : value).trim().slice(0, limit);
const validTime = (value) => typeof value === "string" && value.length < 64 && !Number.isNaN(Date.parse(value));
const validNumber = (x, low, high) => typeof x === "number" && Number.isFinite(x) && x >= low && x <= high;
export const sortEvents = (events) => [...events].sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || String(a.id).localeCompare(String(b.id)));

function safeRegion(region) {
  if (!region || typeof region !== "object") return null;
  const view = ["front", "back", "left", "right"].includes(region.view) ? region.view : "front";
  const anchors = (Array.isArray(region.anchors) ? region.anchors : []).slice(0, 30)
    .filter(a => a && validNumber(a.x, 0, 1) && validNumber(a.y, 0, 1))
    .map(a => ({ x: a.x, y: a.y }));
  if (!anchors.length) return null;
  return {
    view, label: text(region.patientLabel || region.physicianLabel || region.label || "Reported location", 90),
    shape: ["circle", "polygon", "ellipse"].includes(region.shape) ? region.shape : "circle",
    anchors, radius: validNumber(region.radius, 0, 1) ? region.radius : 0.025
  };
}

/** Accepts PainLocator's existing schemaVersion 1.x exported JSON, without sending it anywhere. */
export function normalizePainLocatorSession(session) {
  if (!session || typeof session !== "object" || Array.isArray(session)) throw new Error("Not a PainLocator JSON session.");
  if (!/^1\./.test(String(session.schemaVersion || "")) || !Array.isArray(session.entries)) {
    throw new Error("Expected a PainLocator schemaVersion 1.x session with entries.");
  }
  if (session.entries.length > 500) throw new Error("Too many entries for the prototype (maximum 500).");
  return sortEvents(session.entries.flatMap((e, idx) => {
    if (!e || !validTime(e.createdAt) || !validNumber(e.intensity, 0, 10)) return [];
    const regions = (Array.isArray(e.regions) ? e.regions : []).slice(0, 40).map(safeRegion).filter(Boolean);
    return [{
      id: "pl-import-" + idx, date: new Date(e.createdAt).toISOString(), kind: "symptom",
      title: "PainLocator symptom entry", summary: "Patient-reported pain severity " + e.intensity + "/10.",
      intensity: e.intensity, quality: (Array.isArray(e.quality) ? e.quality : []).slice(0, 10).map(q => text(q, 40)),
      regions, note: text(e.note, 1200), reportedBy: "Patient",
      source: { label: "Imported PainLocator file (local only)", id: text(e.id, 100), system: "User-selected file", verified: false }
    }];
  }));
}

const codingLabel = (resource, fallback) => text(
  resource?.code?.text || resource?.code?.coding?.[0]?.display
  || resource?.medicationCodeableConcept?.text || resource?.medicationCodeableConcept?.coding?.[0]?.display || fallback, 150
);
const itemTime = (r) =>
  r.effectiveDateTime || r.performedDateTime || r.authoredOn || r.recordedDate
  || r.onsetDateTime || r.issued || r.sent || r.period?.start || r.meta?.lastUpdated;

/**
 * Prototype-only importer for local FHIR R4 Bundle files.
 * Supported: Encounter, Condition, Observation, Procedure, MedicationRequest, DiagnosticReport, Communication.
 * Does not create auth tokens, fetch a server, write to EHRs, or interpret clinical significance.
 */
export function normalizeFhirR4Bundle(bundle) {
  if (!bundle || bundle.resourceType !== "Bundle" || !Array.isArray(bundle.entry)) {
    throw new Error("Expected a FHIR R4 Bundle with an entry array.");
  }
  if (bundle.entry.length > 500) throw new Error("Too many FHIR resources for this prototype (maximum 500).");
  const types = {
    Encounter: "visit", Condition: "diagnosis", Observation: "lab",
    Procedure: "procedure", MedicationRequest: "medication",
    DiagnosticReport: "lab", Communication: "communication"
  };
  return sortEvents(bundle.entry.flatMap((entry, idx) => {
    const r = entry?.resource;
    if (!r || !types[r.resourceType]) return [];
    const date = r.resourceType === "Encounter" ? r.period?.start : itemTime(r);
    if (!validTime(date)) return [];
    const kind = types[r.resourceType];
    const label = codingLabel(r, r.resourceType);
    const qty = r.valueQuantity;
    const numeric = qty && Number(qty.value);
    const hasValue = typeof qty?.value === "number" && Number.isFinite(numeric);
    return [{
      id: "fhir-import-" + idx, date: new Date(date).toISOString(), kind,
      title: label,
      summary: hasValue ? ("Recorded result: " + numeric + " " + text(qty.unit || qty.code, 30)) :
        ("Imported " + r.resourceType + " record. Review original resource for details."),
      ...(hasValue ? { value: numeric, test: label, unit: text(qty.unit || qty.code, 30) } : {}),
      source: { label: "Imported FHIR " + r.resourceType, id: text(r.id || String(idx), 100), system: "User-selected file", verified: false }
    }];
  }));
}
