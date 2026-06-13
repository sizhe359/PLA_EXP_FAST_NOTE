import type {
  CalculationRule,
  ExperimentSample,
  SampleMeasurement,
  Unit,
} from "@/lib/types";

const UNIT_FACTORS: Record<Unit, number> = {
  g: 1,
  mg: 1e-3,
  ug: 1e-6,
  L: 1,
  mL: 1e-3,
  uL: 1e-6,
};

export function parseFiniteNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateMassVolume(mass: unknown, volume: unknown) {
  const parsedMass = parseFiniteNumber(mass);
  const parsedVolume = parseFiniteNumber(volume);
  if (
    parsedMass === null ||
    parsedVolume === null ||
    parsedVolume <= 0 ||
    parsedMass < 0
  ) {
    return null;
  }
  return parsedMass / parsedVolume;
}

export function calculateDilution(
  stockConcentration: unknown,
  stockVolume: unknown,
  finalVolume: unknown,
) {
  const concentration = parseFiniteNumber(stockConcentration);
  const stock = parseFiniteNumber(stockVolume);
  const final = parseFiniteNumber(finalVolume);
  if (
    concentration === null ||
    stock === null ||
    final === null ||
    concentration < 0 ||
    stock < 0 ||
    final <= 0
  ) {
    return null;
  }
  return (concentration * stock) / final;
}

export function convertUnit(value: unknown, fromUnit: Unit, toUnit: Unit) {
  const numeric = parseFiniteNumber(value);
  if (numeric === null) return null;
  const massUnits: Unit[] = ["g", "mg", "ug"];
  const volumeUnits: Unit[] = ["L", "mL", "uL"];
  const compatible =
    (massUnits.includes(fromUnit) && massUnits.includes(toUnit)) ||
    (volumeUnits.includes(fromUnit) && volumeUnits.includes(toUnit));
  if (!compatible) return null;
  return (numeric * UNIT_FACTORS[fromUnit]) / UNIT_FACTORS[toUnit];
}

export function applyCalculationRules(
  rules: CalculationRule[],
  fields: Record<string, string>,
) {
  const results: Record<string, number | null> = {};
  for (const rule of rules) {
    if (rule.type === "mass_volume") {
      results.massVolumeConcentration = calculateMassVolume(
        fields[rule.massField],
        fields[rule.volumeField],
      );
    } else if (rule.type === "dilution") {
      results.dilutedConcentration = calculateDilution(
        fields[rule.stockConcentrationField],
        fields[rule.stockVolumeField],
        fields[rule.finalVolumeField],
      );
    } else if (rule.type === "unit_conversion") {
      results[`converted_${rule.sourceField}`] = convertUnit(
        fields[rule.sourceField],
        rule.fromUnit,
        rule.toUnit,
      );
    }
  }
  return results;
}

export interface ReplicateResult {
  replicate: 1 | 2 | 3;
  initialWeight: number | null;
  weight: number | null;
  weightDifference: number | null;
  degradationPercent: number | null;
}

export interface MeasurementResult {
  measurementId: string;
  measuredAt: string;
  elapsedHours: number | null;
  replicates: ReplicateResult[];
  averageDegradationPercent: number | null;
  validCount: number;
}

function findInitialWeight(
  measurements: SampleMeasurement[],
  replicate: 1 | 2 | 3,
) {
  for (const measurement of measurements) {
    const entry = measurement.replicateWeights.find(
      (item) => item.replicate === replicate,
    );
    const weight = parseFiniteNumber(entry?.weight);
    if (weight !== null && weight > 0) return weight;
  }
  return null;
}

export function calculateSampleDegradation(
  sample: ExperimentSample,
): MeasurementResult[] {
  const ordered = [...sample.measurements].sort(
    (left, right) => left.position - right.position,
  );
  const firstTimedMeasurement = ordered.find(
    (measurement) =>
      measurement.measuredAt &&
      measurement.replicateWeights.some(
        (entry) => parseFiniteNumber(entry.weight) !== null,
      ),
  );
  const initialTime = firstTimedMeasurement
    ? new Date(firstTimedMeasurement.measuredAt).getTime()
    : Number.NaN;
  const initialWeights = {
    1: findInitialWeight(ordered, 1),
    2: findInitialWeight(ordered, 2),
    3: findInitialWeight(ordered, 3),
  } as const;

  return ordered.map((measurement) => {
    const measuredTime = measurement.measuredAt
      ? new Date(measurement.measuredAt).getTime()
      : Number.NaN;
    const replicates = ([1, 2, 3] as const).map((replicate) => {
      const initialWeight = initialWeights[replicate];
      const weight = parseFiniteNumber(
        measurement.replicateWeights.find(
          (entry) => entry.replicate === replicate,
        )?.weight,
      );
      if (
        initialWeight === null ||
        weight === null ||
        weight < 0
      ) {
        return {
          replicate,
          initialWeight,
          weight,
          weightDifference: null,
          degradationPercent: null,
        };
      }
      const difference = weight - initialWeight;
      return {
        replicate,
        initialWeight,
        weight,
        weightDifference: difference,
        degradationPercent: ((initialWeight - weight) / initialWeight) * 100,
      };
    });
    const valid = replicates
      .map((entry) => entry.degradationPercent)
      .filter((value): value is number => value !== null);
    return {
      measurementId: measurement.id,
      measuredAt: measurement.measuredAt,
      elapsedHours:
        Number.isFinite(initialTime) && Number.isFinite(measuredTime)
          ? (measuredTime - initialTime) / 3_600_000
          : null,
      replicates,
      averageDegradationPercent:
        valid.length > 0
          ? valid.reduce((sum, value) => sum + value, 0) / valid.length
          : null,
      validCount: valid.length,
    };
  });
}
