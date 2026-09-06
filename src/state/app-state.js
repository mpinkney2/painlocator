/**
 * PainLocator — application state and shared helpers
 */

const INTENSITY_LABELS = [
  'None', 'Minimal', 'Minimal', 'Mild', 'Mild',
  'Moderate', 'Moderate', 'Severe', 'Severe', 'Extreme', 'Extreme'
];

const entryStore = new PainEntryStore();

const state = {
  engine: null,
  view: 'front',
  modelType: 'male',
  /** Internal clinical workflow — orthogonal to presentationMode */
  workflowMode: 'capture',
  /**
   * Product shell: patient | clinician | consult
   * Does not live in the CAE; see src/state/presentation.js
   */
  presentationMode: 'patient',
  /** Patient shell step within capture: locate | describe | review */
  patientStep: 'locate',
  physicianMode: false,
  reviewEditMode: false,
  entryFilter: 'all',
  timelineRange: 'all',
  timelineRegion: 'all',
  compareVisible: false,
  chart: null,
  chartEntries: [],
  recognition: null,
  contextMenuRegionId: null,
  vizController: null
};

function useClinicalLabels() {
  return state.workflowMode === 'clinical';
}

function getRegionDisplay(region) {
  if (!region) return '—';
  return useClinicalLabels()
    ? (region.physicianLabel || region.patientLabel || '—')
    : (region.patientLabel || region.physicianLabel || '—');
}
