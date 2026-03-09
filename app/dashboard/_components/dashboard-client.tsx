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
  context?: string | null;
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
  const [dreamContext, setDreamContext] = useState("");
  const [goalOutcome, setGoalOutcome] = useState("");
  const [pendingDream, setPendingDream] = useState<Dream | null>(null);
  const [pipelineDream, setPipelineDream] = useState<Dream | null>(null);
  const [generatedStages, setGeneratedStages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [buildingTasks, setBuildingTasks] = useState(false);

  const activeDreamCount = useMemo(
    () => dreams.filter((dream) => dream.status === "active").length,
    [dreams]
  );

  const remainingSlots = Math.max(3 - activeDreamCount, 0);

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
      body: JSON.stringify({ title: dreamTitle, context: dreamContext || "" }),
    });

    const data = (await response.json()) as { dream?: Dream; message?: string };
    setLoading(false);

    if (!response.ok || !data.dream) {
      setError(data.message ?? "Failed to create dream.");
      return;
    }

    setPendingDream({ ...data.dream, goals: [], pipelines: [] });
    setDreamTitle("");
    setDreamContext("");
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

  const onArchiveDream = async (dreamId: string) => {
    setError(null);

    const response = await fetch(`/api/dreams/${dreamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });

    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      setError(data.message ?? "Failed to archive dream.");
      return;
    }

    setDreams((current) => current.filter((dream) => dream.id !== dreamId));
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

    setBuildingTasks(true);

    const generateTasksResponse = await fetch(
      `/api/pipelines/${data.pipeline.id}/generate-cards`,
      {
        method: "POST",
      }
    );

    const generateTasksBody = (await generateTasksResponse.json()) as {
      message?: string;
      success?: boolean;
    };

    setBuildingTasks(false);

    if (!generateTasksResponse.ok) {
      setError(generateTasksBody.message ?? "Failed to build tasks.");
      return;
    }

    router.push(`/dashboard/pipeline/${data.pipeline.id}`);
  };

  return (
    <section className="mx-auto w-full max-w-5xl p-12">
      {step === "dream" && (
        <form className="max-w-3xl space-y-4" onSubmit={onCreateDream}>
          <p className="text-[11px] uppercase tracking-[1.5px] text-[var(--text-muted)]">New Dream</p>
          <input
            type="text"
            placeholder="What dream are you working on?"
            value={dreamTitle}
            onChange={(event) => setDreamTitle(event.target.value)}
            className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--card)] px-4 py-3 text-lg text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
            required
          />

          <div className="space-y-2">
            <label className="block text-sm text-[var(--text-secondary)]" htmlFor="dream-context">
              Any context that would help? (optional)
            </label>
            <textarea
              id="dream-context"
              value={dreamContext}
              onChange={(event) => setDreamContext(event.target.value)}
              placeholder="e.g. I have a design background, no coding skills, $5k budget, 6 months to execute"
              className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--card)] px-3 py-2 text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
              rows={3}
            />
            <p className="text-xs text-[var(--text-muted)]">This helps the AI generate a more relevant pipeline</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-[var(--accent-contrast)] disabled:opacity-50"
          >
            {loading ? "Saving..." : "Continue"}
          </button>
        </form>
      )}

      {step === "goal" && pendingDream && (
        <form className="max-w-3xl space-y-4" onSubmit={onCreateGoal}>
          <h2 className="serif-heading text-3xl text-[var(--text-primary)]">{pendingDream.title}</h2>
          <input
            type="text"
            placeholder="What outcome would prove this dream is real?"
            value={goalOutcome}
            onChange={(event) => setGoalOutcome(event.target.value)}
            className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--card)] px-4 py-3 text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
            required
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-[var(--accent-contrast)] disabled:opacity-50"
          >
            {loading ? "Saving..." : "Create Pipeline"}
          </button>
        </form>
      )}

      {step === "pipeline" && pipelineDream && (
        <div className="space-y-5">
          <h2 className="serif-heading text-3xl text-[var(--text-primary)]">{pipelineDream.title}</h2>
          {loading ? <p className="text-[var(--text-muted)]">Generating your pipeline...</p> : null}
          {buildingTasks ? <p className="text-[var(--text-muted)]">Building your tasks...</p> : null}
          {!loading && generatedStages.length > 0 && !buildingTasks && (
            <div className="flex flex-wrap gap-3">
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
                  className="min-w-56 rounded-md border border-[var(--border-strong)] bg-[var(--card)] px-3 py-2 text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
                />
              ))}
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {!buildingTasks && (
            <div className="flex gap-3">
              <button
                type="button"
                disabled={loading || generatedStages.length === 0}
                onClick={onConfirmPipeline}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-[var(--accent-contrast)] disabled:opacity-50"
              >
                Confirm Pipeline
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void generatePipeline(pipelineDream)}
                className="rounded-md border border-[var(--border-strong)] bg-transparent px-4 py-2 text-[var(--text-muted)] disabled:opacity-50"
              >
                Regenerate
              </button>
            </div>
          )}
        </div>
      )}

      {step === "list" && (
        <div className="space-y-8">
          <header>
            <p className="mb-3 text-[11px] uppercase tracking-[1.5px] text-[var(--text-muted)]">Your Dreams</p>
            <h1 className="serif-heading text-5xl leading-none text-[var(--text-primary)]">What are you building?</h1>
          </header>

          {dreams.length === 0 ? <p className="text-[var(--text-muted)]">No dreams yet.</p> : null}

          <div className="space-y-4">
            {dreams.map((dream) => {
              const pipelineId = dream.pipelines[0]?.id;
              const progress = pipelineId ? 22 : 0;

              return (
                <div
                  key={dream.id}
                  className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-7 transition-colors hover:border-[var(--border-hover)]"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="serif-heading text-[24px] leading-tight text-[var(--text-primary)]">{dream.title}</p>
                      <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                        Goal: {dream.goals[0]?.outcome ?? "No goal yet."}
                      </p>
                    </div>
                    <p className="serif-heading text-2xl text-[var(--text-primary)]">{progress}%</p>
                  </div>

                  <div className="mb-4 h-1 overflow-hidden rounded bg-[var(--border)]">
                    <div className="h-1 rounded bg-[var(--accent)]" style={{ width: `${progress}%` }} />
                  </div>


                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        console.log("[Open]", {
                          dreamId: dream.id,
                          pipelineId,
                          hasPipeline: !!pipelineId,
                        });

                        if (pipelineId) {
                          router.push(`/dashboard/pipeline/${pipelineId}`);
                          return;
                        }

                        void generatePipeline(dream);
                      }}
                      className="rounded-md border border-[var(--border-strong)] bg-transparent px-3 py-1 text-sm text-[var(--text-secondary)]"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => void onArchiveDream(dream.id)}
                      className="rounded-md border border-[var(--border-strong)] bg-transparent px-3 py-1 text-sm text-[var(--text-muted)]"
                    >
                      Archive
                    </button>
                  </div>
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
              className="w-full rounded-[10px] border border-dashed border-[var(--border)] px-6 py-5 text-center text-[13px] text-[var(--text-muted)]"
            >
              + New Dream - {remainingSlots} slot{remainingSlots === 1 ? "" : "s"} remaining
            </button>
          )}
        </div>
      )}
    </section>
  );
}




