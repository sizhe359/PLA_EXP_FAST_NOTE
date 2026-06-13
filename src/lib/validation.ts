import { z } from "zod";

const replicateWeightSchema = z.object({
  replicate: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  weight: z.string(),
});

const sampleMeasurementSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  measuredAt: z.string(),
  replicateWeights: z.array(replicateWeightSchema).length(3),
});

const experimentSampleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "请填写样品名称").max(80),
  position: z.number().int().nonnegative(),
  measurements: z.array(sampleMeasurementSchema).max(1000),
});

export const experimentSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "请填写实验名称").max(120),
  experimentDate: z.iso.date(),
  sampleName: z.string().trim().max(120),
  batchNumber: z.string().trim().max(120),
  notes: z.string().max(5000),
  status: z.enum(["active", "archived"]),
  templateSnapshot: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    fields: z.array(z.any()),
    columns: z.array(z.any()),
    calculationRules: z.array(z.any()),
  }),
  fieldValues: z.record(z.string(), z.string()),
  calculationResults: z.record(z.string(), z.number().nullable()),
  samples: z.array(experimentSampleSchema).min(1).max(20),
  updatedAt: z.string().optional(),
});

export type ExperimentInput = z.infer<typeof experimentSchema>;
