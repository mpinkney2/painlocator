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
  workflowMode: 'capture',
  physicianMode: false,
  reviewEditMode: false,
  entryFilter: 'all',
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
