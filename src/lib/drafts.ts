"use client";

import { openDB } from "idb";
import type { Experiment } from "@/lib/types";

const DB_NAME = "lab-quick-note";
const STORE_NAME = "drafts";

async function getDatabase() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function saveDraft(key: string, experiment: Experiment) {
  const database = await getDatabase();
  await database.put(STORE_NAME, experiment, key);
}

export async function loadDraft(key: string) {
  const database = await getDatabase();
  return (await database.get(STORE_NAME, key)) as Experiment | undefined;
}

export async function deleteDraft(key: string) {
  const database = await getDatabase();
  await database.delete(STORE_NAME, key);
}
