import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import {
  ExperimentList,
  type ExperimentSummary,
} from "@/components/experiment-list";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function ExperimentsPage() {
  const configured = isSupabaseConfigured();
  let experiments: ExperimentSummary[] = [];

  if (configured) {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data } = await supabase
      .from("experiments")
      .select("id,title,experiment_date,sample_name,batch_number,status,updated_at")
      .order("updated_at", { ascending: false });
    experiments = (data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      experimentDate: item.experiment_date,
      sampleName: item.sample_name,
      batchNumber: item.batch_number,
      status: item.status,
      updatedAt: item.updated_at,
    }));
  }

  return (
    <>
      <AppHeader demoMode={!configured} />
      <ExperimentList
        demoMode={!configured}
        initialExperiments={experiments}
      />
    </>
  );
}
