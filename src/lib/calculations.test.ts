import { describe, expect, it } from "vitest";
import {
  calculateDilution,
  calculateMassVolume,
  calculateSampleDegradation,
  convertUnit,
  parseFiniteNumber,
} from "@/lib/calculations";
import type { ExperimentSample, SampleMeasurement } from "@/lib/types";

function measurement(
  id: string,
  position: number,
  measuredAt: string,
  weights: [string, string, string],
): SampleMeasurement {
  return {
    id,
    position,
    measuredAt,
    replicateWeights: ([1, 2, 3] as const).map((replicate, index) => ({
      replicate,
      weight: weights[index],
    })),
  };
}

function sample(measurements: SampleMeasurement[]): ExperimentSample {
  return { id: "sample", name: "PLA", position: 0, measurements };
}

describe("numeric helpers", () => {
  it("accepts finite values and rejects blank or invalid values", () => {
    expect(parseFiniteNumber("12.5")).toBe(12.5);
    expect(parseFiniteNumber("")).toBeNull();
    expect(parseFiniteNumber("bad")).toBeNull();
  });

  it("keeps the reusable concentration and conversion calculations", () => {
    expect(calculateMassVolume("20", "4")).toBe(5);
    expect(calculateMassVolume("1", "0")).toBeNull();
    expect(calculateDilution("10", "2", "20")).toBe(1);
    expect(convertUnit(1, "g", "mg")).toBe(1000);
    expect(convertUnit(1, "g", "mL")).toBeNull();
  });
});

describe("parallel degradation calculations", () => {
  it("uses each replicate's own initial weight", () => {
    const results = calculateSampleDegradation(
      sample([
        measurement("m1", 0, "2026-06-01T08:00", ["100", "120", "80"]),
        measurement("m2", 1, "2026-06-03T08:00", ["90", "108", "72"]),
      ]),
    );
    expect(results[1].elapsedHours).toBe(48);
    expect(results[1].replicates.map((entry) => entry.degradationPercent)).toEqual([
      10, 10, 10,
    ]);
    expect(results[1].averageDegradationPercent).toBe(10);
    expect(results[1].validCount).toBe(3);
  });

  it("calculates a temporary mean from one or two valid replicates", () => {
    const results = calculateSampleDegradation(
      sample([
        measurement("m1", 0, "2026-06-01T08:00", ["100", "100", ""]),
        measurement("m2", 1, "2026-06-02T08:00", ["80", "", ""]),
      ]),
    );
    expect(results[0].validCount).toBe(2);
    expect(results[1].validCount).toBe(1);
    expect(results[1].averageDegradationPercent).toBe(20);
  });

  it("preserves negative degradation when weight increases", () => {
    const results = calculateSampleDegradation(
      sample([
        measurement("m1", 0, "2026-06-01T08:00", ["100", "", ""]),
        measurement("m2", 1, "2026-06-01T20:00", ["105", "", ""]),
      ]),
    );
    expect(results[1].elapsedHours).toBe(12);
    expect(results[1].replicates[0].weightDifference).toBe(5);
    expect(results[1].averageDegradationPercent).toBe(-5);
  });

  it("ignores zero, negative and invalid initial weights", () => {
    const results = calculateSampleDegradation(
      sample([
        measurement("m1", 0, "2026-06-01T08:00", ["0", "-2", "bad"]),
      ]),
    );
    expect(results[0].validCount).toBe(0);
    expect(results[0].averageDegradationPercent).toBeNull();
  });

  it("gives different samples independent time origins", () => {
    const first = calculateSampleDegradation(
      sample([
        measurement("a1", 0, "2026-06-01T08:00", ["100", "", ""]),
        measurement("a2", 1, "2026-06-02T08:00", ["90", "", ""]),
      ]),
    );
    const second = calculateSampleDegradation(
      sample([
        measurement("b1", 0, "2026-06-10T12:00", ["100", "", ""]),
        measurement("b2", 1, "2026-06-10T18:00", ["90", "", ""]),
      ]),
    );
    expect(first[1].elapsedHours).toBe(24);
    expect(second[1].elapsedHours).toBe(6);
  });
});
