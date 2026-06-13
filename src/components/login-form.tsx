"use client";

import { FlaskConical, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("注册成功，请在邮箱中确认后登录。");
      return;
    }
    router.replace("/experiments");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <div className="mb-7 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white">
          <FlaskConical size={26} />
        </span>
        <div>
          <h1 className="text-2xl font-bold">实验速记</h1>
          <p className="text-sm text-muted">登录后同步你的实验记录</p>
        </div>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <Label htmlFor="email">邮箱</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="password">密码</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {message && (
          <p className="rounded-xl bg-[#fff2f0] px-3 py-2 text-sm text-danger">
            {message}
          </p>
        )}
        <Button className="w-full" disabled={loading} type="submit">
          {loading && <LoaderCircle className="animate-spin" size={18} />}
          {mode === "login" ? "登录" : "创建账号"}
        </Button>
      </form>
      <button
        className="mt-4 w-full text-sm font-medium text-primary"
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setMessage("");
        }}
      >
        {mode === "login" ? "没有账号？创建一个" : "已有账号？返回登录"}
      </button>
    </Card>
  );
}
