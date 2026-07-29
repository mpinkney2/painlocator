/** PainLocator / Clinical Anatomy Engine shared types */

export type WorkflowMode = "capture" | "review" | "clinical";

export type AnatomyView = "front" | "back" | "left" | "right";

export type PatientModel = "male" | "female" | "child" | "teen" | "senior" | "adult-male" | "adult-female";

export type VisualizationBaseMode = "standard" | "heatmap" | "reference";

export type RegionTool = "select" | "point" | "circle" | "polygon" | "brush" | "lasso" | "eraser";

export type ClinicalStatus = "logged" | "ready_for_review" | "reviewed" | "signed_off";

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface PainRegion {
  id: string;
  entryId: string | null;
  view: AnatomyView | string;
  regionId: string | null;
  patientLabel: string | null;
  physicianLabel: string | null;
  anatomyLayer: string;
  structureId: string | null;
  structureLabel: string | null;
  shape: string;
  anchors: NormalizedPoint[];
  radius: number;
  radiusY: number | null;
  opacity: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PainEntry {
  id: string;
  title: string | null;
  patientModel: string;
  createdAt: string;
  updatedAt: string;
  intensity: number;
  quality: string[];
  triggers: string[];
  easesAfter: string[];
  duration: string;
  whenOccurring: string;
  note: string;
  clinicalStatus: ClinicalStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  signedOffAt: string | null;
  regions: PainRegion[];
}

export interface AppState {
  engine: unknown;
  view: AnatomyView;
  modelType: string;
  workflowMode: WorkflowMode;
  physicianMode: boolean;
  reviewEditMode: boolean;
  entryFilter: string;
  compareVisible: boolean;
  chart: unknown;
  chartEntries: PainEntry[];
  recognition: unknown;
  contextMenuRegionId: string | null;
  vizController: unknown;
}
