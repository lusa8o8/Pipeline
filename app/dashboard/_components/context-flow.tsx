"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ContextMessage = {
  role: "user" | "assistant";
  content: string;
};

type ContextFlowProps = {
  dreamId: string;
  dreamTitle: string;
  onSummaryReady: (summary: string) => void;
};

const MAX_QUESTIONS = 5;

export function ContextFlow({ dreamId, dreamTitle, onSummaryReady }: ContextFlowProps) {
  const [, setMessages] = useState<ContextMessage[]>([]);
  const messagesRef = useRef<ContextMessage[]>([]);
  const [questionText, setQuestionText] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [clarifyValue, setClarifyValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [completingSummary, setCompletingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceSummaryOnNext, setForceSummaryOnNext] = useState(false);
  const [clarifyMode, setClarifyMode] = useState(false);

  const setConversation = (next: ContextMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  };

  const requestContext = useCallback(
    async (options?: { messagesOverride?: ContextMessage[]; forceSummary?: boolean }) => {
      if (!dreamId) {
        return;
      }

    const payloadMessages: ContextMessage[] = options?.messagesOverride ?? messagesRef.current;

      setLoading(true);
      setError(null);

      const response = await fetch("/api/context-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dream_id: dreamId,
          dream_text: dreamTitle,
          messages: payloadMessages,
          force_summary: options?.forceSummary,
        }),
      });

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        setError(data?.message ?? "Failed to gather context.");
        return;
      }

      if (data.type === "question") {
        const nextMessages: ContextMessage[] = [...payloadMessages, { role: "assistant", content: data.question }];
        setConversation(nextMessages);
        setQuestionText(data.question);
        setSummary(null);
        setClarifyMode(false);
        setForceSummaryOnNext(false);
        setQuestionCount((current) => Math.min(MAX_QUESTIONS, current + 1));
        return;
      }

      if (data.type === "summary") {
        const nextMessages: ContextMessage[] = [...payloadMessages, { role: "assistant", content: data.summary }];
        setConversation(nextMessages);
        setSummary(data.summary);
        setQuestionText(null);
        setClarifyMode(false);
        setForceSummaryOnNext(false);
        return;
      }

      setError("Unexpected response from context assistant.");
    },
    [dreamId, dreamTitle]
  );

  useEffect(() => {
    setConversation([]);
    setQuestionText(null);
    setSummary(null);
    setQuestionCount(0);
    setInputValue("");
    setClarifyValue("");
    setError(null);
    setForceSummaryOnNext(false);
    setClarifyMode(false);
    void requestContext({ messagesOverride: [], forceSummary: false });
  }, [dreamId, requestContext]);

  const handleAnswer = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }

    const nextMessages: ContextMessage[] = [...messagesRef.current, { role: "user", content: trimmed }];
    setConversation(nextMessages);
    setInputValue("");
    await requestContext({ messagesOverride: nextMessages, forceSummary: forceSummaryOnNext });
    if (forceSummaryOnNext) {
      setForceSummaryOnNext(false);
    }
  };

  const handleClarify = () => {
    setClarifyMode(true);
    setClarifyValue("");
    setForceSummaryOnNext(true);
  };

  const handleClarifySubmit = async () => {
    const trimmed = clarifyValue.trim();
    if (!trimmed) {
      return;
    }

    const nextMessages: ContextMessage[] = [...messagesRef.current, { role: "user", content: trimmed }];
    setConversation(nextMessages);
    setClarifyValue("");
    await requestContext({ messagesOverride: nextMessages, forceSummary: true });
  };

  const confirmSummary = async () => {
    if (!summary) {
      return;
    }

    setCompletingSummary(true);
    setError(null);

    const response = await fetch("/api/context-conversation/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dream_id: dreamId,
        context_summary: summary,
        messages: messagesRef.current,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data?.message ?? "Failed to save context summary.");
      setCompletingSummary(false);
      return;
    }

    setCompletingSummary(false);
    onSummaryReady(summary);
  };

  const progressLabel = useMemo(() => {
    const index = questionCount || 1;
    return `Building context · Question ${Math.min(index, MAX_QUESTIONS)} of ${MAX_QUESTIONS}`;
  }, [questionCount]);

  const questionDisplay =
    questionText ?? (loading ? "..." : "Waiting for the next question about your current reality.");

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6 rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-8 text-white">
      <div>
        <p className="text-[11px] uppercase tracking-[1.5px] text-[var(--text-muted)]">Dream</p>
        <p
          className="serif-heading text-3xl font-normal leading-tight text-[var(--text-primary)] truncate"
          title={dreamTitle}
        >
          {dreamTitle}
        </p>
      </div>

      <div className="border-t border-[var(--border)] pt-6">
        {error && <p className="text-sm text-red-400">{error}</p>}

        {summary ? (
          <div className="space-y-6">
            <p className="text-[14px] text-[var(--text-secondary)]">Here’s where you are right now:</p>
            <p className="serif-heading text-[18px] leading-snug text-[var(--text-primary)]">{summary}</p>
            {!clarifyMode ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={confirmSummary}
                  disabled={completingSummary}
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-[var(--accent-contrast)] disabled:opacity-50"
                >
                  {completingSummary ? "Saving..." : "Yes, this is me →"}
                </button>
                <button
                  type="button"
                  onClick={handleClarify}
                  className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-[var(--text-muted)]"
                >
                  Let me add something
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  value={clarifyValue}
                  onChange={(event) => setClarifyValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleClarifySubmit();
                    }
                  }}
                  className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--card)] px-4 py-3 text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
                  placeholder="What did we miss?"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handleClarifySubmit}
                  disabled={loading || !clarifyValue.trim()}
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-[var(--accent-contrast)] disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="serif-heading text-[20px] leading-snug text-[var(--text-primary)]">{questionDisplay}</p>
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAnswer();
                }
              }}
              disabled={loading}
              className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--card)] px-4 py-3 text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
              placeholder="Your answer"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => void handleAnswer()}
                disabled={loading || !inputValue.trim()}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-[var(--accent-contrast)] disabled:opacity-50"
              >
                Continue
              </button>
              <p className="text-[12px] text-[var(--text-muted)]">{progressLabel}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
