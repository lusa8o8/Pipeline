export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./_components/sign-out-button";
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
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const dreams = (data ?? []) as Dream[];

  return (
    <main className="min-h-screen">
      <nav className="flex justify-end gap-4 border-b border-gray-200 p-4 text-sm">
        <span>{user.email}</span>
        <SignOutButton />
      </nav>
      <DashboardClient initialDreams={dreams} />
    </main>
  );
}
