export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./_components/sign-out-button";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <main className="min-h-screen">
      <nav className="flex justify-end gap-4 border-b border-gray-200 p-4 text-sm">
        <span>{user.email}</span>
        <SignOutButton />
      </nav>
      <section className="p-6">
        <p>You have no pipelines yet.</p>
      </section>
    </main>
  );
}

