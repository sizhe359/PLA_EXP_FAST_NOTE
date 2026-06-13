"use client";

import {
  Archive,
  Copy,
  FlaskConical,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { formatDate } from "@/lib/utils";

export interface ExperimentSummary {
  id: string;
  title: string;
  experimentDate: string;
  sampleName: string;
  batchNumber: string;
  status: "active" | "archived";
  updatedAt: string;
}

const DEMO_LIST_KEY = "lab-quick-note-experiments-v2";
const DEMO_VERSION_KEY = "lab-quick-note-schema";

export function ExperimentList({
  initialExperiments,
  demoMode,
}: {
  initialExperiments: ExperimentSummary[];
  demoMode: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [experiments, setExperiments] = useState(initialExperiments);

  useEffect(() => {
    if (!demoMode) return;
    if (localStorage.getItem(DEMO_VERSION_KEY) !== "2") {
      Object.keys(localStorage)
        .filter(
          (key) =>
            key === "lab-quick-note-experiments" ||
            key.startsWith("experiment-data:"),
        )
        .forEach((key) => localStorage.removeItem(key));
      localStorage.setItem(DEMO_VERSION_KEY, "2");
    }
    const stored = localStorage.getItem(DEMO_LIST_KEY);
    const timeout = window.setTimeout(() => {
      if (stored) setExperiments(JSON.parse(stored) as ExperimentSummary[]);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [demoMode]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return experiments.filter((item) => {
      const matchesStatus = showArchived
        ? item.status === "archived"
        : item.status === "active";
      const matchesQuery =
        !normalized ||
        [item.title, item.sampleName, item.batchNumber].some((value) =>
          value.toLowerCase().includes(normalized),
        );
      return matchesStatus && matchesQuery;
    });
  }, [experiments, query, showArchived]);

  async function runAction(id: string, action: "archive" | "copy") {
    if (demoMode) {
      const current = experiments.find((item) => item.id === id);
      if (!current) return;
      const next =
        action === "archive"
          ? experiments.map((item) =>
              item.id === id ? { ...item, status: "archived" as const } : item,
            )
          : [
              {
                ...current,
                id: crypto.randomUUID(),
                title: `${current.title}（副本）`,
                updatedAt: new Date().toISOString(),
              },
              ...experiments,
            ];
      setExperiments(next);
      localStorage.setItem(DEMO_LIST_KEY, JSON.stringify(next));
      return;
    }
    await fetch(`/api/experiments/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-semibold text-primary">实验工作台</p>
          <h1 className="text-3xl font-bold tracking-tight">实验记录</h1>
        </div>
        <Link
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm"
          href="/experiments/new"
        >
          <Plus size={20} />
          新建
        </Link>
      </div>

      {demoMode && (
        <div className="mb-5 rounded-2xl border border-[#eadca0] bg-[#fff9df] p-4 text-sm leading-6 text-[#5d4a00]">
          当前未配置 Supabase，记录只保存在此浏览器。按照 README 配置后即可使用账号和云同步。
        </div>
      )}

      <div className="mb-5 flex gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            size={18}
          />
          <Input
            className="pl-10"
            placeholder="搜索名称、样品或批次"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button
          onClick={() => setShowArchived((value) => !value)}
          variant={showArchived ? "primary" : "secondary"}
        >
          <Archive size={17} />
          <span className="hidden sm:inline">归档</span>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="grid min-h-64 place-items-center text-center">
          <div>
            <FlaskConical className="mx-auto mb-3 text-[#8ca298]" size={40} />
            <h2 className="font-bold">这里还没有记录</h2>
            <p className="mt-1 text-sm text-muted">点击“新建”开始第一次实验记录。</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((item) => (
            <Card className="p-0" key={item.id}>
              <Link
                className="block min-h-28 p-4"
                href={`/experiments/${item.id}`}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h2 className="font-bold leading-6">{item.title}</h2>
                  <span className="shrink-0 text-xs text-muted">
                    {formatDate(item.experimentDate)}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  {item.sampleName || "未填写样品"}
                  {item.batchNumber && ` · ${item.batchNumber}`}
                </p>
              </Link>
              {!showArchived && (
                <div className="flex border-t border-border p-2">
                  <Button
                    className="flex-1"
                    onClick={() => runAction(item.id, "copy")}
                    variant="ghost"
                  >
                    <Copy size={16} /> 复制
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => runAction(item.id, "archive")}
                    variant="ghost"
                  >
                    <Archive size={16} /> 归档
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
