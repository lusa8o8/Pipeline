"use client";

import { KeyboardEvent, useMemo, useState } from "react";

type CardStatus = "backlog" | "ready" | "doing" | "done";

const STATUSES: Array<{ key: CardStatus; label: string }> = [
  { key: "backlog", label: "Backlog" },
  { key: "ready", label: "Ready" },
  { key: "doing", label: "Doing" },
  { key: "done", label: "Done" },
];

type Card = {
  id: string;
  stage_id: string;
  pipeline_id: string;
  user_id: string;
  title: string;
  status: CardStatus;
  position: number;
  created_at: string;
};

type Project = {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  created_at: string;
  cards: Card[];
};

type PipelineBoardProps = {
  pipelineId: string;
  dreamTitle: string;
  goalOutcome: string;
  initialProjects: Project[];
  initialGoalTarget: number;
  initialFinalProjectId: string | null;
};

export function PipelineBoard({
  pipelineId,
  dreamTitle,
  goalOutcome,
  initialProjects,
  initialGoalTarget,
  initialFinalProjectId,
}: PipelineBoardProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialProjects[0]?.id ?? null
  );
  const [addCardStatus, setAddCardStatus] = useState<CardStatus | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savingCard, setSavingCard] = useState(false);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [goalTarget, setGoalTarget] = useState<number>(initialGoalTarget);
  const [goalTargetInput, setGoalTargetInput] = useState<string>(
    String(initialGoalTarget || 10)
  );
  const [settingGoalTarget, setSettingGoalTarget] = useState(false);
  const [hasSetGoalTarget, setHasSetGoalTarget] = useState(initialGoalTarget !== 10);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const finalProjectId = useMemo(() => {
    if (initialFinalProjectId && projects.some((project) => project.id === initialFinalProjectId)) {
      return initialFinalProjectId;
    }

    const sorted = [...projects].sort((a, b) => b.position - a.position);
    return sorted[0]?.id ?? null;
  }, [initialFinalProjectId, projects]);

  const doneCardCount = useMemo(() => {
    if (!finalProjectId) {
      return 0;
    }

    const finalProject = projects.find((project) => project.id === finalProjectId);
    if (!finalProject) {
      return 0;
    }

    return finalProject.cards.filter((card) => card.status === "done").length;
  }, [projects, finalProjectId]);

  const percentComplete = useMemo(() => {
    if (goalTarget <= 0) {
      return 0;
    }

    return Math.min(100, Math.floor((doneCardCount / goalTarget) * 100));
  }, [doneCardCount, goalTarget]);

  const onSetGoalTarget = async () => {
    const parsed = Number(goalTargetInput);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError("Goal target must be a positive number.");
      return;
    }

    setSettingGoalTarget(true);
    setError(null);

    const response = await fetch(`/api/pipelines/${pipelineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal_target: parsed }),
    });

    const data = (await response.json()) as {
      pipeline?: { goal_target: number };
      message?: string;
    };

    setSettingGoalTarget(false);

    if (!response.ok || !data.pipeline) {
      setError(data.message ?? "Failed to set goal target.");
      return;
    }

    setGoalTarget(data.pipeline.goal_target);
    setGoalTargetInput(String(data.pipeline.goal_target));
    setHasSetGoalTarget(true);
  };

  const onAddCard = async (status: CardStatus) => {
    if (!selectedProject) {
      return;
    }

    const title = newCardTitle.trim();
    if (!title) {
      setError("Card title is required.");
      return;
    }

    setSavingCard(true);
    setError(null);

    const response = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: selectedProject.id,
        pipeline_id: pipelineId,
        title,
        status,
      }),
    });

    const data = (await response.json()) as { card?: Card; message?: string };
    setSavingCard(false);

    if (!response.ok || !data.card) {
      setError(data.message ?? "Failed to create card.");
      return;
    }

    const createdCard = data.card;

    setProjects((current) =>
      current.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              cards: [...project.cards, createdCard].sort((a, b) => a.position - b.position),
            }
          : project
      )
    );

    setAddCardStatus(null);
    setNewCardTitle("");
  };

  const onCardKeyDown = (event: KeyboardEvent<HTMLInputElement>, status: CardStatus) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void onAddCard(status);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setAddCardStatus(null);
      setNewCardTitle("");
      setError(null);
    }
  };

  const handleDragStart = (card: Card) => {
    setDraggedCardId(card.id);
  };

  const onDropCard = async (targetStatus: CardStatus, cardId: string) => {
    if (!selectedProject) {
      return;
    }

    const project = selectedProject;
    const movingCard = project.cards.find((card) => card.id === cardId);
    if (!movingCard) {
      return;
    }

    const snapshot = projects;
    const newPosition = project.cards.filter((card) => card.status === targetStatus).length;

    const optimisticCard: Card = {
      ...movingCard,
      status: targetStatus,
      position: newPosition,
    };

    setProjects((current) =>
      current.map((item) => {
        if (item.id !== project.id) {
          return item;
        }

        const withoutCard = item.cards.filter((card) => card.id !== cardId);
        return { ...item, cards: [...withoutCard, optimisticCard] };
      })
    );

    setMovingCardId(cardId);
    setError(null);

    const response = await fetch(`/api/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: targetStatus }),
    });

    const data = (await response.json()) as { card?: Card; message?: string };
    setMovingCardId(null);
    setDraggedCardId(null);

    if (!response.ok || !data.card) {
      setProjects(snapshot);
      setError(data.message ?? "Failed to move card.");
      return;
    }

    const updatedCard = data.card;

    setProjects((current) =>
      current.map((item) => {
        if (item.id !== project.id) {
          return item;
        }

        return {
          ...item,
          cards: item.cards
            .map((card) => (card.id === updatedCard.id ? updatedCard : card))
            .sort((a, b) => a.position - b.position),
        };
      })
    );
  };

  const cardsByStatus = (status: CardStatus) => {
    if (!selectedProject) {
      return [];
    }

    return selectedProject.cards
      .filter((card) => card.status === status)
      .sort((a, b) => a.position - b.position);
  };

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">{dreamTitle}</h1>
      <p className="mt-2 text-gray-700">{goalOutcome}</p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <section className="mt-6 rounded border border-gray-300 p-4">
        {!hasSetGoalTarget && goalTarget === 10 ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">How many outcomes = goal complete?</p>
            <input
              type="number"
              min={1}
              value={goalTargetInput}
              onChange={(event) => setGoalTargetInput(event.target.value)}
              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm placeholder:text-gray-400 text-black"
            />
            <button
              type="button"
              onClick={() => void onSetGoalTarget()}
              disabled={settingGoalTarget}
              className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              Set
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium">
              {doneCardCount} / {goalTarget} - {percentComplete}% complete
            </p>
            <div className="mt-2 h-2 w-full rounded bg-gray-200">
              <div className="h-2 rounded bg-black" style={{ width: `${percentComplete}%` }} />
            </div>
          </div>
        )}
      </section>

      <div className="mt-6 flex gap-4">
        <aside className="w-56 rounded border border-gray-300 p-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Projects</h2>
          <div className="mt-3 space-y-2">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setAddCardStatus(null);
                  setNewCardTitle("");
                }}
                className={`w-full rounded px-3 py-2 text-left text-sm ${
                  selectedProjectId === project.id
                    ? "bg-black text-white"
                    : "border border-gray-300 bg-white text-black"
                }`}
              >
                {project.name}
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex min-w-[1040px] gap-4 pb-4">
            {STATUSES.map(({ key, label }) => (
              <div
                key={key}
                className="min-h-[360px] min-w-[250px] rounded border border-gray-300 p-3"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const cardId = event.dataTransfer.getData("text/plain") || draggedCardId;
                  if (!cardId) {
                    return;
                  }

                  void onDropCard(key, cardId);
                }}
              >
                <h3 className="text-sm font-semibold">{label}</h3>

                <div className="mt-3 space-y-2">
                  {cardsByStatus(key).map((card) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", card.id);
                        handleDragStart(card);
                      }}
                      className="bg-white text-black rounded px-3 py-2 text-sm cursor-grab shadow-sm"
                    >
                      {card.title}
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  {addCardStatus === key ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newCardTitle}
                        onChange={(event) => setNewCardTitle(event.target.value)}
                        onKeyDown={(event) => onCardKeyDown(event, key)}
                        className="w-full rounded border border-gray-300 bg-gray-50 px-2 py-1 text-sm placeholder:text-gray-400 text-black"
                        placeholder="Card title"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void onAddCard(key)}
                          disabled={savingCard}
                          className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddCardStatus(null);
                            setNewCardTitle("");
                            setError(null);
                          }}
                          className="rounded border border-gray-300 px-3 py-1 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddCardStatus(key);
                        setNewCardTitle("");
                        setError(null);
                      }}
                      className="rounded border border-gray-300 px-3 py-1 text-sm"
                    >
                      + Add card
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {movingCardId && <p className="text-sm text-gray-600">Moving card...</p>}
    </main>
  );
}
