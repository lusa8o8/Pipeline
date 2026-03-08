"use client";

import { FormEvent, useMemo, useState } from "react";

type Goal = {
  id: string;
  dream_id: string;
  user_id: string;
  outcome: string;
  created_at: string;
};

type Dream = {
  id: string;
  user_id: string;
  title: string;
  status: "active" | "archived";
  created_at: string;
  goals: Goal[];
};

type DashboardClientProps = {
  initialDreams: Dream[];
};

export function DashboardClient({ initialDreams }: DashboardClientProps) {
  const [dreams, setDreams] = useState<Dream[]>(initialDreams);
  const [step, setStep] = useState<"list" | "dream" | "goal">(
    initialDreams.length === 0 ? "dream" : "list"
  );
  const [dreamTitle, setDreamTitle] = useState("");
  const [goalOutcome, setGoalOutcome] = useState("");
  const [pendingDream, setPendingDream] = useState<Dream | null>(null);
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

    setPendingDream({ ...data.dream, goals: [] });
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

  return (
    <section className="p-6">
      {step === "dream" && (
        <form className="max-w-2xl space-y-4" onSubmit={onCreateDream}>
          <input
            type="text"
            placeholder="What dream are you working on?"
            value={dreamTitle}
            onChange={(event) => setDreamTitle(event.target.value)}
            className="w-full rounded border border-gray-300 px-4 py-3 text-lg"
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
            className="w-full rounded border border-gray-300 px-4 py-3"
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

      {step === "list" && (
        <div className="space-y-6">
          {dreams.length === 0 ? <p>No dreams yet.</p> : null}

          <div className="space-y-4">
            {dreams.map((dream) => (
              <div key={dream.id} className="rounded border border-gray-200 p-4">
                <p className="font-medium">{dream.title}</p>
                <p className="mt-2 text-sm text-gray-700">{dream.goals[0]?.outcome ?? "No goal yet."}</p>
                <button
                  type="button"
                  className="mt-3 rounded border border-gray-300 px-3 py-1 text-sm"
                >
                  Open
                </button>
              </div>
            ))}
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
