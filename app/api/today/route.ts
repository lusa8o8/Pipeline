import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type DreamRow = {
  id: string;
  title: string;
};

type PipelineRow = {
  id: string;
  dream_id: string;
};

type CardRow = {
  id: string;
  title: string;
  status: string;
  focused_at: string | null;
  stage_id: string;
  pipeline_id: string;
};

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  console.info("[today] user.id:", user?.id);

  const { data: activeDreams, error: dreamsError } = await supabase
    .from("dreams")
    .select("id,title")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (dreamsError) {
    return NextResponse.json({ message: dreamsError.message }, { status: 500 });
  }

  const activeDreamRows = (activeDreams ?? []) as DreamRow[];
  const activeDreamIds = activeDreamRows.map((dream) => dream.id);

  console.info("[today] activeDreamIds:", activeDreamIds);

  if (activeDreamIds.length === 0) {
    console.info("[GET /api/today] no active dreams", { user_id: user.id });
    return NextResponse.json({ today: [] });
  }

  const { data: activePipelines, error: pipelinesError } = await supabase
    .from("pipelines")
    .select("id,dream_id")
    .eq("user_id", user.id)
    .in("dream_id", activeDreamIds);

  if (pipelinesError) {
    return NextResponse.json({ message: pipelinesError.message }, { status: 500 });
  }

  const activePipelineRows = (activePipelines ?? []) as PipelineRow[];
  const activePipelineIds = activePipelineRows.map((pipeline) => pipeline.id);

  console.info("[today] activePipelineIds:", activePipelineIds);

  if (activePipelineIds.length === 0) {
    console.info("[GET /api/today] no active pipelines", {
      user_id: user.id,
      active_dream_ids: activeDreamIds,
    });
    return NextResponse.json({ today: [] });
  }

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id,title,status,focused_at,stage_id,pipeline_id")
    .eq("user_id", user.id)
    .eq("status", "doing")
    .in("pipeline_id", activePipelineIds)
    .order("focused_at", { ascending: true, nullsFirst: false });

  if (cardsError) {
    return NextResponse.json({ message: cardsError.message }, { status: 500 });
  }

  const cardRows = (cards ?? []) as CardRow[];
  const projectIds = Array.from(new Set(cardRows.map((card) => card.stage_id)));

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id,name")
    .in("id", projectIds.length > 0 ? projectIds : ["00000000-0000-0000-0000-000000000000"]);

  if (projectsError) {
    return NextResponse.json({ message: projectsError.message }, { status: 500 });
  }

  const dreamMap = new Map(activeDreamRows.map((dream) => [dream.id, dream.title]));
  const pipelineMap = new Map(activePipelineRows.map((pipeline) => [pipeline.id, pipeline.dream_id]));
  const projectMap = new Map((projects ?? []).map((project) => [project.id, project.name]));

  console.info("[GET /api/today] filtered result", {
    user_id: user.id,
    active_dream_ids: activeDreamIds,
    active_pipeline_ids: activePipelineIds,
    doing_cards_count: cardRows.length,
  });

  const today = cardRows.map((card) => {
    const dreamId = pipelineMap.get(card.pipeline_id) ?? "";

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

  return NextResponse.json({ today });
}

