export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PipelineBoard } from "../pipeline-board";

type Card = {
  id: string;
  stage_id: string;
  pipeline_id: string;
  user_id: string;
  title: string;
  position: number;
  created_at: string;
};

type Stage = {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  created_at: string;
  cards: Card[];
};

type PageProps = {
  params: {
    pipeline_id: string;
  };
};

export default async function PipelinePage({ params }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .select("id,dream_id,user_id,goal_target,created_at")
    .eq("id", params.pipeline_id)
    .eq("user_id", user.id)
    .single();

  if (pipelineError || !pipeline) {
    notFound();
  }

  const { data: dream, error: dreamError } = await supabase
    .from("dreams")
    .select("id,title,user_id,goals(outcome,created_at)")
    .eq("id", pipeline.dream_id)
    .eq("user_id", user.id)
    .single();

  if (dreamError || !dream) {
    notFound();
  }

  const { data: stages, error: stageError } = await supabase
    .from("stages")
    .select(
      "id,pipeline_id,name,position,created_at,cards(id,stage_id,pipeline_id,user_id,title,position,created_at)"
    )
    .eq("pipeline_id", pipeline.id)
    .order("position", { ascending: true });

  if (stageError) {
    throw new Error(stageError.message);
  }

  const normalizedStages = ((stages ?? []) as Stage[]).map((stage) => ({
    ...stage,
    cards: [...(stage.cards ?? [])].sort((a, b) => a.position - b.position),
  }));

  const finalStage = [...normalizedStages].sort((a, b) => b.position - a.position)[0];

  return (
    <PipelineBoard
      pipelineId={pipeline.id}
      dreamTitle={dream.title}
      goalOutcome={dream.goals?.[0]?.outcome ?? "No goal found."}
      initialStages={normalizedStages}
      initialGoalTarget={pipeline.goal_target}
      initialFinalStageId={finalStage?.id ?? null}
    />
  );
}
