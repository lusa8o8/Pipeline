import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: { pipeline_id: string } };

type Bottleneck = {
  project_name: string;
  type: "stuck_in_doing" | "never_started";
  card_count: number;
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
    .select("id,dream_id,user_id,created_at")
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

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select(
      "id,pipeline_id,name,position,created_at,cards(id,stage_id,pipeline_id,user_id,title,position,status,created_at)"
    )
    .eq("pipeline_id", pipeline.id)
    .order("position", { ascending: true });

  if (projectsError) {
    return NextResponse.json({ message: projectsError.message }, { status: 500 });
  }

  const normalizedProjects = (projects ?? []).map((project) => ({
    ...project,
    cards: [...(project.cards ?? [])].sort((a, b) => a.position - b.position),
  }));

  const bottlenecks: Bottleneck[] = [];

  for (const project of normalizedProjects) {
    const doingCount = project.cards.filter((card) => card.status === "doing").length;
    const doneCount = project.cards.filter((card) => card.status === "done").length;
    const backlogCount = project.cards.filter((card) => card.status === "backlog").length;

    if (doingCount >= 3 && doneCount === 0) {
      bottlenecks.push({
        project_name: project.name,
        type: "stuck_in_doing",
        card_count: doingCount,
      });
    }

    if (backlogCount >= 5 && doingCount === 0) {
      bottlenecks.push({
        project_name: project.name,
        type: "never_started",
        card_count: backlogCount,
      });
    }
  }

  return NextResponse.json({
    pipeline,
    dream_title: dream.title,
    goal_outcome: dream.goals?.[0]?.outcome ?? "No goal found.",
    projects: normalizedProjects,
    bottlenecks,
  });
}
