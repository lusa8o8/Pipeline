"use client";

import { useState } from "react";

type ArchivedDream = {
  id: string;
  title: string;
  context: string | null;
  created_at: string;
};

type ArchiveClientProps = {
  initialDreams: ArchivedDream[];
  initialActiveDreamCount: number;
};

export function ArchiveClient({ initialDreams, initialActiveDreamCount }: ArchiveClientProps) {
  const [dreams, setDreams] = useState<ArchivedDream[]>(initialDreams);
  const [activeDreamCount, setActiveDreamCount] = useState(initialActiveDreamCount);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRestore = activeDreamCount < 3;

  const restoreDream = async (dreamId: string) => {
    if (!canRestore) {
      return;
    }

    setError(null);
    setRestoringId(dreamId);

    const response = await fetch(`/api/dreams/${dreamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });

    const data = (await response.json()) as { message?: string };

    setRestoringId(null);

    if (!response.ok) {
      setError(data.message ?? "Failed to restore dream.");
      return;
    }

    setDreams((current) => current.filter((dream) => dream.id !== dreamId));
    setActiveDreamCount((current) => current + 1);
  };

  return (
    <section className="mx-auto w-full max-w-5xl p-12">
      <header className="mb-8">
        <h1 className="serif-heading text-[28px] text-white">Archive</h1>
        <p className="mt-2 text-[13px] text-[#555]">Dreams you&apos;ve set aside.</p>
      </header>

      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

      {dreams.length === 0 ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-[10px] border border-[#1E1E1E] bg-[#111]">
          <p className="text-[13px] text-[#555]">Nothing archived yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dreams.map((dream) => (
            <div
              key={dream.id}
              className="rounded-[10px] border border-[#1E1E1E] bg-[#111] p-7 transition-colors hover:border-[#333]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="serif-heading text-[24px] leading-tight text-white">{dream.title}</p>
                  <p className="mt-2 text-[12px] text-[#555]">
                    Archived · {new Date(dream.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>

                {canRestore ? (
                  <button
                    type="button"
                    onClick={() => void restoreDream(dream.id)}
                    disabled={restoringId === dream.id}
                    className="rounded-md border border-[#2A2A2A] bg-transparent px-3 py-1 text-sm text-[#DDD] disabled:opacity-40"
                  >
                    {restoringId === dream.id ? "Restoring..." : "Restore"}
                  </button>
                ) : (
                  <p className="text-[12px] text-[#555]">3 active dreams - archive one first</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
