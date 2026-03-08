import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ConfirmBody = {
  dream_id?: string;
  stages?: string[];
};

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ConfirmBody;
  const dreamId = body.dream_id;
  const projectNames =
    body.stages
      ?.map((stage) => stage.trim())
      .filter((stage) => stage.length > 0) ?? [];

  if (!dreamId || projectNames.length < 4 || projectNames.length > 6) {
    return NextResponse.json(
      { message: "dream_id and 4-6 stages are required." },
      { status: 400 }
    );
  }

  const { data: dream, error: dreamError } = await supabase
    .from("dreams")
    .select("id,user_id")
    .eq("id", dreamId)
    .eq("user_id", user.id)
    .single();

  if (dreamError || !dream) {
    return NextResponse.json({ message: "Dream not found." }, { status: 404 });
  }

  const { data: existingPipeline } = await supabase
    .from("pipelines")
    .select("id")
    .eq("dream_id", dreamId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingPipeline?.id) {
    return NextResponse.json(
      { message: "Pipeline already exists.", pipeline_id: existingPipeline.id },
      { status: 400 }
    );
  }

  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .insert({ dream_id: dreamId, user_id: user.id })
    .select("id,dream_id,user_id,goal_target,created_at")
    .single();

  if (pipelineError || !pipeline) {
    return NextResponse.json(
      { message: pipelineError?.message ?? "Failed to create pipeline." },
      { status: 500 }
    );
  }

  const projectRows = projectNames.map((name, position) => ({
    pipeline_id: pipeline.id,
    name,
    position,
  }));

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .insert(projectRows)
    .select("id,pipeline_id,name,position,created_at")
    .order("position", { ascending: true });

  if (projectsError) {
    return NextResponse.json({ message: projectsError.message }, { status: 500 });
  }

  return NextResponse.json({ pipeline: { ...pipeline, projects: projects ?? [] } });
}
