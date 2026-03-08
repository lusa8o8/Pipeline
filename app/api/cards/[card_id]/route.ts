import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type MoveCardBody = {
  stage_id?: string;
  position?: number;
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
  const stageId = body.stage_id;
  const position = body.position;

  if (!stageId || typeof position !== "number") {
    return NextResponse.json(
      { message: "stage_id and position are required." },
      { status: 400 }
    );
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id,pipeline_id,user_id")
    .eq("id", params.card_id)
    .eq("user_id", user.id)
    .single();

  if (cardError || !card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 });
  }

  const { data: stage, error: stageError } = await supabase
    .from("stages")
    .select("id,pipeline_id")
    .eq("id", stageId)
    .eq("pipeline_id", card.pipeline_id)
    .single();

  if (stageError || !stage) {
    return NextResponse.json({ message: "Stage not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("cards")
    .update({ stage_id: stageId, position })
    .eq("id", card.id)
    .eq("user_id", user.id)
    .select("id,stage_id,pipeline_id,user_id,title,position,created_at")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ card: data });
}
