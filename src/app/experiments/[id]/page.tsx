import { notFound, redirect } from "next/navigation";
import { ExperimentEditor } from "@/components/experiment-editor";
import { DEFAULT_TEMPLATE } from "@/lib/templates";
import type { Experiment } from "@/lib/types";
import { createId } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function emptyExperiment(): Experiment {
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

export default async function ExperimentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  let experiment = emptyExperiment();

  if (configured) {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    if (id !== "new") {
      const [
        { data: record },
        { data: samples },
        { data: measurements },
        { data: weights },
      ] = await Promise.all([
        supabase.from("experiments").select("*").eq("id", id).single(),
        supabase
          .from("experiment_samples")
          .select("*")
          .eq("experiment_id", id)
          .order("position"),
        supabase
          .from("sample_measurements")
          .select("*")
          .eq("experiment_id", id)
          .order("position"),
        supabase
          .from("replicate_weights")
          .select("*")
          .eq("experiment_id", id)
          .order("replicate"),
      ]);
      if (!record) notFound();
      experiment = {
        id: record.id,
        title: record.title,
        experimentDate: record.experiment_date,
        sampleName: record.sample_name,
        batchNumber: record.batch_number,
        notes: record.notes,
        status: record.status,
        templateSnapshot: record.template_snapshot,
        fieldValues: record.field_values,
        calculationResults: record.calculation_results,
        samples: (samples ?? []).map((sample) => ({
          id: sample.id,
          name: sample.name,
          position: sample.position,
          measurements: (measurements ?? [])
            .filter((measurement) => measurement.sample_id === sample.id)
            .map((measurement) => ({
              id: measurement.id,
              position: measurement.position,
              measuredAt: measurement.measured_at
                ? new Date(measurement.measured_at).toISOString().slice(0, 16)
                : "",
              replicateWeights: ([1, 2, 3] as const).map((replicate) => ({
                replicate,
                weight:
                  (weights ?? []).find(
                    (weight) =>
                      weight.measurement_id === measurement.id &&
                      weight.replicate === replicate,
                  )?.weight_mg?.toString() ?? "",
              })),
            })),
        })),
        updatedAt: record.updated_at,
      };
    }
  } else if (id !== "new") {
    experiment.id = id;
  }

  return <ExperimentEditor demoMode={!configured} initialExperiment={experiment} />;
}
