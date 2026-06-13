import { calculateSampleDegradation } from "@/lib/calculations";
import type { Experiment } from "@/lib/types";

function download(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function exportExperimentJson(experiment: Experiment) {
  download(
    JSON.stringify(experiment, null, 2),
    "application/json;charset=utf-8",
    `${experiment.title || "experiment"}.json`,
  );
}

export function exportExperimentCsv(experiment: Experiment) {
  const header = [
    "样品",
    "测量时间",
    "降解时间 (h)",
    "平行样1重量 (mg)",
    "平行样1降解率 (%)",
    "平行样2重量 (mg)",
    "平行样2降解率 (%)",
    "平行样3重量 (mg)",
    "平行样3降解率 (%)",
    "平均降解率 (%)",
    "n",
  ];
  const lines = experiment.samples.flatMap((sample) =>
    calculateSampleDegradation(sample).map((result) => {
      const measurement = sample.measurements.find(
        (item) => item.id === result.measurementId,
      );
      return [
        sample.name,
        result.measuredAt,
        result.elapsedHours,
        ...result.replicates.flatMap((replicate) => [
          measurement?.replicateWeights.find(
            (item) => item.replicate === replicate.replicate,
          )?.weight ?? "",
          replicate.degradationPercent,
        ]),
        result.averageDegradationPercent,
        result.validCount,
      ]
        .map(escapeCsv)
        .join(",");
    }),
  );
  download(
    `\ufeff${[header.map(escapeCsv).join(","), ...lines].join("\r\n")}`,
    "text/csv;charset=utf-8",
    `${experiment.title || "experiment"}.csv`,
  );
}
