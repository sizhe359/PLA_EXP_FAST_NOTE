import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  getAllExperiments,
  markSynced,
  markSyncError,
  saveExperiment,
} from "@android/lib/local-db";
import type { AndroidExperiment } from "@android/lib/android-types";
import type { Experiment, ExperimentSample } from "@/lib/types";

let client: SupabaseClient | null = null;

export function isSupabaseBackupConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export function getSupabaseBackupClient() {
  if (client) return client;
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) {
    throw new Error("未配置 Supabase，当前只能本地使用。");
  }
  client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export async function getCurrentUser() {
  if (!isSupabaseBackupConfigured()) return null;
  const supabase = getSupabaseBackupClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function signInForBackup(email: string, password: string) {
  const supabase = getSupabaseBackupClient();
  const result = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (result.error) throw result.error;
  return result.data.user;
}

export async function signOutBackup() {
  if (!isSupabaseBackupConfigured()) return;
  await getSupabaseBackupClient().auth.signOut();
}

export async function syncBackup() {
  const supabase = getSupabaseBackupClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("请先登录后再备份。");

  const pulled = await fetchRemoteExperiments(supabase);
  const local = await getAllExperiments();
  const localById = new Map(local.map((experiment) => [experiment.id, experiment]));

  for (const remote of pulled) {
    const localRecord = remote.id ? localById.get(remote.id) : undefined;
    if (!localRecord || isNewer(remote.updatedAt, localRecord.updatedAt)) {
      await saveExperiment(
        {
          ...remote,
          remoteId: remote.id,
          syncStatus: "synced",
          syncError: undefined,
          localUpdatedAt: remote.updatedAt ?? new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
        },
        {
          markDirty: false,
          remoteId: remote.id,
          syncStatus: "synced",
          lastSyncedAt: new Date().toISOString(),
        },
      );
    }
  }

  const mergedLocal = await getAllExperiments();
  let uploaded = 0;
  const downloaded = pulled.length;
  for (const experiment of mergedLocal) {
    if (experiment.syncStatus === "synced" && experiment.lastSyncedAt) continue;
    try {
      const remoteId = await pushExperiment(supabase, user, experiment);
      await markSynced(experiment, remoteId);
      uploaded += 1;
    } catch (error) {
      await markSyncError(
        experiment,
        error instanceof Error ? error.message : "备份失败",
      );
      throw error;
    }
  }

  return { uploaded, downloaded };
}

async function pushExperiment(
  supabase: SupabaseClient,
  user: User,
  experiment: AndroidExperiment,
) {
  const remoteId = experiment.remoteId ?? experiment.id;
  const timestamp = new Date().toISOString();
  const { data: saved, error } = await supabase
    .from("experiments")
    .upsert({
      id: remoteId,
      user_id: user.id,
      title: experiment.title,
      experiment_date: experiment.experimentDate,
      sample_name: experiment.sampleName,
      batch_number: experiment.batchNumber,
      notes: experiment.notes,
      status: experiment.status,
      template_snapshot: experiment.templateSnapshot,
      field_values: experiment.fieldValues,
      calculation_results: experiment.calculationResults,
      updated_at: experiment.updatedAt ?? timestamp,
    })
    .select("id")
    .single();
  if (error || !saved) throw new Error(error?.message ?? "实验备份失败");

  const experimentId = String(saved.id);
  const { error: deleteError } = await supabase
    .from("experiment_samples")
    .delete()
    .eq("experiment_id", experimentId);
  if (deleteError) throw new Error(deleteError.message);

  if (experiment.samples.length === 0) return experimentId;

  const { error: samplesError } = await supabase.from("experiment_samples").insert(
    experiment.samples.map((sample, position) => ({
      id: sample.id,
      experiment_id: experimentId,
      user_id: user.id,
      name: sample.name,
      position,
      updated_at: timestamp,
    })),
  );
  if (samplesError) throw new Error(samplesError.message);

  const measurements = experiment.samples.flatMap((sample) =>
    sample.measurements.map((measurement, position) => ({
      id: measurement.id,
      sample_id: sample.id,
      experiment_id: experimentId,
      user_id: user.id,
      measured_at: measurement.measuredAt || null,
      position,
      updated_at: timestamp,
    })),
  );
  if (measurements.length === 0) return experimentId;

  const { error: measurementsError } = await supabase
    .from("sample_measurements")
    .insert(measurements);
  if (measurementsError) throw new Error(measurementsError.message);

  const replicateWeights = experiment.samples.flatMap((sample) =>
    sample.measurements.flatMap((measurement) =>
      measurement.replicateWeights.map((entry) => ({
        measurement_id: measurement.id,
        experiment_id: experimentId,
        user_id: user.id,
        replicate: entry.replicate,
        weight_mg: entry.weight.trim() ? Number(entry.weight) : null,
        updated_at: timestamp,
      })),
    ),
  );
  const { error: weightsError } = await supabase
    .from("replicate_weights")
    .insert(replicateWeights);
  if (weightsError) throw new Error(weightsError.message);

  return experimentId;
}

async function fetchRemoteExperiments(supabase: SupabaseClient) {
  const [
    { data: experiments, error: experimentsError },
    { data: samples, error: samplesError },
    { data: measurements, error: measurementsError },
    { data: weights, error: weightsError },
  ] = await Promise.all([
    supabase.from("experiments").select("*").order("updated_at", { ascending: false }),
    supabase.from("experiment_samples").select("*").order("position"),
    supabase.from("sample_measurements").select("*").order("position"),
    supabase.from("replicate_weights").select("*").order("replicate"),
  ]);
  const error = experimentsError ?? samplesError ?? measurementsError ?? weightsError;
  if (error) throw new Error(error.message);

  return (experiments ?? []).map((record) =>
    remoteToExperiment(record, samples ?? [], measurements ?? [], weights ?? []),
  );
}

function remoteToExperiment(
  record: Record<string, unknown>,
  sampleRows: Record<string, unknown>[],
  measurementRows: Record<string, unknown>[],
  weightRows: Record<string, unknown>[],
): AndroidExperiment {
  const experimentId = String(record.id);
  const samples: ExperimentSample[] = sampleRows
    .filter((sample) => sample.experiment_id === experimentId)
    .map((sample) => ({
      id: String(sample.id),
      name: String(sample.name),
      position: Number(sample.position),
      measurements: measurementRows
        .filter((measurement) => measurement.sample_id === sample.id)
        .map((measurement) => ({
          id: String(measurement.id),
          position: Number(measurement.position),
          measuredAt: measurement.measured_at
            ? new Date(String(measurement.measured_at)).toISOString().slice(0, 16)
            : "",
          replicateWeights: ([1, 2, 3] as const).map((replicate) => ({
            replicate,
            weight:
              weightRows.find(
                (weight) =>
                  weight.measurement_id === measurement.id &&
                  Number(weight.replicate) === replicate,
              )?.weight_mg?.toString() ?? "",
          })),
        })),
    }));
  return {
    id: experimentId,
    remoteId: experimentId,
    title: String(record.title),
    experimentDate: String(record.experiment_date),
    sampleName: String(record.sample_name ?? ""),
    batchNumber: String(record.batch_number ?? ""),
    notes: String(record.notes ?? ""),
    status: record.status === "archived" ? "archived" : "active",
    templateSnapshot: record.template_snapshot as Experiment["templateSnapshot"],
    fieldValues: record.field_values as Experiment["fieldValues"],
    calculationResults: record.calculation_results as Experiment["calculationResults"],
    samples,
    syncStatus: "synced",
    localUpdatedAt: String(record.updated_at),
    lastSyncedAt: new Date().toISOString(),
    updatedAt: String(record.updated_at),
  };
}

function isNewer(left?: string, right?: string) {
  return new Date(left ?? 0).getTime() > new Date(right ?? 0).getTime();
}

function getSupabaseUrl() {
  return import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getSupabaseAnonKey() {
  return (
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
