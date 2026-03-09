export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TodayClient } from "./today-client";

type TodayItem = {
  card_id: string;
  card_title: string;
  status: string;
  focused_at: string | null;
  project_name: string;
  pipeline_id: string;
  dream_title: string;
  dream_id: string;
};

export default async function TodayPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: activeDream } = await supabase
    .from("dreams")
    .select("title")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: activeDreams } = await supabase
    .from("dreams")
    .select("id,title")
    .eq("user_id", user.id)
    .eq("status", "active");

  const activeDreamIds = (activeDreams ?? []).map((dream) => dream.id);

  if (activeDreamIds.length === 0) {
    return (
      <main className="flex bg-[var(--bg)] text-[var(--text-primary)]">
        <div className="flex-1 pb-[80px] md:pb-0"><TodayClient initialItems={[]} activeDreamTitle={activeDream?.title ?? "No active dream"} /></div>
      </main>
    );
  }

  const { data: activePipelines } = await supabase
    .from("pipelines")
    .select("id,dream_id")
    .eq("user_id", user.id)
    .in("dream_id", activeDreamIds);

  const activePipelineIds = (activePipelines ?? []).map((pipeline) => pipeline.id);

  if (activePipelineIds.length === 0) {
    return (
      <main className="flex bg-[var(--bg)] text-[var(--text-primary)]">
        <div className="flex-1 pb-[80px] md:pb-0"><TodayClient initialItems={[]} activeDreamTitle={activeDream?.title ?? "No active dream"} /></div>
      </main>
    );
  }

  const { data: cards } = await supabase
    .from("cards")
    .select("id,title,status,focused_at,stage_id,pipeline_id")
    .eq("user_id", user.id)
    .eq("status", "doing")
    .in("pipeline_id", activePipelineIds)
    .order("focused_at", { ascending: true, nullsFirst: false });

  const projectIds = Array.from(new Set((cards ?? []).map((card) => card.stage_id)));

  const { data: projects } = await supabase
    .from("projects")
    .select("id,name")
    .in("id", projectIds.length > 0 ? projectIds : ["00000000-0000-0000-0000-000000000000"]);

  const projectMap = new Map((projects ?? []).map((project) => [project.id, project.name]));
  const pipelineMap = new Map((activePipelines ?? []).map((pipeline) => [pipeline.id, pipeline]));
  const dreamMap = new Map((activeDreams ?? []).map((dream) => [dream.id, dream.title]));

  const todayItems: TodayItem[] = (cards ?? []).map((card) => {
    const pipeline = pipelineMap.get(card.pipeline_id);
    const dreamId = pipeline?.dream_id ?? "";

    return {
      card_id: card.id,
      card_title: card.title,
      status: card.status,
      focused_at: card.focused_at,
      project_name: projectMap.get(card.stage_id) ?? "Unknown project",
      pipeline_id: card.pipeline_id,
      dream_title: dreamMap.get(dreamId) ?? "Unknown dream",
      dream_id: dreamId,
    };
  });

  return (
    <main className="flex bg-[var(--bg)] text-[var(--text-primary)]">
      <div className="flex-1 pb-[80px] md:pb-0"><TodayClient initialItems={todayItems} activeDreamTitle={activeDream?.title ?? "No active dream"} /></div>
    </main>
  );
}








