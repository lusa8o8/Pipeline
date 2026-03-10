import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ContextMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  dream_id?: string;
  context_summary?: string;
  messages?: ContextMessage[];
};

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
  const contextSummary = body.context_summary?.trim();

  if (!dreamId) {
    return NextResponse.json({ message: "dream_id is required." }, { status: 400 });
  }

  if (!contextSummary) {
    return NextResponse.json({ message: "context_summary is required." }, { status: 400 });
  }

  const { data: dream, error: dreamError } = await supabase
    .from("dreams")
    .select("id")
    .eq("id", dreamId)
    .eq("user_id", user.id)
    .single();

  if (dreamError || !dream) {
    return NextResponse.json({ message: "Dream not found." }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("context_conversations")
    .select("id")
    .eq("dream_id", dreamId)
    .eq("user_id", user.id)
    .maybeSingle();

  const conversationPayload = {
    dream_id: dreamId,
    user_id: user.id,
    messages: body.messages ?? [],
    context_summary: contextSummary,
    status: "complete",
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("context_conversations")
      .update(conversationPayload)
      .eq("id", existing.id);

    if (updateError) {
      return NextResponse.json({ message: updateError.message }, { status: 500 });
    }
  } else {
    const { error: insertError } = await supabase
      .from("context_conversations")
      .insert(conversationPayload);

    if (insertError) {
      return NextResponse.json({ message: insertError.message }, { status: 500 });
    }
  }

  const { error: dreamUpdateError } = await supabase
    .from("dreams")
    .update({ context_summary: contextSummary })
    .eq("id", dreamId)
    .eq("user_id", user.id);

  if (dreamUpdateError) {
    return NextResponse.json({ message: dreamUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
