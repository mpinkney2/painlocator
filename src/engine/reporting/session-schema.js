/**
 * PainLocator Session Schema
 * ==========================
 *
 * Stable JSON format for exporting and importing clinical pain sessions.
 * All session files include `schemaVersion` for forward-compatible migrations.
 *
 * @typedef {Object} PainLocatorSessionV1
 * @property {string} schemaVersion        - Schema identifier (e.g. "1.0.0")
 * @property {string} applicationVersion - PainLocator app semver
 * @property {string} engineVersion        - Clinical Anatomy Engine semver
 * @property {string} created              - ISO 8601 — first session creation
 * @property {string} modified             - ISO 8601 — last modification at export
 *
 * @property {SessionPatient} patient
 * @property {SessionWorkflow} workflow
 * @property {PainEntry[]} entries         - Saved pain entries (draft excluded)
 * @property {SessionRegion[]} regions       - Flattened region index for tooling
 * @property {SessionTimelinePoint[]} timeline
 * @property {SessionNotes} notes
 * @property {"light"|"dark"} theme
 *
 * @typedef {Object} SessionPatient
 * @property {string} model   - adult-male | adult-female | child | teen | senior
 * @property {string} view    - front | back | left | right
 * @property {string} [label] - Optional display label
 *
 * @typedef {Object} SessionWorkflow
 * @property {"capture"|"review"|"clinical"} mode
 * @property {boolean} reviewEditMode
 *
 * @typedef {Object} SessionRegion
 * @property {string} id
 * @property {string} entryId
 * @property {number} entryNumber
 * @property {string} label           - Entry region label (e.g. "1A")
 * @property {string} view
 * @property {string|null} patientLabel
 * @property {string|null} physicianLabel
 * @property {string} shape
 * @property {{x:number,y:number}[]} anchors
 *
 * @typedef {Object} SessionTimelinePoint
 * @property {string} entryId
 * @property {number} entryNumber
 * @property {string} createdAt
 * @property {number} intensity
 * @property {number} regionCount
 *
 * @typedef {Object} SessionNotes
 * @property {string} aggregate - Combined clinical notes summary
 */

const SESSION_SCHEMA_VERSION = '1.0.0';
const APPLICATION_VERSION = '5.4.0';
const ENGINE_VERSION = '1.0.0';

function formatPatientModelLabel(model) {
  const labels = {
    'adult-male': 'Adult Male',
    'adult-female': 'Adult Female',
    'teen-male': 'Teen Male',
    'teen-female': 'Teen Female',
    'child-male': 'Child Male',
    'child-female': 'Child Female',
    'senior-male': 'Senior Male',
    'senior-female': 'Senior Female',
    child: 'Child Male',
    teen: 'Teen Male',
    senior: 'Senior Male',
    male: 'Adult Male',
    female: 'Adult Female'
  };
  return labels[normalizeModelType(model)] || model;
}

function buildSessionRegions(entries) {
  const regions = [];
  entries.forEach((entry, entryIndex) => {
    const entryNum = entryIndex + 1;
    (entry.regions || []).forEach((region, regionIndex) => {
      regions.push({
        id: region.id,
        entryId: entry.id,
        entryNumber: entryNum,
        label: regionLabel(entryNum, regionIndex),
        view: region.view,
        patientLabel: region.patientLabel,
        physicianLabel: region.physicianLabel,
        anatomyLayer: region.anatomyLayer,
        shape: region.shape,
        anchors: (region.anchors || []).map(a => ({ x: +a.x.toFixed(4), y: +a.y.toFixed(4) })),
        radius: region.radius,
        structureLabel: region.structureLabel
      });
    });
  });
  return regions;
}

function buildSessionTimeline(entries) {
  return [...entries]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((entry, i) => ({
      entryId: entry.id,
      entryNumber: i + 1,
      createdAt: entry.createdAt,
      intensity: entry.intensity,
      regionCount: (entry.regions || []).length
    }));
}

function buildSessionNotes(entries) {
  const notes = entries
    .map((e, i) => (e.note ? `Entry #${i + 1}: ${e.note}` : ''))
    .filter(Boolean);
  return { aggregate: notes.join('\n\n') };
}

/**
 * Build a complete PainLocator session export object.
 * @param {object} state
 * @param {PainEntryStore} store
 * @returns {PainLocatorSessionV1}
 */
function buildSessionExport(state, store) {
  const model = normalizeModelType(state.modelType);
  const entries = store.entries
    .filter(e => normalizeModelType(e.patientModel) === model)
    .map(e => JSON.parse(JSON.stringify(e)));

  const created = entries.length
    ? entries.reduce((earliest, e) => (e.createdAt < earliest ? e.createdAt : earliest), entries[0].createdAt)
    : new Date().toISOString();

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    applicationVersion: APPLICATION_VERSION,
    engineVersion: ENGINE_VERSION,
    created,
    modified: new Date().toISOString(),
    patient: {
      model,
      view: state.view,
      label: formatPatientModelLabel(model)
    },
    workflow: {
      mode: state.workflowMode || 'capture',
      reviewEditMode: !!state.reviewEditMode
    },
    entries,
    regions: buildSessionRegions(entries),
    timeline: buildSessionTimeline(entries),
    notes: buildSessionNotes(entries),
    theme: typeof getActiveTheme === 'function' ? getActiveTheme() : 'light'
  };
}

function validateSessionImport(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid file: expected a JSON object.' };
  }
  if (!data.schemaVersion) {
    return { valid: false, error: 'Missing schemaVersion. This file may not be a PainLocator session.' };
  }
  const major = String(data.schemaVersion).split('.')[0];
  if (major !== '1') {
    return { valid: false, error: `Unsupported schema version: ${data.schemaVersion}` };
  }
  if (!Array.isArray(data.entries)) {
    return { valid: false, error: 'Session is missing entries array.' };
  }
  return { valid: true };
}

window.SESSION_SCHEMA_VERSION = SESSION_SCHEMA_VERSION;
window.APPLICATION_VERSION = APPLICATION_VERSION;
window.ENGINE_VERSION = ENGINE_VERSION;
window.buildSessionExport = buildSessionExport;
window.validateSessionImport = validateSessionImport;
window.formatPatientModelLabel = formatPatientModelLabel;
