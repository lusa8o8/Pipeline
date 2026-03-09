import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type MoveCardBody = {
  status?: "backlog" | "doing" | "done";
};

export async function PATCH(
  request: Request,
  { params }: { params: { card_id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as MoveCardBody;
  const status = body.status;

  if (!status) {
    return NextResponse.json({ message: "status is required." }, { status: 400 });
  }

  if (!["backlog", "doing", "done"].includes(status)) {
    return NextResponse.json({ message: "Invalid status." }, { status: 400 });
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id,stage_id,pipeline_id,user_id")
    .eq("id", params.card_id)
    .eq("user_id", user.id)
    .single();

  if (cardError || !card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 });
  }

  const { count, error: countError } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", card.stage_id)
    .eq("pipeline_id", card.pipeline_id)
    .eq("user_id", user.id)
    .eq("status", status)
    .neq("id", card.id);

  if (countError) {
    return NextResponse.json({ message: countError.message }, { status: 500 });
  }

  const focusedAt = status === "doing" ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("cards")
    .update({ status, position: count ?? 0, focused_at: focusedAt })
    .eq("id", card.id)
    .eq("user_id", user.id)
    .select("id,stage_id,pipeline_id,user_id,title,position,status,focused_at,created_at")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ card: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { card_id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id")
    .eq("id", params.card_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (cardError) {
    return NextResponse.json({ message: cardError.message }, { status: 500 });
  }

  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 });
  }

  const { error } = await supabase
    .from("cards")
    .delete()
    .eq("id", params.card_id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

