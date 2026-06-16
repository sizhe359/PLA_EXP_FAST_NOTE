import type { Experiment } from "@/lib/types";

export type SyncStatus = "local" | "syncing" | "synced" | "error";

export interface AndroidExperiment extends Experiment {
  remoteId?: string;
  syncStatus: SyncStatus;
  syncError?: string;
  localUpdatedAt: string;
  lastSyncedAt?: string;
}

export interface AndroidExperimentSummary {
  id: string;
  title: string;
  experimentDate: string;
  sampleName: string;
  batchNumber: string;
  status: "active" | "archived";
  updatedAt: string;
  syncStatus: SyncStatus;
  syncError?: string;
}
