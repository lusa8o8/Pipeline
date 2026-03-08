"use client";

import { KeyboardEvent, useMemo, useState } from "react";

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

type PipelineBoardProps = {
  pipelineId: string;
  dreamTitle: string;
  goalOutcome: string;
  initialStages: Stage[];
};

export function PipelineBoard({
  pipelineId,
  dreamTitle,
  goalOutcome,
  initialStages,
}: PipelineBoardProps) {
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [addCardStageId, setAddCardStageId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savingCard, setSavingCard] = useState(false);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

  const stageMap = useMemo(() => {
    const map = new Map<string, Stage>();
    for (const stage of stages) {
      map.set(stage.id, stage);
    }
    return map;
  }, [stages]);

  const onAddCard = async (stageId: string) => {
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
      body: JSON.stringify({ stage_id: stageId, pipeline_id: pipelineId, title }),
    });

    const data = (await response.json()) as { card?: Card; message?: string };
    setSavingCard(false);

    if (!response.ok || !data.card) {
      setError(data.message ?? "Failed to create card.");
      return;
    }

    const createdCard = data.card;

    setStages((current) =>
      current.map((stage) =>
        stage.id === stageId
          ? { ...stage, cards: [...stage.cards, createdCard].sort((a, b) => a.position - b.position) }
          : stage
      )
    );
    setNewCardTitle("");
    setAddCardStageId(null);
  };

  const onCardKeyDown = (event: KeyboardEvent<HTMLInputElement>, stageId: string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void onAddCard(stageId);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setAddCardStageId(null);
      setNewCardTitle("");
      setError(null);
    }
  };

  const handleDragStart = (card: Card) => {
    setDraggedCardId(card.id);
  };

  const onDropCard = async (targetStageId: string, cardId: string) => {
    const targetStage = stageMap.get(targetStageId);
    if (!targetStage) {
      return;
    }

    const snapshot = stages;

    let movingCard: Card | null = null;
    for (const stage of snapshot) {
      const found = stage.cards.find((card) => card.id === cardId);
      if (found) {
        movingCard = found;
        break;
      }
    }

    if (!movingCard) {
      return;
    }

    const optimisticCard: Card = {
      ...movingCard,
      stage_id: targetStageId,
      position: targetStage.cards.length,
    };

    setStages((current) =>
      current.map((stage) => {
        const withoutCard = stage.cards.filter((card) => card.id !== cardId);

        if (stage.id !== targetStageId) {
          return { ...stage, cards: withoutCard };
        }

        return { ...stage, cards: [...withoutCard, optimisticCard] };
      })
    );

    setMovingCardId(cardId);
    setError(null);

    const response = await fetch(`/api/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage_id: targetStageId, position: targetStage.cards.length }),
    });

    const data = (await response.json()) as { card?: Card; message?: string };
    setMovingCardId(null);
    setDraggedCardId(null);

    if (!response.ok || !data.card) {
      setStages(snapshot);
      setError(data.message ?? "Failed to move card.");
      return;
    }

    const updatedCard = data.card;

    setStages((current) =>
      current.map((stage) => {
        const cards = stage.cards
          .map((card) => (card.id === updatedCard.id ? updatedCard : card))
          .sort((a, b) => a.position - b.position);

        return { ...stage, cards };
      })
    );
  };

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">{dreamTitle}</h1>
      <p className="mt-2 text-gray-700">{goalOutcome}</p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="min-h-[300px] min-w-[250px] rounded border border-gray-300 p-3"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const cardId = event.dataTransfer.getData("text/plain") || draggedCardId;
              if (!cardId) {
                return;
              }

              void onDropCard(stage.id, cardId);
            }}
          >
            <h2 className="text-lg font-medium">{stage.name}</h2>

            <div className="mt-3 space-y-2">
              {stage.cards
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => handleDragStart(card)}
                    className="bg-white text-black rounded px-3 py-2 text-sm cursor-grab shadow-sm"
                  >
                    {card.title}
                  </div>
                ))}
            </div>

            <div className="mt-4">
              {addCardStageId === stage.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newCardTitle}
                    onChange={(event) => setNewCardTitle(event.target.value)}
                    onKeyDown={(event) => onCardKeyDown(event, stage.id)}
                    className="w-full rounded border-2 border-dashed border-gray-400 bg-gray-50 px-2 py-1 text-sm placeholder:text-gray-400 text-black"
                    placeholder="Card title"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void onAddCard(stage.id)}
                      disabled={savingCard}
                      className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddCardStageId(null);
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
                    setAddCardStageId(stage.id);
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

      {movingCardId && <p className="text-sm text-gray-600">Moving card...</p>}
    </main>
  );
}
