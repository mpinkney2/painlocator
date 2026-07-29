/**
 * FHIR R4-oriented export for clinician / EHR handoff.
 * Produces a Bundle of type "document" with Composition + Observations.
 * This is a portable document export — not a live EHR write API.
 */

function fhirId(prefix = "pl") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function intensityCodeableConcept(intensity) {
  return {
    coding: [{
      system: "http://loinc.org",
      code: "72514-3",
      display: "Pain severity - 0-10 verbal numeric rating [Score]"
    }],
    text: `Pain intensity ${intensity}/10`
  };
}

function buildFhirObservation(entry, entryNumber, patientRef) {
  const regions = (entry.regions || []).map((r, i) => ({
    coding: [{
      system: "https://painlocator.local/CodeSystem/anatomy-region",
      code: r.regionId || `region-${i}`,
      display: r.physicianLabel || r.patientLabel || "Pain region"
    }],
    text: `${r.patientLabel || "Unspecified"} (${r.view})`
  }));

  return {
    resourceType: "Observation",
    id: fhirId("obs"),
    status: entry.clinicalStatus === "signed_off" ? "final" : "preliminary",
    category: [{
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "exam", display: "Exam" }]
    }],
    code: intensityCodeableConcept(entry.intensity),
    subject: { reference: patientRef },
    effectiveDateTime: entry.createdAt,
    issued: entry.updatedAt || entry.createdAt,
    valueInteger: entry.intensity,
    note: entry.note ? [{ text: entry.note }] : undefined,
    component: [
      ...(entry.quality || []).map(q => ({
        code: { text: "Pain quality" },
        valueString: q
      })),
      ...(entry.triggers || []).map(t => ({
        code: { text: "Pain trigger" },
        valueString: t
      })),
      ...regions.map(r => ({
        code: { text: "Pain location" },
        valueCodeableConcept: r
      })),
      {
        code: { text: "Clinical review status" },
        valueString: normalizeClinicalStatus(entry.clinicalStatus)
      }
    ]
  };
}

function buildFhirBundle(state, store) {
  const session = buildSessionExport(state, store);
  const patientId = fhirId("pat");
  const compositionId = fhirId("comp");
  const patientRef = `Patient/${patientId}`;
  const entries = session.entries || [];

  const observations = entries.map((entry, i) => buildFhirObservation(entry, i + 1, patientRef));
  const composition = {
    resourceType: "Composition",
    id: compositionId,
    status: entries.some(e => e.clinicalStatus === "signed_off") ? "final" : "preliminary",
    type: {
      coding: [{ system: "http://loinc.org", code: "34117-2", display: "History and physical note" }],
      text: "PainLocator clinical pain report"
    },
    subject: { reference: patientRef },
    date: new Date().toISOString(),
    author: [{ display: "PainLocator Clinical Anatomy Engine" }],
    title: "Clinical Pain Consultation Document",
    section: [
      {
        title: "Pain observations",
        text: {
          status: "generated",
          div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${entries.length} pain entr${entries.length === 1 ? "y" : "ies"} exported from PainLocator. Assistive pattern notes are not a medical diagnosis.</p></div>`
        },
        entry: observations.map(o => ({ reference: `Observation/${o.id}` }))
      }
    ]
  };

  const patient = {
    resourceType: "Patient",
    id: patientId,
    extension: [{
      url: "https://painlocator.local/StructureDefinition/patient-model",
      valueString: session.patient.model
    }],
    gender: String(session.patient.model).includes("female") ? "female" : "unknown"
  };

  const bundle = {
    resourceType: "Bundle",
    id: fhirId("bundle"),
    meta: {
      lastUpdated: new Date().toISOString(),
      tag: [{
        system: "https://painlocator.local/CodeSystem/export",
        code: "painlocator-fhir-r4",
        display: "PainLocator FHIR R4 document export"
      }]
    },
    type: "document",
    timestamp: new Date().toISOString(),
    entry: [
      { fullUrl: `urn:uuid:${compositionId}`, resource: composition },
      { fullUrl: `urn:uuid:${patientId}`, resource: patient },
      ...observations.map(o => ({ fullUrl: `urn:uuid:${o.id}`, resource: o }))
    ]
  };

  return bundle;
}

function exportFhirBundleJson() {
  const bundle = buildFhirBundle(state, entryStore);
  const json = JSON.stringify(bundle, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([json], { type: "application/fhir+json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `painlocator-fhir-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  return bundle;
}

window.buildFhirBundle = buildFhirBundle;
window.exportFhirBundleJson = exportFhirBundleJson;
