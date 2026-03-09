export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArchiveClient } from "./archive-client";

type ArchivedDream = {
  id: string;
  title: string;
  context: string | null;
  created_at: string;
};

export default async function ArchivePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: archivedDreams, error: archivedError } = await supabase
    .from("dreams")
    .select("id,title,context,created_at")
    .eq("user_id", user.id)
    .eq("status", "archived")
    .order("created_at", { ascending: false });

  if (archivedError) {
    throw new Error(archivedError.message);
  }

  const { count: activeDreamCount, error: activeCountError } = await supabase
    .from("dreams")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");

  if (activeCountError) {
    throw new Error(activeCountError.message);
  }

  return (
    <main className="flex min-h-screen bg-[#080808] text-white">
      <div className="flex-1 pb-[80px] md:pb-0">
        <ArchiveClient
          initialDreams={(archivedDreams ?? []) as ArchivedDream[]}
          initialActiveDreamCount={activeDreamCount ?? 0}
        />
      </div>
    </main>
  );
}
