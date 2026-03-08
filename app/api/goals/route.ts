import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { dream_id?: string; outcome?: string };
  const dreamId = body.dream_id;
  const outcome = body.outcome?.trim();

  if (!dreamId || !outcome) {
    return NextResponse.json(
      { message: "dream_id and outcome are required." },
      { status: 400 }
    );
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

  const { data, error } = await supabase
    .from("goals")
    .insert({ dream_id: dreamId, user_id: user.id, outcome })
    .select("id,dream_id,user_id,outcome,created_at")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data });
}
