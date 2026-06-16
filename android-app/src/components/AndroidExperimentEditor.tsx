import {
  ArrowLeft,
  Check,
  CloudAlert,
  Download,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ExperimentChart } from "@/components/experiment-chart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/field";
import { calculateSampleDegradation } from "@/lib/calculations";
import { createEmptyExperiment } from "@/lib/experiments";
import { exportExperimentCsv, exportExperimentJson } from "@/lib/exports";
import type {
  Experiment,
  ExperimentSample,
  SampleMeasurement,
  SaveStatus,
} from "@/lib/types";
import { createId } from "@/lib/utils";
import { experimentSchema } from "@/lib/validation";
import { getExperiment, saveExperiment } from "@android/lib/local-db";

function localDateTimeNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function createMeasurement(position: number): SampleMeasurement {
  return {
    id: createId(),
    position,
    measuredAt: "",
    replicateWeights: ([1, 2, 3] as const).map((replicate) => ({
      replicate,
      weight: "",
    })),
  };
}

function statusContent(status: SaveStatus) {
  if (status === "saving") {
    return { icon: <LoaderCircle className="animate-spin" size={15} />, text: "保存中" };
  }
  if (status === "saved") return { icon: <Check size={15} />, text: "本地已保存" };
  if (status === "error") return { icon: <CloudAlert size={15} />, text: "保存失败" };
  return { icon: <Save size={15} />, text: "本地草稿" };
}

