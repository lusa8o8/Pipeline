"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  const onSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <button
      onClick={onSignOut}
      className="rounded border border-[#2A2A2A] px-3 py-1 text-[11px] text-[#333] hover:border-[#333] hover:text-[#555]"
    >
      Sign out
    </button>
  );
}
