import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ActivePipeline = {
  id: string;
  dream_id: string;
  dreams: Array<{ id: string; title: string; status: "active" | "archived" }>;
};

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id,title,status,focused_at,stage_id,pipeline_id")
    .eq("user_id", user.id)
    .eq("status", "doing")
    .order("focused_at", { ascending: true, nullsFirst: false });

  if (cardsError) {
    return NextResponse.json({ message: cardsError.message }, { status: 500 });
  }

  const projectIds = Array.from(new Set((cards ?? []).map((card) => card.stage_id)));
  const pipelineIds = Array.from(new Set((cards ?? []).map((card) => card.pipeline_id)));

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id,name")
    .in("id", projectIds.length > 0 ? projectIds : ["00000000-0000-0000-0000-000000000000"]);

  if (projectsError) {
    return NextResponse.json({ message: projectsError.message }, { status: 500 });
  }

  const { data: pipelines, error: pipelinesError } = await supabase
    .from("pipelines")
    .select("id,dream_id,dreams!inner(id,title,status)")
    .in("id", pipelineIds.length > 0 ? pipelineIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("dreams.status", "active");

  if (pipelinesError) {
    return NextResponse.json({ message: pipelinesError.message }, { status: 500 });
  }

  const activePipelines = (pipelines ?? []) as ActivePipeline[];
  const activePipelineIds = new Set(activePipelines.map((pipeline) => pipeline.id));

  const projectMap = new Map((projects ?? []).map((project) => [project.id, project.name]));
  const pipelineMap = new Map(activePipelines.map((pipeline) => [pipeline.id, pipeline]));

  const today = (cards ?? [])
    .filter((card) => activePipelineIds.has(card.pipeline_id))
    .map((card) => {
      const pipeline = pipelineMap.get(card.pipeline_id);
      const dream = pipeline?.dreams?.[0];

      return {
        card_id: card.id,
        card_title: card.title,
        status: card.status,
        focused_at: card.focused_at,
        project_name: projectMap.get(card.stage_id) ?? "Unknown project",
        pipeline_id: card.pipeline_id,
        dream_title: dream?.title ?? "Unknown dream",
        dream_id: pipeline?.dream_id ?? "",
      };
    });

  return NextResponse.json({ today });
}

