"use client";

import { FlaskConical, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AppHeader({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[#f4f7f5e8] backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between px-4">
        <Link className="flex min-h-11 items-center gap-2 font-bold" href="/experiments">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white">
            <FlaskConical size={20} />
          </span>
          实验速记
        </Link>
        {demoMode ? (
          <span className="rounded-full bg-[#fff4ce] px-3 py-1.5 text-xs font-semibold text-[#6c5200]">
            本地演示
          </span>
        ) : (
          <Button aria-label="退出登录" onClick={signOut} size="icon" variant="ghost">
            <LogOut size={19} />
          </Button>
        )}
      </div>
    </header>
  );
}
