"use client";

import { useState } from "react";

type TodayItem = {
  card_id: string;
  card_title: string;
  status: string;
  focused_at: string | null;
  project_name: string;
  pipeline_id: string;
  dream_title: string;
  dream_id: string;
};

type TodayClientProps = {
  initialItems: TodayItem[];
  activeDreamTitle: string;
};

export function TodayClient({ initialItems, activeDreamTitle }: TodayClientProps) {
  const [items, setItems] = useState<TodayItem[]>(initialItems);
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);

  const markDone = async (cardId: string) => {
    setLoadingCardId(cardId);

    const response = await fetch(`/api/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });

    setLoadingCardId(null);

    if (!response.ok) {
      return;
    }

    setItems((current) => current.filter((item) => item.card_id !== cardId));
  };

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">Today&apos;s Focus</h1>
      <p className="mt-1 text-sm text-gray-600">{activeDreamTitle || "No active dream"}</p>

      {items.length === 0 ? (
        <p className="mt-6">Nothing in focus. Go to a pipeline and move a card to Doing.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <div key={item.card_id} className="flex items-center justify-between rounded border border-gray-300 p-3">
              <div>
                <p className="font-semibold">{item.card_title}</p>
                <p className="text-sm text-gray-600">
                  {item.project_name} • {item.dream_title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void markDone(item.card_id)}
                disabled={loadingCardId === item.card_id}
                className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                Mark Done
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
