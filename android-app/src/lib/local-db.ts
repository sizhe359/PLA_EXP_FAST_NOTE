import { Capacitor } from "@capacitor/core";
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import type {
  AndroidExperiment,
  AndroidExperimentSummary,
  SyncStatus,
} from "@android/lib/android-types";
import type {
  Experiment,
  ExperimentSample,
  SampleMeasurement,
} from "@/lib/types";
import { createId } from "@/lib/utils";

const DB_NAME = "lab_quick_note";
const FALLBACK_KEY = "lab-quick-note-android-fallback-v1";

let dbPromise: Promise<SQLiteDBConnection | null> | null = null;

function nowIso() {
  return new Date().toISOString();
}

function isNativeSQLite() {
  return Capacitor.getPlatform() === "android" || Capacitor.getPlatform() === "ios";
}

function asAndroidExperiment(
  experiment: Experiment,
  syncStatus: SyncStatus = "local",
): AndroidExperiment {
  const timestamp = experiment.updatedAt ?? nowIso();
  return {
    ...experiment,
    id: experiment.id ?? createId(),
    updatedAt: timestamp,
    localUpdatedAt: timestamp,
    syncStatus,
  };
}

async function getDb() {
  if (!isNativeSQLite()) return null;
  dbPromise ??= openDb();
  return dbPromise;
}

async function openDb() {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const consistency = await sqlite.checkConnectionsConsistency();
  if (!consistency.result) await sqlite.closeAllConnections();
  const existing = await sqlite.isConnection(DB_NAME, false);
  const db = existing.result
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
  await db.open();
  await db.execute("PRAGMA foreign_keys = ON;");
  await db.execute(SCHEMA);
  return db;
}

const SCHEMA = `
create table if not exists experiments (
  id text primary key,
  remote_id text,
  title text not null,
  experiment_date text not null,
  sample_name text not null default '',
  batch_number text not null default '',
  notes text not null default '',
  status text not null,
  template_snapshot_json text not null,
  field_values_json text not null,
  calculation_results_json text not null,
  sync_status text not null default 'local',
  sync_error text,
  local_updated_at text not null,
  last_synced_at text,
  updated_at text not null
);

create table if not exists experiment_samples (
  id text primary key,
  experiment_id text not null references experiments(id) on delete cascade,
  name text not null,
  position integer not null
);

create table if not exists sample_measurements (
  id text primary key,
  sample_id text not null references experiment_samples(id) on delete cascade,
  experiment_id text not null references experiments(id) on delete cascade,
  measured_at text,
  position integer not null
);

create table if not exists replicate_weights (
  id text primary key,
  measurement_id text not null references sample_measurements(id) on delete cascade,
  experiment_id text not null references experiments(id) on delete cascade,
  replicate integer not null,
  weight_mg text
);

create index if not exists experiments_status_updated_idx
  on experiments (status, updated_at desc);
create index if not exists samples_experiment_position_idx
  on experiment_samples (experiment_id, position);
create index if not exists measurements_sample_position_idx
  on sample_measurements (sample_id, position);
create index if not exists weights_measurement_replicate_idx
  on replicate_weights (measurement_id, replicate);
`;

function runInCurrentTransaction(
  db: SQLiteDBConnection,
  statement: string,
  values?: unknown[],
) {
  return db.run(statement, values, false);
}

function loadFallback() {
  const stored = localStorage.getItem(FALLBACK_KEY);
  return stored ? (JSON.parse(stored) as AndroidExperiment[]) : [];
}

function saveFallback(experiments: AndroidExperiment[]) {
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(experiments));
}

function toSummary(experiment: AndroidExperiment): AndroidExperimentSummary {
  return {
    id: experiment.id ?? "",
    title: experiment.title,
    experimentDate: experiment.experimentDate,
    sampleName: `${experiment.samples.length} 种样品`,
    batchNumber: experiment.batchNumber,
    status: experiment.status,
    updatedAt: experiment.updatedAt ?? experiment.localUpdatedAt,
    syncStatus: experiment.syncStatus,
    syncError: experiment.syncError,
  };
}

export async function listExperiments() {
  const db = await getDb();
  if (!db) {
    return loadFallback()
      .map(toSummary)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
  const result = await db.query(
    `select id, title, experiment_date as experimentDate, batch_number as batchNumber,
      status, updated_at as updatedAt, sync_status as syncStatus, sync_error as syncError
     from experiments
     order by updated_at desc`,
  );
  return (result.values ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    experimentDate: String(row.experimentDate),
    sampleName: "",
    batchNumber: String(row.batchNumber ?? ""),
    status: row.status === "archived" ? "archived" : "active",
    updatedAt: String(row.updatedAt),
    syncStatus: normalizeSyncStatus(row.syncStatus),
    syncError: row.syncError ? String(row.syncError) : undefined,
  })) satisfies AndroidExperimentSummary[];
}

