import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logApiUsage } from "@/lib/log-api-usage";

type ContextMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  dream_id?: string;
  dream_text?: string;
  messages?: ContextMessage[];
  force_summary?: boolean;
};

type ClaudePayload = {
  type: "question" | "summary";
  question?: string;
  summary?: string;
};

const SYSTEM_PROMPT = `You are a context gathering assistant for Pipeline, a Dream→Execution OS.

Your job is to understand the user's CURRENT REALITY before helping them plan.

The user has entered a dream. Ask targeted follow-up questions to understand:
- Where they are RIGHT NOW (not where they want to be)
- What they've already tried or built
- Real constraints (time per week, budget, team, skills)
- Their single biggest blocker today
- What 90-day success looks like to them

Rules:
- Ask ONE question at a time
- Each question must build on their previous answers
- Never ask something already answered in the dream text or previous messages
- Questions should feel human and direct, not like a form
- When a user gives a vague or uncertain answer:
  * Do not ask the same question again
  * Infer the most likely reality from the vagueness itself
  * Vagueness about resources = constrained/bootstrapped
  * Vagueness about timeline = side project, not primary focus
  * Vagueness about blockers = likely hasn't started yet
  * Use these inferences silently in your summary

After 3-5 exchanges, when you have enough context, respond ONLY with this JSON:
{
  "type": "summary",
  "summary": "2-3 sentences in second person reflecting their current reality back to them. Should feel like someone who truly understands their situation — including what was inferred from vague answers. The user should think 'yes, exactly.' Make it specific to their dream, not generic.",
  "ready": true
}

If you need more information, respond ONLY with this JSON:
{
  "type": "question",
  "question": "Your single focused question here"
}

Never respond with plain text. Always respond with one of the two JSON formats above.`;

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

function buildMessagesForClaude(
  dreamText: string,
  history: ContextMessage[] = [],
  forceSummary?: boolean
): ContextMessage[] {
  const normalized = history.map((message) => ({
    role: message.role,
    content: message.content.trim(),
  }));

  const conversation: ContextMessage[] = [
    { role: "user", content: dreamText.trim() },
    ...normalized,
  ];

  if (forceSummary) {
    conversation.push({
      role: "user",
      content: "Please summarize everything you've learned so far about where I am instead of asking another question.",
    });
  }

  return conversation;
}

async function persistConversation(
  supabase: ReturnType<typeof createClient>,
  dreamId: string,
  userId: string,
  messages: ContextMessage[]
) {
  const { data: existing } = await supabase
    .from("context_conversations")
    .select("id")
    .eq("dream_id", dreamId)
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .maybeSingle();

  const payload = {
    dream_id: dreamId,
    user_id: userId,
    messages,
    status: "in_progress",
  };

  if (existing?.id) {
    await supabase.from("context_conversations").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("context_conversations").insert(payload);
  }
}

function parseClaudeResponse(raw: string) {
  if (!raw || typeof raw !== "string") {
    throw new Error("Response is empty.");
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Response is empty.");
  }

  try {
    return JSON.parse(trimmed) as ClaudePayload;
  } catch (outerError) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw outerError;
    }

    const snippet = trimmed.slice(start, end + 1);
    return JSON.parse(snippet) as ClaudePayload;
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as RequestBody;
  const dreamId = body.dream_id;
  const dreamText = body.dream_text?.trim();

  if (!dreamId) {
    return NextResponse.json({ message: "dream_id is required." }, { status: 400 });
  }

  if (!dreamText) {
    return NextResponse.json({ message: "dream_text is required." }, { status: 400 });
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json({ message: "Missing ANTHROPIC_API_KEY." }, { status: 500 });
  }

  const conversationHistory: ContextMessage[] = (body.messages ?? []) as ContextMessage[];
  const conversationForClaude = buildMessagesForClaude(dreamText, conversationHistory, body.force_summary);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: conversationForClaude,
    }),
  });

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  };

  if (payload.usage?.input_tokens !== undefined && payload.usage?.output_tokens !== undefined) {
    await logApiUsage({
      userId: user.id,
      endpoint: "context_conversation",
      usage: {
        input_tokens: payload.usage.input_tokens,
        output_tokens: payload.usage.output_tokens,
      },
    });
  }

  if (!response.ok) {
    return NextResponse.json(
      { message: payload.error?.message ?? "Failed to gather context." },
      { status: 500 }
    );
  }

  const textBlock = payload.content?.find((item) => item.type === "text")?.text ?? "";

  let parsed: ClaudePayload;
  try {
    parsed = parseClaudeResponse(textBlock);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? `Failed to parse context assistant response: ${error.message}`
            : "Failed to parse context assistant response.",
      },
      { status: 500 }
    );
  }

  const assistantContent = (parsed.type === "question" ? parsed.question : parsed.summary)?.trim();
  if (!assistantContent) {
    return NextResponse.json({ message: "Context assistant returned empty payload." }, { status: 500 });
  }

  const nextMessages: ContextMessage[] = [
    ...conversationHistory,
    { role: "assistant", content: assistantContent },
  ];

  try {
    await persistConversation(supabase, dreamId, user.id, nextMessages);
  } catch (conversationError) {
    return NextResponse.json(
      {
        message:
          conversationError instanceof Error
            ? conversationError.message
            : "Failed to save context conversation.",
      },
      { status: 500 }
    );
  }

  if (parsed.type === "question") {
    return NextResponse.json({ type: "question", question: assistantContent });
  }

  return NextResponse.json({ type: "summary", summary: assistantContent });
}
