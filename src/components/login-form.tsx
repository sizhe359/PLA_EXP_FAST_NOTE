"use client";

import {
  Eye,
  EyeOff,
  FlaskConical,
  LoaderCircle,
} from "lucide-react";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup" | "recovery">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setPassword("");
        setMessage("请输入一个新的密码。");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    const normalizedEmail = email.trim().toLowerCase();
    if (mode === "recovery") {
      const { error } = await supabase.auth.updateUser({ password });
      setLoading(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      router.replace("/experiments");
      router.refresh();
      return;
    }
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          })
        : await supabase.auth.signUp({
            email: normalizedEmail,
            password,
          });
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

  async function resetPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setMessage("请先填写邮箱，再点击忘记密码。");
      return;
    }
    setLoading(true);
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: `${window.location.origin}/login`,
      },
    );
    setLoading(false);
    setMessage(
      error
        ? error.message
        : "重置邮件已发送。如果收件箱没有，请检查垃圾邮件。",
    );
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
        {mode !== "recovery" && (
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
        )}
        <div className="relative">
          <Label htmlFor="password">密码</Label>
          <Input
            className="pr-12"
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
            className="absolute bottom-0 right-0 grid h-11 w-11 place-items-center text-muted"
            type="button"
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {mode === "login" && (
          <button
            className="min-h-0 text-sm font-medium text-primary"
            disabled={loading}
            type="button"
            onClick={resetPassword}
          >
            忘记密码？
          </button>
        )}
        {message && (
          <p className="rounded-xl bg-[#fff2f0] px-3 py-2 text-sm text-danger">
            {message}
          </p>
        )}
        <Button className="w-full" disabled={loading} type="submit">
          {loading && <LoaderCircle className="animate-spin" size={18} />}
          {mode === "login"
            ? "登录"
            : mode === "signup"
              ? "创建账号"
              : "设置新密码"}
        </Button>
      </form>
      {mode !== "recovery" && (
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
      )}
    </Card>
  );
}