export async function getExperiment(id: string) {
  const db = await getDb();
  if (!db) {
    return loadFallback().find((item) => item.id === id) ?? null;
  }
  const experimentRows = await db.query("select * from experiments where id = ?", [id]);
  const row = experimentRows.values?.[0];
  if (!row) return null;
  const samples = await db.query(
    "select * from experiment_samples where experiment_id = ? order by position",
    [id],
  );
  const measurements = await db.query(
    "select * from sample_measurements where experiment_id = ? order by position",
    [id],
  );
  const weights = await db.query(
    "select * from replicate_weights where experiment_id = ? order by replicate",
    [id],
  );
  return rowToExperiment(row, samples.values ?? [], measurements.values ?? [], weights.values ?? []);
}

export async function getAllExperiments() {
  const summaries = await listExperiments();
  const records = await Promise.all(summaries.map((item) => getExperiment(item.id)));
  return records.filter((item): item is AndroidExperiment => Boolean(item));
}

export async function saveExperiment(
  experiment: Experiment | AndroidExperiment,
  options: {
    markDirty?: boolean;
    remoteId?: string;
    syncStatus?: SyncStatus;
    syncError?: string;
    lastSyncedAt?: string;
  } = {},
) {
  const saved = asAndroidExperiment(
    {
      ...experiment,
      id: experiment.id ?? createId(),
      updatedAt: options.markDirty === false ? experiment.updatedAt : nowIso(),
    },
    options.syncStatus ??
      (options.markDirty === false
        ? ("synced" as const)
        : ((experiment as AndroidExperiment).syncStatus ?? "local")),
  );
  saved.remoteId = options.remoteId ?? (experiment as AndroidExperiment).remoteId;
  saved.syncError = options.syncError;
  saved.lastSyncedAt = options.lastSyncedAt ?? (experiment as AndroidExperiment).lastSyncedAt;
  saved.localUpdatedAt =
    options.markDirty === false
      ? ((experiment as AndroidExperiment).localUpdatedAt ?? saved.updatedAt ?? nowIso())
      : nowIso();

  const db = await getDb();
  if (!db) {
    const list = loadFallback();
    saveFallback([saved, ...list.filter((item) => item.id !== saved.id)]);
    return saved;
  }

  await db.beginTransaction();
  try {
    await runInCurrentTransaction(
      db,
      `insert into experiments (
        id, remote_id, title, experiment_date, sample_name, batch_number, notes,
        status, template_snapshot_json, field_values_json, calculation_results_json,
        sync_status, sync_error, local_updated_at, last_synced_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        remote_id = excluded.remote_id,
        title = excluded.title,
        experiment_date = excluded.experiment_date,
        sample_name = excluded.sample_name,
        batch_number = excluded.batch_number,
        notes = excluded.notes,
        status = excluded.status,
        template_snapshot_json = excluded.template_snapshot_json,
        field_values_json = excluded.field_values_json,
        calculation_results_json = excluded.calculation_results_json,
        sync_status = excluded.sync_status,
        sync_error = excluded.sync_error,
        local_updated_at = excluded.local_updated_at,
        last_synced_at = excluded.last_synced_at,
        updated_at = excluded.updated_at`,
      [
        saved.id,
        saved.remoteId ?? null,
        saved.title,
        saved.experimentDate,
        saved.sampleName,
        saved.batchNumber,
        saved.notes,
        saved.status,
        JSON.stringify(saved.templateSnapshot),
        JSON.stringify(saved.fieldValues),
        JSON.stringify(saved.calculationResults),
        saved.syncStatus,
        saved.syncError ?? null,
        saved.localUpdatedAt,
        saved.lastSyncedAt ?? null,
        saved.updatedAt ?? saved.localUpdatedAt,
      ],
    );
    await runInCurrentTransaction(db, "delete from experiment_samples where experiment_id = ?", [
      saved.id,
    ]);
    for (const sample of saved.samples) {
      await runInCurrentTransaction(
        db,
        "insert into experiment_samples (id, experiment_id, name, position) values (?, ?, ?, ?)",
        [sample.id, saved.id, sample.name, sample.position],
      );
      for (const measurement of sample.measurements) {
        await runInCurrentTransaction(
          db,
          `insert into sample_measurements
            (id, sample_id, experiment_id, measured_at, position)
           values (?, ?, ?, ?, ?)`,
          [
            measurement.id,
            sample.id,
            saved.id,
            measurement.measuredAt || null,
            measurement.position,
          ],
        );
        for (const weight of measurement.replicateWeights) {
          await runInCurrentTransaction(
            db,
            `insert into replicate_weights
              (id, measurement_id, experiment_id, replicate, weight_mg)
             values (?, ?, ?, ?, ?)`,
            [
              createId(),
              measurement.id,
              saved.id,
              weight.replicate,
              weight.weight,
            ],
          );
        }
      }
    }
    await db.commitTransaction();
    return saved;
  } catch (error) {
    await db.rollbackTransaction();
    throw error;
  }
}

