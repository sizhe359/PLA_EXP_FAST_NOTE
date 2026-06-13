import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { action } = (await request.json()) as {
    action?: "archive" | "copy";
  };
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  if (action === "archive") {
    const { error } = await supabase
      .from("experiments")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", id);
    return error
      ? NextResponse.json({ error: error.message }, { status: 500 })
      : NextResponse.json({ ok: true });
  }

  if (action === "copy") {
    const [{ data: source }, { data: samples }] = await Promise.all([
      supabase.from("experiments").select("*").eq("id", id).single(),
      supabase
        .from("experiment_samples")
        .select("*")
        .eq("experiment_id", id)
        .order("position"),
    ]);
    if (!source) return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    const { id: _id, created_at: _createdAt, ...copyFields } = source;
    void _id;
    void _createdAt;
    const { data: copy, error } = await supabase
      .from("experiments")
      .insert({
        ...copyFields,
        user_id: user.id,
        title: `${source.title}（副本）`,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !copy) {
      return NextResponse.json({ error: error?.message }, { status: 500 });
    }
    // Copying measurements is intentionally deferred to the editor save path.
    // The copied experiment starts with the same sample names and empty histories.
    if (samples?.length) {
      await supabase.from("experiment_samples").insert(
        samples.map((sample) => ({
          id: crypto.randomUUID(),
          experiment_id: copy.id,
          user_id: user.id,
          name: sample.name,
          position: sample.position,
        })),
      );
    }
    return NextResponse.json({ id: copy.id });
  }

  return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
}
