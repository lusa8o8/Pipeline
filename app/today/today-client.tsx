"use client";

import { useMemo, useState } from "react";

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

  const totalToday = initialItems.length;
  const completedToday = totalToday - items.length;

  const overallPercent = useMemo(() => {
    if (totalToday === 0) {
      return 0;
    }

    return Math.floor((completedToday / totalToday) * 100);
  }, [completedToday, totalToday]);

  const usedSlots = Math.min(items.length, 5);
  const remainingSlots = Math.max(5 - usedSlots, 0);

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
    <section className="mx-auto w-full max-w-4xl p-12">
      <header className="mb-10">
        <p className="mb-3 text-[11px] uppercase tracking-[1.5px] text-[var(--text-muted)]">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1 className="serif-heading text-5xl leading-none text-[var(--text-primary)]">Today&apos;s Focus</h1>
        <p className="mt-3 text-[13px] text-[var(--text-muted)]">
          {usedSlots} of 5 slots used - move a card to Doing to add tasks
        </p>
      </header>

      <section className="mb-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-6 py-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-[1px] text-[var(--text-muted)]">Today</p>
            <p className="serif-heading text-[22px] text-[var(--text-primary)]">
              {completedToday} / {totalToday}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">tasks completed</p>
          </div>
          <div className="text-right">
            <p className="mb-1 text-[10px] uppercase tracking-[1px] text-[var(--text-muted)]">Overall</p>
            <p className="serif-heading text-[22px] text-[var(--text-primary)]">{overallPercent}%</p>
            <p className="text-[11px] text-[var(--text-muted)]">goal progress</p>
          </div>
        </div>
        <div className="h-1 overflow-hidden rounded bg-[var(--border)]">
          <div className="h-1 rounded bg-[var(--accent)]" style={{ width: `${overallPercent}%` }} />
        </div>
      </section>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] px-6 py-5 text-[13px] text-[var(--text-muted)]">
          Nothing in focus. Go to a pipeline and move a card to Doing.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={item.card_id}
              className="flex items-start gap-4 rounded-lg border border-[var(--border)] bg-[var(--card)] px-6 py-5"
            >
              <div className="min-w-6 pt-0.5 text-[12px] text-[var(--text-muted)]">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="flex-1">
                <p className="text-[14px] text-[var(--text-secondary)]">{item.card_title}</p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  {item.project_name} - {item.dream_title || activeDreamTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void markDone(item.card_id)}
                disabled={loadingCardId === item.card_id}
                className="min-w-[90px] self-start rounded-md border border-[var(--border-strong)] bg-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] disabled:opacity-40"
              >
                Mark Done
              </button>
            </div>
          ))}
          <div className="rounded-lg border border-dashed border-[var(--border)] px-6 py-4 text-center text-[11px] text-[var(--text-muted)]">
            + {remainingSlots} more slots available - go to a project and move cards to Doing
          </div>
        </div>
      )}
    </section>
  );
}


