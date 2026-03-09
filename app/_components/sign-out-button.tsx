"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SignOutButtonProps = {
  className?: string;
};

export function SignOutButton({ className }: SignOutButtonProps) {
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
      className={`rounded border border-[var(--border-strong)] bg-transparent px-3 py-1 text-[11px] text-[var(--text-muted)] hover:border-[var(--border-hover)] hover:text-[var(--text-secondary)]${className ? ` ${className}` : ""}`}
    >
      Sign out
    </button>
  );
}
