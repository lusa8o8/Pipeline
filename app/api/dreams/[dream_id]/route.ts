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

  if (body.status !== "archived") {
    return NextResponse.json(
      { message: "Only archived status is supported." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("dreams")
    .update({ status: "archived" })
    .eq("id", params.dream_id)
    .eq("user_id", user.id)
    .select("id,user_id,title,context,status,created_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ message: "Dream not found." }, { status: 404 });
    }

    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ dream: data });
}