export async function archiveExperiment(id: string) {
  const experiment = await getExperiment(id);
  if (!experiment) return;
  await saveExperiment({ ...experiment, status: "archived" });
}

export async function copyExperiment(id: string) {
  const experiment = await getExperiment(id);
  if (!experiment) return null;
  const copy: AndroidExperiment = {
    ...experiment,
    id: createId(),
    remoteId: undefined,
    title: `${experiment.title}（副本）`,
    status: "active",
    syncStatus: "local",
    syncError: undefined,
    lastSyncedAt: undefined,
    localUpdatedAt: nowIso(),
    updatedAt: nowIso(),
    samples: experiment.samples.map((sample) => ({
      ...sample,
      id: createId(),
      measurements: [],
    })),
  };
  return saveExperiment(copy);
}

export async function markSynced(
  experiment: AndroidExperiment,
  remoteId: string,
  syncedAt = nowIso(),
) {
  return saveExperiment(
    {
      ...experiment,
      remoteId,
      syncStatus: "synced",
      syncError: undefined,
      lastSyncedAt: syncedAt,
      updatedAt: experiment.updatedAt,
      localUpdatedAt: experiment.localUpdatedAt,
    },
    {
      markDirty: false,
      remoteId,
      syncStatus: "synced",
      lastSyncedAt: syncedAt,
    },
  );
}

export async function markSyncError(experiment: AndroidExperiment, message: string) {
  return saveExperiment(
    {
      ...experiment,
      syncStatus: "error",
      syncError: message,
      updatedAt: experiment.updatedAt,
      localUpdatedAt: experiment.localUpdatedAt,
    },
    { markDirty: false, syncStatus: "error", syncError: message },
  );
}

function rowToExperiment(
  row: Record<string, unknown>,
  sampleRows: Record<string, unknown>[],
  measurementRows: Record<string, unknown>[],
  weightRows: Record<string, unknown>[],
): AndroidExperiment {
  const samples: ExperimentSample[] = sampleRows.map((sample) => ({
    id: String(sample.id),
    name: String(sample.name),
    position: Number(sample.position),
    measurements: measurementRows
      .filter((measurement) => measurement.sample_id === sample.id)
      .map((measurement) => measurementToRecord(measurement, weightRows)),
  }));
  return {
    id: String(row.id),
    remoteId: row.remote_id ? String(row.remote_id) : undefined,
    title: String(row.title),
    experimentDate: String(row.experiment_date),
    sampleName: String(row.sample_name ?? ""),
    batchNumber: String(row.batch_number ?? ""),
    notes: String(row.notes ?? ""),
    status: row.status === "archived" ? "archived" : "active",
    templateSnapshot: JSON.parse(String(row.template_snapshot_json)),
    fieldValues: JSON.parse(String(row.field_values_json)),
    calculationResults: JSON.parse(String(row.calculation_results_json)),
    samples,
    syncStatus: normalizeSyncStatus(row.sync_status),
    syncError: row.sync_error ? String(row.sync_error) : undefined,
    localUpdatedAt: String(row.local_updated_at),
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : undefined,
    updatedAt: String(row.updated_at),
  };
}

function measurementToRecord(
  measurement: Record<string, unknown>,
  weightRows: Record<string, unknown>[],
): SampleMeasurement {
  return {
    id: String(measurement.id),
    position: Number(measurement.position),
    measuredAt: measurement.measured_at ? String(measurement.measured_at) : "",
    replicateWeights: ([1, 2, 3] as const).map((replicate) => ({
      replicate,
      weight:
        weightRows.find(
          (weight) =>
            weight.measurement_id === measurement.id &&
            Number(weight.replicate) === replicate,
        )?.weight_mg?.toString() ?? "",
    })),
  };
}

function normalizeSyncStatus(value: unknown): SyncStatus {
  return value === "synced" || value === "syncing" || value === "error"
    ? value
    : "local";
}
