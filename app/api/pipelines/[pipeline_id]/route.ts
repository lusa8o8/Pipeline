import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: { pipeline_id: string } };

type PatchBody = {
  goal_target?: number;
};

export async function GET(_request: Request, { params }: Params) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .select("id,dream_id,user_id,goal_target,created_at")
    .eq("id", params.pipeline_id)
    .eq("user_id", user.id)
    .single();

  if (pipelineError || !pipeline) {
    return NextResponse.json({ message: "Pipeline not found." }, { status: 404 });
  }

  const { data: dream, error: dreamError } = await supabase
    .from("dreams")
    .select("title,goals(outcome,created_at)")
    .eq("id", pipeline.dream_id)
    .eq("user_id", user.id)
    .single();

  if (dreamError || !dream) {
    return NextResponse.json({ message: "Dream not found." }, { status: 404 });
  }

  const { data: stages, error: stagesError } = await supabase
    .from("stages")
    .select(
      "id,pipeline_id,name,position,created_at,cards(id,stage_id,pipeline_id,user_id,title,position,created_at)"
    )
    .eq("pipeline_id", pipeline.id)
    .order("position", { ascending: true });

  if (stagesError) {
    return NextResponse.json({ message: stagesError.message }, { status: 500 });
  }

  const normalizedStages = (stages ?? []).map((stage) => ({
    ...stage,
    cards: [...(stage.cards ?? [])].sort((a, b) => a.position - b.position),
  }));

  const finalStage = [...normalizedStages].sort((a, b) => b.position - a.position)[0];
  const finalStageId = finalStage?.id ?? null;
  const finalStageCardCount = finalStage?.cards?.length ?? 0;

  return NextResponse.json({
    pipeline,
    dream_title: dream.title,
    goal_outcome: dream.goals?.[0]?.outcome ?? "No goal found.",
    goal_target: pipeline.goal_target,
    final_stage_id: finalStageId,
    final_stage_card_count: finalStageCardCount,
    stages: normalizedStages,
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as PatchBody;
  const goalTarget = Number(body.goal_target);

  if (!Number.isInteger(goalTarget) || goalTarget <= 0) {
    return NextResponse.json({ message: "goal_target must be a positive integer." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pipelines")
    .update({ goal_target: goalTarget })
    .eq("id", params.pipeline_id)
    .eq("user_id", user.id)
    .select("id,dream_id,user_id,goal_target,created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ message: "Pipeline not found." }, { status: 404 });
  }

  return NextResponse.json({ pipeline: data });
}