export function AndroidExperimentEditor() {
  const { id = "new" } = useParams();
  const navigate = useNavigate();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState("");
  const [status, setStatus] = useState<SaveStatus>("draft");
  const [error, setError] = useState("");
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const loaded = id === "new" ? createEmptyExperiment() : await getExperiment(id);
      if (!active) return;
      const next = loaded ?? createEmptyExperiment();
      setExperiment(next);
      setSelectedSampleId(next.samples[0]?.id ?? "");
      hydrated.current = true;
    }
    hydrated.current = false;
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  const selectedSample =
    experiment?.samples.find((sample) => sample.id === selectedSampleId) ??
    experiment?.samples[0];
  const sampleResults = useMemo(
    () => (selectedSample ? calculateSampleDegradation(selectedSample) : []),
    [selectedSample],
  );
  const resultByMeasurement = useMemo(
    () => new Map(sampleResults.map((result) => [result.measurementId, result])),
    [sampleResults],
  );

  useEffect(() => {
    if (!hydrated.current || !experiment) return;
    setStatus("draft");
    const timeout = window.setTimeout(async () => {
      const parsed = experimentSchema.safeParse(experiment);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "请检查输入内容");
        setStatus("error");
        return;
      }
      setStatus("saving");
      setError("");
      try {
        const saved = await saveExperiment(parsed.data);
        setStatus("saved");
        if (id === "new" && saved.id) {
          setExperiment(saved);
          navigate(`/experiments/${saved.id}`, { replace: true });
        }
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "保存失败");
        setStatus("error");
      }
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [experiment, id, navigate]);

  if (!experiment) {
    return (
      <main className="grid min-h-screen place-items-center px-4 text-muted">
        <LoaderCircle className="animate-spin" size={28} />
      </main>
    );
  }

  function setExperimentValue(next: Experiment) {
    setExperiment(next);
  }

  function updateExperiment(
    key: "title" | "experimentDate" | "batchNumber" | "notes",
    value: string,
  ) {
    setExperimentValue({ ...experiment!, [key]: value });
  }

  function updateCondition(key: string, value: string) {
    setExperimentValue({
      ...experiment!,
      fieldValues: { ...experiment!.fieldValues, [key]: value },
    });
  }

  function updateSample(
    sampleId: string,
    transform: (sample: ExperimentSample) => ExperimentSample,
  ) {
    setExperimentValue({
      ...experiment!,
      samples: experiment!.samples.map((sample) =>
        sample.id === sampleId ? transform(sample) : sample,
      ),
    });
  }

  function addSample() {
    const sample: ExperimentSample = {
      id: createId(),
      name: `样品 ${experiment!.samples.length + 1}`,
      position: experiment!.samples.length,
      measurements: [],
    };
    setExperimentValue({ ...experiment!, samples: [...experiment!.samples, sample] });
    setSelectedSampleId(sample.id);
  }

  function removeSample(sampleId: string) {
    if (experiment!.samples.length <= 1) return;
    const remaining = experiment!.samples
      .filter((sample) => sample.id !== sampleId)
      .map((sample, position) => ({ ...sample, position }));
    setExperimentValue({ ...experiment!, samples: remaining });
    setSelectedSampleId(remaining[0]?.id ?? "");
  }

  function addMeasurement() {
    if (!selectedSample) return;
    updateSample(selectedSample.id, (sample) => ({
      ...sample,
      measurements: [...sample.measurements, createMeasurement(sample.measurements.length)],
    }));
  }

  function updateMeasurement(
    measurementId: string,
    transform: (measurement: SampleMeasurement) => SampleMeasurement,
  ) {
    if (!selectedSample) return;
    updateSample(selectedSample.id, (sample) => ({
      ...sample,
      measurements: sample.measurements.map((measurement) =>
        measurement.id === measurementId ? transform(measurement) : measurement,
      ),
    }));
  }

  function updateWeight(measurementId: string, replicate: 1 | 2 | 3, weight: string) {
    updateMeasurement(measurementId, (measurement) => ({
      ...measurement,
      measuredAt:
        weight.trim() && !measurement.measuredAt
          ? localDateTimeNow()
          : measurement.measuredAt,
      replicateWeights: measurement.replicateWeights.map((entry) =>
        entry.replicate === replicate ? { ...entry, weight } : entry,
      ),
    }));
  }

  function removeMeasurement(measurementId: string) {
    if (!selectedSample) return;
    updateSample(selectedSample.id, (sample) => ({
      ...sample,
      measurements: sample.measurements
        .filter((measurement) => measurement.id !== measurementId)
        .map((measurement, position) => ({ ...measurement, position })),
    }));
  }

  const statusView = statusContent(status);

  return (
    <main className="safe-bottom mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold hover:bg-white"
          to="/experiments"
        >
          <ArrowLeft size={19} /> 返回记录
        </Link>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
            status === "error" ? "bg-[#fff0ee] text-danger" : "bg-[#e2f3eb] text-primary"
          }`}
        >
          {statusView.icon}
          {statusView.text}
        </span>
      </div>
      {error && (
        <p className="mb-4 rounded-xl bg-[#fff0ee] px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="space-y-4">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="title">实验名称</Label>
              <Input
                id="title"
                value={experiment.title}
                onChange={(event) => updateExperiment("title", event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="date">开始日期</Label>
              <Input
                id="date"
                type="date"
                value={experiment.experimentDate}
                onChange={(event) =>
                  updateExperiment("experimentDate", event.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor="batch">批次</Label>
              <Input
                id="batch"
                value={experiment.batchNumber}
                onChange={(event) => updateExperiment("batchNumber", event.target.value)}
              />
            </div>
            {experiment.templateSnapshot.fields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key}>
                  {field.label}
                  {field.unit && ` (${field.unit})`}
                </Label>
                <Input
                  id={field.key}
                  inputMode={field.inputMode}
                  value={experiment.fieldValues[field.key] ?? ""}
                  onChange={(event) => updateCondition(field.key, event.target.value)}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">样品设置</h2>
              <p className="text-sm text-muted">每种样品固定包含三个平行样。</p>
            </div>
            <Button onClick={addSample} variant="secondary">
              <Plus size={18} /> 添加样品
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {experiment.samples.map((sample) => (
              <div
                className={`rounded-xl border p-2 ${
                  sample.id === selectedSample?.id
                    ? "border-primary bg-[#edf6f1]"
                    : "border-border"
                }`}
                key={sample.id}
              >
                <button
                  className="w-full text-left text-sm font-bold"
                  onClick={() => setSelectedSampleId(sample.id)}
                  type="button"
                >
                  {sample.name}
                </button>
                <div className="mt-2 flex gap-1">
                  <Input
                    aria-label={`${sample.name}名称`}
                    className="min-h-10 py-1.5"
                    value={sample.name}
                    onChange={(event) =>
                      updateSample(sample.id, (current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                  <Button
                    aria-label={`删除${sample.name}`}
                    disabled={experiment.samples.length <= 1}
                    onClick={() => removeSample(sample.id)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 size={17} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {selectedSample && (
          <>
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary">当前样品</p>
                  <h2 className="text-xl font-bold">{selectedSample.name}</h2>
                </div>
                <Button onClick={addMeasurement}>
                  <Plus size={18} /> 新增测量
                </Button>
              </div>
              {selectedSample.measurements.length === 0 ? (
                <p className="rounded-xl bg-[#f2f5f3] p-5 text-center text-sm text-muted">
                  还没有测量数据。点击“新增测量”开始录入三个平行样。
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedSample.measurements.map((measurement, index) => {
                    const result = resultByMeasurement.get(measurement.id);
                    return (
                      <div className="rounded-2xl border border-border p-3" key={measurement.id}>
                        <div className="mb-3 flex items-center justify-between">
                          <strong>第 {index + 1} 次测量</strong>
                          <Button
                            aria-label={`删除第${index + 1}次测量`}
                            onClick={() => removeMeasurement(measurement.id)}
                            size="icon"
                            variant="ghost"
                          >
                            <Trash2 size={17} />
                          </Button>
                        </div>
                        <div className="mb-3">
                          <Label htmlFor={`time-${measurement.id}`}>测量时间</Label>
                          <Input
                            id={`time-${measurement.id}`}
                            type="datetime-local"
                            value={measurement.measuredAt}
                            onChange={(event) =>
                              updateMeasurement(measurement.id, (current) => ({
                                ...current,
                                measuredAt: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {measurement.replicateWeights.map((entry) => {
                            const replicateResult = result?.replicates.find(
                              (item) => item.replicate === entry.replicate,
                            );
                            return (
                              <div className="rounded-xl bg-[#f4f7f5] p-3" key={entry.replicate}>
                                <Label htmlFor={`${measurement.id}-${entry.replicate}`}>
                                  平行样 {entry.replicate} 重量 (mg)
                                </Label>
                                <Input
                                  id={`${measurement.id}-${entry.replicate}`}
                                  inputMode="decimal"
                                  value={entry.weight}
                                  onChange={(event) =>
                                    updateWeight(
                                      measurement.id,
                                      entry.replicate,
                                      event.target.value,
                                    )
                                  }
                                />
                                <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                                  <dt className="text-muted">初始重量</dt>
                                  <dd className="text-right font-mono">
                                    {formatNumber(replicateResult?.initialWeight)}
                                  </dd>
                                  <dt className="text-muted">重量差</dt>
                                  <dd className="text-right font-mono">
                                    {formatNumber(replicateResult?.weightDifference)}
                                  </dd>
                                  <dt className="text-muted">降解率</dt>
                                  <dd className="text-right font-mono">
                                    {formatPercent(replicateResult?.degradationPercent)}
                                  </dd>
                                </dl>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 rounded-xl bg-[#e7f4ed] px-3 py-2 text-sm font-semibold">
                          平均降解率：{formatPercent(result?.averageDegradationPercent)} ·
                          n={result?.validCount ?? 0} · {formatNumber(result?.elapsedHours)} h
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="px-4 py-4 sm:px-5">
                <h2 className="text-lg font-bold">{selectedSample.name} 历史表</h2>
                <p className="text-sm text-muted">横向滑动查看三个平行样的原始值与降解率。</p>
              </div>
              <div className="overflow-x-auto border-t border-border">
                <table className="min-w-[1050px] w-full text-sm">
                  <thead className="bg-[#edf4f0] text-left">
                    <tr>
                      {[
                        "测量时间",
                        "小时差",
                        "重量1",
                        "降解率1",
                        "重量2",
                        "降解率2",
                        "重量3",
                        "降解率3",
                        "平均降解率",
                        "n",
                      ].map((label) => (
                        <th className="px-3 py-3" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleResults.map((result) => {
                      const measurement = selectedSample.measurements.find(
                        (item) => item.id === result.measurementId,
                      );
                      return (
                        <tr className="border-t border-border" key={result.measurementId}>
                          <td className="px-3 py-3 font-mono">{result.measuredAt || "—"}</td>
                          <td className="px-3 py-3 font-mono">
                            {formatNumber(result.elapsedHours)}
                          </td>
                          {result.replicates.flatMap((replicate) => [
                            <td className="px-3 py-3 font-mono" key={`w-${replicate.replicate}`}>
                              {measurement?.replicateWeights.find(
                                (item) => item.replicate === replicate.replicate,
                              )?.weight || "—"}
                            </td>,
                            <td className="px-3 py-3 font-mono" key={`p-${replicate.replicate}`}>
                              {formatPercent(replicate.degradationPercent)}
                            </td>,
                          ])}
                          <td className="px-3 py-3 font-mono font-bold">
                            {formatPercent(result.averageDegradationPercent)}
                          </td>
                          <td className="px-3 py-3 font-mono">{result.validCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        <Card>
          <h2 className="mb-2 text-lg font-bold">全部样品平均降解率</h2>
          <p className="mb-2 text-sm text-muted">每种样品独立以首次测量为 0 小时。</p>
          <ExperimentChart samples={experiment.samples} title={experiment.title} />
        </Card>

        <Card>
          <Label htmlFor="notes">实验备注</Label>
          <Textarea
            id="notes"
            rows={5}
            value={experiment.notes}
            onChange={(event) => updateExperiment("notes", event.target.value)}
          />
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">导出与备份</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={() => exportExperimentCsv(experiment)} variant="secondary">
              <Download size={17} /> 导出 CSV
            </Button>
            <Button onClick={() => exportExperimentJson(experiment)} variant="secondary">
              <Download size={17} /> 导出 JSON
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : Number(value.toPrecision(7));
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined
    ? "—"
    : `${Number(value.toPrecision(6))}%`;
}
