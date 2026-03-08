export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/app/_components/app-nav";
import { DashboardClient } from "./_components/dashboard-client";

type Goal = {
  id: string;
  dream_id: string;
  user_id: string;
  outcome: string;
  created_at: string;
};

type Pipeline = {
  id: string;
  dream_id: string;
  user_id: string;
  created_at: string;
};

type Dream = {
  id: string;
  user_id: string;
  title: string;
  status: "active" | "archived";
  created_at: string;
  goals: Goal[];
  pipelines: Pipeline[];
};

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data, error } = await supabase
    .from("dreams")
    .select(
      "id,user_id,title,status,created_at,goals(id,dream_id,user_id,outcome,created_at),pipelines(id,dream_id,user_id,created_at)"
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const dreams = (data ?? []) as Dream[];

  return (
    <main className="min-h-screen">
      <AppNav email={user.email} />
      <DashboardClient initialDreams={dreams} />
    </main>
  );
}

