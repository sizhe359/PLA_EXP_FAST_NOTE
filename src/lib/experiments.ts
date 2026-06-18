import { DEFAULT_TEMPLATE } from "@/lib/templates";
import type { Experiment } from "@/lib/types";
import { createId } from "@/lib/utils";

export function createEmptyExperiment(): Experiment {
  return {
    title: "新实验",
    experimentDate: new Date().toISOString().slice(0, 10),
    sampleName: "",
    batchNumber: "",
    notes: "",
    status: "active",
    templateSnapshot: DEFAULT_TEMPLATE,
    fieldValues: {},
    calculationResults: {},
    samples: ["样品 A", "样品 B", "样品 C"].map((name, position) => ({
      id: createId(),
      name,
      position,
      measurements: [],
    })),
  };
}
