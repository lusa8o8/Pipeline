import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CreateCardBody = {
  project_id?: string;
  pipeline_id?: string;
  title?: string;
  status?: "backlog" | "ready" | "doing" | "done";
};

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CreateCardBody;
  const projectId = body.project_id;
  const pipelineId = body.pipeline_id;
  const title = body.title?.trim();
  const status = body.status ?? "backlog";

  if (!projectId || !pipelineId || !title) {
    return NextResponse.json(
      { message: "project_id, pipeline_id, and title are required." },
      { status: 400 }
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,pipeline_id")
    .eq("id", projectId)
    .eq("pipeline_id", pipelineId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ message: "Project not found." }, { status: 404 });
  }

  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .select("id,user_id")
    .eq("id", pipelineId)
    .eq("user_id", user.id)
    .single();

  if (pipelineError || !pipeline) {
    return NextResponse.json({ message: "Pipeline not found." }, { status: 404 });
  }

  const { count, error: countError } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", projectId)
    .eq("pipeline_id", pipelineId)
    .eq("user_id", user.id)
    .eq("status", status);

  if (countError) {
    return NextResponse.json({ message: countError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("cards")
    .insert({
      stage_id: projectId,
      pipeline_id: pipelineId,
      user_id: user.id,
      title,
      status,
      position: count ?? 0,
    })
    .select("id,stage_id,pipeline_id,user_id,title,position,status,created_at")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ card: data });
}
