import { NextResponse } from "next/server";
import { experimentSchema } from "@/lib/validation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const parsed = experimentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "数据格式错误" },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const record = {
    ...(input.id ? { id: input.id } : {}),
    user_id: user.id,
    title: input.title,
    experiment_date: input.experimentDate,
    sample_name: input.sampleName,
    batch_number: input.batchNumber,
    notes: input.notes,
    status: input.status,
    template_snapshot: input.templateSnapshot,
    field_values: input.fieldValues,
    calculation_results: input.calculationResults,
    updated_at: new Date().toISOString(),
  };
  const { data: saved, error } = await supabase
    .from("experiments")
    .upsert(record)
    .select("id,updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: deleteError } = await supabase
    .from("experiment_samples")
    .delete()
    .eq("experiment_id", saved.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }
  if (input.samples.length > 0) {
    const { error: samplesError } = await supabase.from("experiment_samples").insert(
      input.samples.map((sample, position) => ({
        id: sample.id,
        experiment_id: saved.id,
        user_id: user.id,
        name: sample.name,
        position,
        updated_at: new Date().toISOString(),
      })),
    );
    if (samplesError) {
      return NextResponse.json({ error: samplesError.message }, { status: 500 });
    }
    const measurements = input.samples.flatMap((sample) =>
      sample.measurements.map((measurement, position) => ({
        id: measurement.id,
        sample_id: sample.id,
        experiment_id: saved.id,
        user_id: user.id,
        measured_at: measurement.measuredAt || null,
        position,
        updated_at: new Date().toISOString(),
      })),
    );
    if (measurements.length > 0) {
      const { error: measurementsError } = await supabase
        .from("sample_measurements")
        .insert(measurements);
      if (measurementsError) {
        return NextResponse.json(
          { error: measurementsError.message },
          { status: 500 },
        );
      }
      const replicateWeights = input.samples.flatMap((sample) =>
        sample.measurements.flatMap((measurement) =>
          measurement.replicateWeights.map((entry) => ({
            measurement_id: measurement.id,
            experiment_id: saved.id,
            user_id: user.id,
            replicate: entry.replicate,
            weight_mg: entry.weight.trim() ? Number(entry.weight) : null,
            updated_at: new Date().toISOString(),
          })),
        ),
      );
      const { error: weightsError } = await supabase
        .from("replicate_weights")
        .insert(replicateWeights);
      if (weightsError) {
        return NextResponse.json(
          { error: weightsError.message },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({ id: saved.id, updatedAt: saved.updated_at });
}
