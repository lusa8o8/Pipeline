export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    .select("id,dream_id,user_id,created_at")
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
    .select("id,name,position,created_at")
    .eq("pipeline_id", pipeline.id)
    .order("position", { ascending: true });

  if (stageError) {
    throw new Error(stageError.message);
  }

  const goalOutcome = dream.goals?.[0]?.outcome ?? "No goal found.";

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">{dream.title}</h1>
      <p className="mt-2 text-gray-700">{goalOutcome}</p>
      <ul className="mt-6 list-disc space-y-2 pl-5">
        {(stages ?? []).map((stage) => (
          <li key={stage.id}>{stage.name}</li>
        ))}
      </ul>
    </main>
  );
}
