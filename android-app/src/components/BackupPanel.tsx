import { Cloud, LogOut, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import {
  getCurrentUser,
  isSupabaseBackupConfigured,
  signInForBackup,
  signOutBackup,
  syncBackup,
} from "@android/lib/supabase-sync";

export function BackupPanel({ onSynced }: { onSynced: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const configured = isSupabaseBackupConfigured();

  useEffect(() => {
    let active = true;
    getCurrentUser().then((user) => {
      if (active) setUserEmail(user?.email ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  async function login() {
    setBusy(true);
    setMessage("");
    try {
      const user = await signInForBackup(email, password);
      setUserEmail(user?.email ?? email.trim().toLowerCase());
      setPassword("");
      setMessage("已登录，可开始备份。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    setMessage("");
    try {
      const result = await syncBackup();
      setMessage(`备份完成：上传 ${result.uploaded} 条，检查云端 ${result.downloaded} 条。`);
      onSynced();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "备份失败");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    await signOutBackup();
    setBusy(false);
    setUserEmail(null);
    setMessage("已退出备份账号，本地数据不受影响。");
  }

  return (
    <Card>
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e2f3eb] text-primary">
          <Cloud size={21} />
        </span>
        <div>
          <h2 className="font-bold">Supabase 备份</h2>
          <p className="text-sm text-muted">
            App 可完全本地使用；登录后才会把 SQLite 数据备份到云端。
          </p>
        </div>
      </div>
      {!configured ? (
        <p className="rounded-xl bg-[#fff9df] px-3 py-2 text-sm text-[#5d4a00]">
          当前 APK 构建未配置 Supabase 环境变量，只能本地使用。
        </p>
      ) : userEmail ? (
        <div className="space-y-3">
          <p className="rounded-xl bg-[#edf6f1] px-3 py-2 text-sm">
            已登录：<strong>{userEmail}</strong>
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button disabled={busy} onClick={sync}>
              {busy && <LoaderCircle className="animate-spin" size={18} />}
              立即备份/恢复
            </Button>
            <Button disabled={busy} onClick={logout} variant="secondary">
              <LogOut size={17} />
              退出备份账号
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="backup-email">邮箱</Label>
            <Input
              autoComplete="email"
              id="backup-email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="backup-password">密码</Label>
            <Input
              autoComplete="current-password"
              id="backup-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button disabled={busy || !email.trim() || !password} onClick={login}>
            {busy && <LoaderCircle className="animate-spin" size={18} />}
            登录备份账号
          </Button>
        </div>
      )}
      {message && (
        <p className="mt-3 rounded-xl bg-[#f2f5f3] px-3 py-2 text-sm">{message}</p>
      )}
    </Card>
  );
}
