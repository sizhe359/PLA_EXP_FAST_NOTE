import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  if (!isSupabaseConfigured()) redirect("/experiments");
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/experiments");

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <LoginForm />
    </main>
  );
}
