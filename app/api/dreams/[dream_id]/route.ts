import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: { dream_id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { status?: string };

  if (body.status !== "archived" && body.status !== "active") {
    return NextResponse.json(
      {
        error: "Only archived or active status is supported.",
        message: "Only archived or active status is supported.",
      },
      { status: 400 }
    );
  }

  if (body.status === "active") {
    const { count, error: activeCountError } = await supabase
      .from("dreams")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active");

    if (activeCountError) {
      return NextResponse.json({ message: activeCountError.message }, { status: 500 });
    }

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        {
          error: "You already have 3 active dreams. Archive one first.",
          message: "You already have 3 active dreams. Archive one first.",
        },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("dreams")
    .update({ status: body.status })
    .eq("id", params.dream_id)
    .eq("user_id", user.id)
    .select("id,user_id,title,context,status,created_at")
    .single();

  if (error) {
    console.error("[PATCH /api/dreams/[dream_id]] update failed", {
      dream_id: params.dream_id,
      user_id: user.id,
      code: error.code,
      message: error.message,
    });

    if (error.code === "PGRST116") {
      return NextResponse.json({ message: "Dream not found." }, { status: 404 });
    }

    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ dream: data });
}
