export type CalculationRule =
  | { type: "mass_volume"; massField: string; volumeField: string }
  | {
      type: "dilution";
      stockConcentrationField: string;
      stockVolumeField: string;
      finalVolumeField: string;
    }
  | { type: "average"; sourceColumn: string }
  | {
      type: "unit_conversion";
      sourceField: string;
      fromUnit: Unit;
      toUnit: Unit;
    };

export type Unit = "g" | "mg" | "ug" | "L" | "mL" | "uL";

export interface TemplateField {
  key: string;
  label: string;
  unit?: string;
  inputMode?: "text" | "decimal";
}

export interface TemplateColumn {
  key: string;
  label: string;
  unit?: string;
  inputType?: "decimal" | "datetime-local";
}

export interface ExperimentTemplate {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
  columns: TemplateColumn[];
  calculationRules: CalculationRule[];
}

export interface ReplicateWeight {
  replicate: 1 | 2 | 3;
  weight: string;
}

export interface SampleMeasurement {
  id: string;
  position: number;
  measuredAt: string;
  replicateWeights: ReplicateWeight[];
}

export interface ExperimentSample {
  id: string;
  name: string;
  position: number;
  measurements: SampleMeasurement[];
}

export interface Experiment {
  id?: string;
  title: string;
  experimentDate: string;
  sampleName: string;
  batchNumber: string;
  notes: string;
  status: "active" | "archived";
  templateSnapshot: ExperimentTemplate;
  fieldValues: Record<string, string>;
  calculationResults: Record<string, number | null>;
  samples: ExperimentSample[];
  updatedAt?: string;
}

export type SaveStatus = "draft" | "saving" | "saved" | "error";
