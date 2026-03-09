"use client";

import { KeyboardEvent, useMemo, useState } from "react";

type CardStatus = "backlog" | "doing" | "done";

type Bottleneck = {
  project_name: string;
  type: "stuck_in_doing";
  card_count: number;
};

const STATUSES: Array<{ key: CardStatus; label: string }> = [
  { key: "backlog", label: "Backlog" },
  { key: "doing", label: "Doing" },
  { key: "done", label: "Done" },
];

const STATUS_ACCENTS: Record<CardStatus, string> = {
  backlog: "var(--kanban-backlog)",
  doing: "var(--kanban-doing)",
  done: "var(--kanban-done)",
};

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
};

export function PipelineBoard({
  pipelineId,
  dreamTitle,
  goalOutcome,
  initialProjects,
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
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const totalCards = useMemo(
    () => projects.reduce((sum, project) => sum + project.cards.length, 0),
    [projects]
  );

  const doneCards = useMemo(
    () =>
      projects.reduce(
        (sum, project) => sum + project.cards.filter((card) => card.status === "done").length,
        0
      ),
    [projects]
  );

  const percentComplete = useMemo(() => {
    if (totalCards === 0) {
      return 0;
    }

    return Math.floor((doneCards / totalCards) * 100);
  }, [doneCards, totalCards]);

  const bottlenecks = useMemo(() => {
    const items: Bottleneck[] = [];

    for (const project of projects) {
      const doingCount = project.cards.filter((card) => card.status === "doing").length;
      const doneCount = project.cards.filter((card) => card.status === "done").length;

      if (doingCount >= 3 && doneCount === 0) {
        items.push({
          project_name: project.name,
          type: "stuck_in_doing",
          card_count: doingCount,
        });
      }

    }

    return items;
  }, [projects]);

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

  const onDeleteCard = async (cardId: string) => {
    if (!selectedProject) {
      return;
    }

    const snapshot = projects;

    setProjects((current) =>
      current.map((project) => ({
        ...project,
        cards: project.cards.filter((card) => card.id !== cardId),
      }))
    );

    setDeletingCardId(cardId);
    setError(null);

    const response = await fetch(`/api/cards/${cardId}`, {
      method: "DELETE",
    });

    setDeletingCardId(null);

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setProjects(snapshot);
      setError(data.message ?? "Failed to delete card.");
    }
  };

  return (
    <main className="min-h-screen max-w-[100vw] overflow-x-hidden px-4 py-4 md:p-10 [&_*]:box-border">
      <h1 className="serif-heading text-[clamp(16px,4vw,28px)] leading-tight text-[var(--text-primary)] break-words [overflow-wrap:anywhere] md:text-4xl">{dreamTitle}</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{goalOutcome}</p>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <section className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex w-full items-center gap-3 overflow-hidden">
          <div className="relative h-1 w-full flex-1 rounded bg-[var(--border)]">
            <div className="h-1 rounded bg-[var(--accent)]" style={{ width: `${percentComplete}%` }} />
          </div>
          <span className="w-10 text-right text-xs font-medium text-[var(--text-primary)]">{percentComplete}%</span>
        </div>

        {bottlenecks.length > 0 && (
          <div className="mt-4 space-y-2 text-sm text-orange-300">
            {bottlenecks.map((bottleneck) => (
              <p key={`${bottleneck.project_name}-${bottleneck.type}`}>
                {`⚠️ "${bottleneck.project_name}" has ${bottleneck.card_count} tasks stuck in Doing with nothing completed.`}
              </p>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 md:hidden">
        <div className="overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none]">
          <div className="flex w-max gap-2 whitespace-nowrap pr-2">
            {projects.map((project) => (
              <button
                key={`mobile-${project.id}`}
                type="button"
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setAddCardStatus(null);
                  setNewCardTitle("");
                }}
                className={`rounded-full border px-4 py-2 text-sm ${
                  selectedProjectId === project.id
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                    : "border-[var(--border-strong)] bg-transparent text-[var(--text-muted)]"
                }`}
              >
                {project.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex w-full gap-4 md:mt-6">
        <aside className="hidden w-56 rounded border border-[var(--border)] bg-[var(--card)] p-3 md:block">
          <h2 className="text-[11px] uppercase tracking-[1.5px] text-[var(--text-muted)]">Projects</h2>
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
                className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                  selectedProjectId === project.id
                    ? "border border-[var(--border-strong)] bg-[var(--border)] text-[var(--text-primary)]"
                    : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)] hover:border-[var(--border-hover)]"
                }`}
              >
                {project.name}
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 w-full flex-1">
          <div className="flex flex-col gap-6 pb-4 md:min-w-[780px] md:flex-row md:gap-4">
            {STATUSES.map(({ key, label }) => {
              const cards = cardsByStatus(key);

              return (
                <div
                  key={key}
                  className="w-full max-w-full rounded border border-[var(--border)] bg-[var(--card)] p-3 md:min-h-[360px] md:min-w-[250px]"
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
                  <div
                    className={`mb-3 flex items-center justify-between border-b pb-2 ${
                      key === "doing" ? "border-[var(--border-strong)]" : "border-[var(--border)]"
                    }`}
                  >
                    <h3 className="text-[11px] uppercase tracking-[1.5px]" style={{ color: STATUS_ACCENTS[key] }}>{label}</h3>
                    <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                      {cards.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {cards.map((card) => (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", card.id);
                          handleDragStart(card);
                        }}
                        className={`group relative rounded border px-3 py-2 text-[12px] leading-5 cursor-grab ${
                          key === "done"
                            ? "border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)] opacity-60"
                            : "border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void onDeleteCard(card.id);
                          }}
                          disabled={deletingCardId === card.id}
                          className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded text-xs text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text-secondary)] group-hover:flex disabled:opacity-50"
                          aria-label="Delete card"
                        >
                          ×
                        </button>
                        <span className="pr-6 break-words [overflow-wrap:anywhere]">{card.title}</span>
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
                          className="w-full rounded border border-dashed border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
                          placeholder="Card title"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void onAddCard(key)}
                            disabled={savingCard}
                            className="rounded-md bg-[var(--accent)] px-3 py-1 text-sm text-[var(--accent-contrast)] disabled:opacity-50"
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
                            className="rounded-md border border-[var(--border-strong)] px-3 py-1 text-sm text-[var(--text-muted)]"
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
                        className="w-full rounded border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)]"
                      >
                        + Add card
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {movingCardId && <p className="mt-2 text-sm text-[var(--text-muted)]">Moving card...</p>}
    </main>
  );
}






