import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_EVENTS, sortEvents, normalizePainLocatorSession, normalizeFhirR4Bundle
} from "../public/care-chronology/model.js";

test("CareChronology demo uses only fictional records", () => {
  assert.ok(DEMO_EVENTS.length >= 8);
  assert.ok(DEMO_EVENTS.every(e => e.source?.system === "Synthetic demonstration"));
  assert.ok(DEMO_EVENTS.every(e => !e.source.verified));
  assert.equal(sortEvents(DEMO_EVENTS)[0].id, "e01");
});

test("PainLocator 1.x exported pain entries map to chronology without losing normalized anatomy", () => {
  const events = normalizePainLocatorSession({
    schemaVersion: "1.0.0",
    entries: [
      { id: "pe_123", createdAt: "2026-01-12T10:00:00.000Z", intensity: 5, note: "Aching",
        regions: [{ view: "back", patientLabel: "Upper back", shape: "circle",
          anchors: [{ x: 0.4, y: 0.3 }], radius: 0.03 }] }
    ]
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "symptom");
  assert.equal(events[0].intensity, 5);
  assert.equal(events[0].regions[0].anchors[0].x, 0.4);
  assert.equal(events[0].regions[0].view, "back");
  assert.equal(events[0].source.verified, false);
});

test("PainLocator import rejects unsupported schema and out-of-bounds coordinates", () => {
  assert.throws(() => normalizePainLocatorSession({ schemaVersion: "2.0.0", entries: [] }), /schemaVersion/);
  const events = normalizePainLocatorSession({
    schemaVersion: "1.0.0",
    entries: [{ createdAt: "2026-02-01T00:00:00Z", intensity: 7,
      regions: [{ view: "front", anchors: [{ x: -1, y: 1.7 }] }] }]
  });
  assert.deepEqual(events[0].regions, []);
});

test("FHIR R4 Bundle mapper handles observed values and ignores unknown resource types", () => {
  const records = normalizeFhirR4Bundle({
    resourceType: "Bundle",
    entry: [
      { resource: { resourceType: "Patient", id: "do-not-export" } },
      { resource: { resourceType: "Observation", id: "lab-123",
        effectiveDateTime: "2026-02-01T12:00:00Z",
        code: { text: "Hemoglobin" }, valueQuantity: { value: 12.7, unit: "g/dL" } } },
      { resource: { resourceType: "Encounter", id: "enc-456",
        period: { start: "2026-01-29T12:00:00Z" } } }
    ]
  });
  assert.equal(records.length, 2);
  assert.equal(records[0].kind, "visit");
  assert.equal(records[1].value, 12.7);
  assert.equal(records[1].source.id, "lab-123");
  assert.ok(!JSON.stringify(records).includes("do-not-export"));
});

test("FHIR parser rejects non-Bundles and excessive resources", () => {
  assert.throws(() => normalizeFhirR4Bundle({ resourceType: "Patient" }), /FHIR R4 Bundle/);
  assert.throws(() => normalizeFhirR4Bundle({
    resourceType: "Bundle", entry: new Array(501).fill({})
  }), /maximum 500/);
});

test("PainLocator ignores malformed dates and scores rather than guessing", () => {
  const result = normalizePainLocatorSession({
    schemaVersion: "1.0.0",
    entries: [
      { createdAt: "invalid", intensity: 5 },
      { createdAt: "2026-01-10T00:00:00Z", intensity: 12 },
      { createdAt: "2026-01-11T00:00:00Z", intensity: 3 }
    ]
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].intensity, 3);
});
