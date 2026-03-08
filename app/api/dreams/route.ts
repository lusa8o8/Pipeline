import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("dreams")
    .select(
      "id,user_id,title,context,status,created_at,goals(id,dream_id,user_id,outcome,created_at),pipelines(id,dream_id,user_id,created_at)"
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ dreams: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { title?: string; context?: string };
  const title = body.title?.trim();
  const context = body.context?.trim() ?? "";

  if (!title) {
    return NextResponse.json({ message: "Title is required." }, { status: 400 });
  }

  const { count, error: countError } = await supabase
    .from("dreams")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");

  if (countError) {
    return NextResponse.json({ message: countError.message }, { status: 500 });
  }

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { message: "You can only have 3 active dreams at a time." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("dreams")
    .insert({ user_id: user.id, title, context: context || null })
    .select("id,user_id,title,context,status,created_at")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ dream: data });
}
