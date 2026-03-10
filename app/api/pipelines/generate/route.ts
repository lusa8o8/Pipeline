import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logApiUsage } from "@/lib/log-api-usage";

const SYSTEM_PROMPT = `You are a pipeline architect. Given a dream and a goal, generate 4-6 pipeline stages that represent the execution flow from zero to goal achieved. 

Rules:
- Stages must be action-oriented nouns (e.g. "Prospects", "Conversations", "Proposals", "Clients")
- No more than 6 stages, no fewer than 4
- The last stage always represents goal completion
- Return ONLY a JSON array of stage names, nothing else. Example: ["Prospects","Conversations","Proposals","Clients"]`;

function parseStageArray(raw: string): string[] {
  const trimmed = raw.trim();

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Attempt bracket extraction fallback.
  }

  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Claude returned invalid stage format.");
  }

  const extracted = trimmed.slice(start, end + 1);
  const parsed = JSON.parse(extracted);

  if (!Array.isArray(parsed)) {
    throw new Error("Claude returned invalid stage format.");
  }

  return parsed.map((item) => String(item).trim()).filter(Boolean);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { dream_id?: string };
  const dreamId = body.dream_id;

  if (!dreamId) {
    return NextResponse.json({ message: "dream_id is required." }, { status: 400 });
  }

  const { data: dream, error: dreamError } = await supabase
    .from("dreams")
    .select("id,title,context,context_summary,user_id,goals(outcome,created_at),pipelines(id)")
    .eq("id", dreamId)
    .eq("user_id", user.id)
    .single();

  if (dreamError || !dream) {
    return NextResponse.json({ message: "Dream not found." }, { status: 404 });
  }

  const existingPipeline = (dream.pipelines ?? [])[0];
  if (existingPipeline?.id) {
    return NextResponse.json(
      { message: "Pipeline already exists.", pipeline_id: existingPipeline.id },
      { status: 400 }
    );
  }

  const goal = (dream.goals ?? [])[0];
  if (!goal?.outcome) {
    return NextResponse.json({ message: "Goal not found for this dream." }, { status: 400 });
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json({ message: "Missing ANTHROPIC_API_KEY." }, { status: 500 });
  }

const contextBlock = dream.context_summary
  ? `User context: ${dream.context_summary.trim()}`
  : dream.context?.trim()
  ? `User context: ${dream.context.trim()}`
  : "";
const userMessage = [
  `Dream: ${dream.title}`,
  `Goal: ${goal.outcome}`,
  contextBlock,
]
  .filter(Boolean)
  .join("\n\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
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
      endpoint: "generate_pipeline",
      usage: {
        input_tokens: payload.usage.input_tokens,
        output_tokens: payload.usage.output_tokens,
      },
    });
  }

  if (!response.ok) {
    return NextResponse.json(
      { message: payload.error?.message ?? "Failed to generate pipeline." },
      { status: 500 }
    );
  }

  const textBlock = payload.content?.find((item) => item.type === "text")?.text ?? "";

  let stages: string[];
  try {
    stages = parseStageArray(textBlock);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to parse generated stages.",
      },
      { status: 500 }
    );
  }

  if (stages.length < 4 || stages.length > 6) {
    return NextResponse.json(
      { message: "Generated stages must contain between 4 and 6 items." },
      { status: 500 }
    );
  }

  return NextResponse.json({ stages });
}

