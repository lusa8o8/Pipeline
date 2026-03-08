"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Goal = {
  id: string;
  dream_id: string;
  user_id: string;
  outcome: string;
  created_at: string;
};

type Pipeline = {
  id: string;
  dream_id: string;
  user_id: string;
  created_at: string;
};

type Dream = {
  id: string;
  user_id: string;
  title: string;
  status: "active" | "archived";
  created_at: string;
  goals: Goal[];
  pipelines: Pipeline[];
};

type DashboardClientProps = {
  initialDreams: Dream[];
};

export function DashboardClient({ initialDreams }: DashboardClientProps) {
  const router = useRouter();
  const [dreams, setDreams] = useState<Dream[]>(initialDreams);
  const [step, setStep] = useState<"list" | "dream" | "goal" | "pipeline">(
    initialDreams.length === 0 ? "dream" : "list"
  );
  const [dreamTitle, setDreamTitle] = useState("");
  const [goalOutcome, setGoalOutcome] = useState("");
  const [pendingDream, setPendingDream] = useState<Dream | null>(null);
  const [pipelineDream, setPipelineDream] = useState<Dream | null>(null);
  const [generatedStages, setGeneratedStages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeDreamCount = useMemo(
    () => dreams.filter((dream) => dream.status === "active").length,
    [dreams]
  );

  const loadDreams = async () => {
    const response = await fetch("/api/dreams", { cache: "no-store" });
    const data = (await response.json()) as { dreams?: Dream[]; message?: string };

    if (!response.ok) {
      throw new Error(data.message ?? "Failed to load dreams.");
    }

    setDreams(data.dreams ?? []);
  };

  const generatePipeline = async (dream: Dream) => {
    setPipelineDream(dream);
    setStep("pipeline");
    setLoading(true);
    setError(null);
    setGeneratedStages([]);

    const response = await fetch("/api/pipelines/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dream_id: dream.id }),
    });

    const data = (await response.json()) as {
      stages?: string[];
      message?: string;
      pipeline_id?: string;
    };

    setLoading(false);

    if (!response.ok) {
      if (data.pipeline_id) {
        router.push(`/dashboard/pipeline/${data.pipeline_id}`);
        return;
      }

      setError(data.message ?? "Failed to generate pipeline.");
      return;
    }

    setGeneratedStages(data.stages ?? []);
  };

  const onCreateDream = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/dreams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: dreamTitle }),
    });

    const data = (await response.json()) as { dream?: Dream; message?: string };
    setLoading(false);

    if (!response.ok || !data.dream) {
      setError(data.message ?? "Failed to create dream.");
      return;
    }

    setPendingDream({ ...data.dream, goals: [], pipelines: [] });
    setDreamTitle("");
    setStep("goal");
  };

  const onCreateGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!pendingDream) {
      setError("No dream selected.");
      return;
    }

    setError(null);
    setLoading(true);

    const response = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dream_id: pendingDream.id, outcome: goalOutcome }),
    });

    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      setLoading(false);
      setError(data.message ?? "Failed to create goal.");
      return;
    }

    try {
      await loadDreams();
      setGoalOutcome("");
      setPendingDream(null);
      setStep("list");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dreams.");
    } finally {
      setLoading(false);
    }
  };

  const onConfirmPipeline = async () => {
    if (!pipelineDream) {
      setError("No dream selected.");
      return;
    }

    setError(null);
    setLoading(true);

    const response = await fetch("/api/pipelines/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dream_id: pipelineDream.id, stages: generatedStages }),
    });

    const data = (await response.json()) as {
      message?: string;
      pipeline?: { id: string };
      pipeline_id?: string;
    };

    setLoading(false);

    if (!response.ok) {
      if (data.pipeline_id) {
        router.push(`/dashboard/pipeline/${data.pipeline_id}`);
        return;
      }

      setError(data.message ?? "Failed to confirm pipeline.");
      return;
    }

    if (!data.pipeline?.id) {
      setError("Pipeline was not returned.");
      return;
    }

    router.push(`/dashboard/pipeline/${data.pipeline.id}`);
  };

  return (
    <section className="p-6">
      {step === "dream" && (
        <form className="max-w-2xl space-y-4" onSubmit={onCreateDream}>
          <input
            type="text"
            placeholder="What dream are you working on?"
            value={dreamTitle}
            onChange={(event) => setDreamTitle(event.target.value)}
            className="w-full rounded border border-gray-300 px-4 py-3 text-lg placeholder:text-gray-400"
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Saving..." : "Continue"}
          </button>
        </form>
      )}

      {step === "goal" && pendingDream && (
        <form className="max-w-2xl space-y-4" onSubmit={onCreateGoal}>
          <h2 className="text-xl font-semibold">{pendingDream.title}</h2>
          <input
            type="text"
            placeholder="What outcome would prove this dream is real?"
            value={goalOutcome}
            onChange={(event) => setGoalOutcome(event.target.value)}
            className="w-full rounded border border-gray-300 px-4 py-3 placeholder:text-gray-400"
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Saving..." : "Create Pipeline"}
          </button>
        </form>
      )}

      {step === "pipeline" && pipelineDream && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{pipelineDream.title}</h2>
          {loading ? <p>Generating your pipeline...</p> : null}
          {!loading && generatedStages.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {generatedStages.map((stage, index) => (
                <input
                  key={`${index}-${stage}`}
                  type="text"
                  value={stage}
                  onChange={(event) => {
                    setGeneratedStages((current) => {
                      const next = [...current];
                      next[index] = event.target.value;
                      return next;
                    });
                  }}
                  className="min-w-56 rounded border border-gray-300 px-3 py-2"
                />
              ))}
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={loading || generatedStages.length === 0}
              onClick={onConfirmPipeline}
              className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              Confirm Pipeline
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void generatePipeline(pipelineDream)}
              className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}

      {step === "list" && (
        <div className="space-y-6">
          {dreams.length === 0 ? <p>No dreams yet.</p> : null}

          <div className="space-y-4">
            {dreams.map((dream) => {
              const pipelineId = dream.pipelines[0]?.id;

              return (
                <div key={dream.id} className="rounded border border-gray-200 p-4">
                  <p className="font-medium">{dream.title}</p>
                  <p className="mt-2 text-sm text-gray-700">{dream.goals[0]?.outcome ?? "No goal yet."}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (pipelineId) {
                        router.push(`/dashboard/pipeline/${pipelineId}`);
                        return;
                      }

                      void generatePipeline(dream);
                    }}
                    className="mt-3 rounded border border-gray-300 px-3 py-1 text-sm"
                  >
                    Open
                  </button>
                </div>
              );
            })}
          </div>

          {activeDreamCount < 3 && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep("dream");
              }}
              className="rounded border border-gray-300 px-4 py-2"
            >
              + New Dream
            </button>
          )}
        </div>
      )}
    </section>
  );
}
