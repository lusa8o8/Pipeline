import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: { pipeline_id: string } };

type ClaudeResponse = {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
};

const SYSTEM_PROMPT = `You are a task architect. Given a dream, a goal, and a list of projects, generate 3-5 actionable tasks for each project.

Rules:
- Tasks must be specific and completable in under 2 hours
- Tasks must be action-oriented (start with a verb: "Write", "Build", "Call", "Research")
- Return ONLY a valid JSON object where keys are project names and values are arrays of task titles
- Example: {"Validate Problem": ["Write 10 interview questions", "Identify 20 potential users", "Conduct 5 user interviews"], "Build MVP": ["Design login screen", "Build auth flow", "Connect database"]}`;

function parseTaskObject(raw: string): Record<string, string[]> {
  const trimmed = raw.trim();

  const tryParse = (value: string) => JSON.parse(value) as Record<string, unknown>;

  let parsed: Record<string, unknown>;
  try {
    parsed = tryParse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Claude returned invalid task JSON.");
    }
    parsed = tryParse(trimmed.slice(start, end + 1));
  }

  const normalized: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!Array.isArray(value)) {
      continue;
    }

    normalized[key] = value.map((item) => String(item).trim()).filter(Boolean);
  }

  return normalized;
}

export async function POST(_request: Request, { params }: Params) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .select("id,dream_id,user_id")
    .eq("id", params.pipeline_id)
    .eq("user_id", user.id)
    .single();

  if (pipelineError || !pipeline) {
    return NextResponse.json({ message: "Pipeline not found." }, { status: 404 });
  }

  const { data: dream, error: dreamError } = await supabase
    .from("dreams")
    .select("title,goals(outcome,created_at)")
    .eq("id", pipeline.dream_id)
    .eq("user_id", user.id)
    .single();

  if (dreamError || !dream) {
    return NextResponse.json({ message: "Dream not found." }, { status: 404 });
  }

  const goalOutcome = dream.goals?.[0]?.outcome;
  if (!goalOutcome) {
    return NextResponse.json({ message: "Goal not found for this pipeline." }, { status: 400 });
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id,name,position")
    .eq("pipeline_id", pipeline.id)
    .order("position", { ascending: true });

  if (projectsError || !projects || projects.length === 0) {
    return NextResponse.json({ message: "Projects not found." }, { status: 404 });
  }

  const existingCards = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("pipeline_id", pipeline.id)
    .eq("user_id", user.id);

  if ((existingCards.count ?? 0) > 0) {
    return NextResponse.json({ success: true });
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json({ message: "Missing ANTHROPIC_API_KEY." }, { status: 500 });
  }

  const projectNames = projects.map((project) => project.name).join(", ");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Dream: ${dream.title}\nGoal: ${goalOutcome}\nProjects: ${projectNames}`,
        },
      ],
    }),
  });

  const payload = (await response.json()) as ClaudeResponse;

  if (!response.ok) {
    return NextResponse.json(
      { message: payload.error?.message ?? "Failed to generate tasks." },
      { status: 500 }
    );
  }

  const textBlock = payload.content?.find((item) => item.type === "text")?.text ?? "";

  let taskMap: Record<string, string[]>;
  try {
    taskMap = parseTaskObject(textBlock);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to parse generated tasks." },
      { status: 500 }
    );
  }

  const cardsToInsert: Array<{
    stage_id: string;
    pipeline_id: string;
    user_id: string;
    title: string;
    status: "backlog";
    position: number;
  }> = [];

  for (const project of projects) {
    const tasks = taskMap[project.name] ?? [];
    const selected = tasks.slice(0, 5);

    selected.forEach((task, index) => {
      cardsToInsert.push({
        stage_id: project.id,
        pipeline_id: pipeline.id,
        user_id: user.id,
        title: task,
        status: "backlog",
        position: index,
      });
    });
  }

  if (cardsToInsert.length > 0) {
    const { error: insertError } = await supabase.from("cards").insert(cardsToInsert);
    if (insertError) {
      return NextResponse.json({ message: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
