import { Archive, Copy, FlaskConical, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { formatDate } from "@/lib/utils";
import { BackupPanel } from "@android/components/BackupPanel";
import type { AndroidExperimentSummary } from "@android/lib/android-types";
import {
  archiveExperiment,
  copyExperiment,
  listExperiments,
} from "@android/lib/local-db";

export function AndroidExperimentList() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [experiments, setExperiments] = useState<AndroidExperimentSummary[]>([]);

  async function refresh() {
    setExperiments(await listExperiments());
  }

  useEffect(() => {
    let active = true;
    listExperiments().then((items) => {
      if (active) setExperiments(items);
    });
    return () => {
      active = false;
    };
  }, []);

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
    if (action === "archive") await archiveExperiment(id);
    if (action === "copy") {
      const copy = await copyExperiment(id);
      if (copy?.id) navigate(`/experiments/${copy.id}`);
    }
    await refresh();
  }

  return (
    <main className="safe-bottom mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-semibold text-primary">安卓本地模式</p>
          <h1 className="text-3xl font-bold tracking-tight">实验记录</h1>
          <p className="mt-1 text-sm text-muted">数据优先保存在手机 SQLite。</p>
        </div>
        <Link
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm"
          to="/experiments/new"
        >
          <Plus size={20} />
          新建
        </Link>
      </div>

      <div className="mb-5">
        <BackupPanel onSynced={refresh} />
      </div>

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
              <Link className="block min-h-28 p-4" to={`/experiments/${item.id}`}>
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
                <p className="mt-2 text-xs text-muted">
                  {syncStatusText(item.syncStatus)}
                  {item.syncError && `：${item.syncError}`}
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

function syncStatusText(status: AndroidExperimentSummary["syncStatus"]) {
  if (status === "synced") return "已备份";
  if (status === "syncing") return "同步中";
  if (status === "error") return "备份失败";
  return "本地已保存";
}
