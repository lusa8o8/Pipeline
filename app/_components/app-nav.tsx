"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "./sign-out-button";
import { QuickAddFab } from "./quick-add-fab";

type UserState = {
  email: string | null;
  activeDreamTitle: string;
};

const NAV_ITEMS = [
  { href: "/today", label: "Today" },
  { href: "/dashboard", label: "Dreams" },
  { href: "/dashboard", label: "Archive" },
  { href: "/dashboard", label: "Settings" },
];

const MOBILE_ITEMS = [
  { href: "/today", label: "Today" },
  { href: "/dashboard", label: "Dreams" },
  { href: "/dashboard", label: "Archive" },
];

export function AppNav() {
  const pathname = usePathname();
  const [userState, setUserState] = useState<UserState | null>(null);

  useEffect(() => {
    const loadUserState = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUserState(null);
        return;
      }

      const { data: activeDream } = await supabase
        .from("dreams")
        .select("title")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      setUserState({
        email: user.email ?? null,
        activeDreamTitle: activeDream?.title ?? "No active dream",
      });
    };

    void loadUserState();
  }, [pathname]);

  const isAuthRoute = pathname === "/sign-in" || pathname === "/sign-up";

  if (isAuthRoute || !userState) {
    return null;
  }

  return (
    <>
      <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-[220px] shrink-0 flex-col border-r border-[#1E1E1E] bg-[#0A0A0A] px-0 py-8 md:flex">
        <div className="px-6 pb-10">
          <p className="serif-heading text-[20px] tracking-[-0.5px] text-white">Pipeline</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.5px] text-[#555]">Execution OS</p>
        </div>

        <div className="border-b border-[#1E1E1E] px-6 pb-8">
          <p className="mb-2 text-[10px] uppercase tracking-[1px] text-[#444]">Active Dream</p>
          <p className="text-[13px] leading-5 text-[#DDD]">{userState.activeDreamTitle}</p>
          <div className="mt-3 h-1 overflow-hidden rounded bg-[#1A1A1A]">
            <div className="h-1 w-[22%] rounded bg-white" />
          </div>
        </div>

        <nav className="flex-1 py-6">
          {NAV_ITEMS.map((item) => {
            const isActive =
              (item.label === "Today" && pathname === "/today") ||
              (item.label === "Dreams" && pathname === "/dashboard");

            return (
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                className={`block border-l-2 px-6 py-[10px] text-[13px] tracking-[0.2px] transition-colors ${
                  isActive
                    ? "border-white bg-[#1A1A1A] text-white"
                    : "border-transparent text-[#555] hover:border-[#333] hover:bg-[#111]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[#1E1E1E] px-6 pt-5">
          {userState.email ? <p className="text-[11px] text-[#444]">{userState.email}</p> : null}
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="fixed right-4 top-3 z-[60] md:hidden">
        <SignOutButton className="border-0 bg-transparent px-0 py-0 text-[11px] uppercase tracking-[0.6px] text-[#444] hover:border-0 hover:bg-transparent hover:text-[#555]" />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 border-t border-[#1E1E1E] bg-[#0A0A0A] md:hidden">
        {MOBILE_ITEMS.map((item) => {
          const isActive =
            (item.label === "Today" && pathname === "/today") ||
            (item.label === "Dreams" && pathname === "/dashboard");

          return (
            <Link
              key={`mobile-${item.label}`}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] uppercase tracking-[0.6px] ${
                isActive ? "text-white" : "text-[#444]"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : "bg-[#444]"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <QuickAddFab />
    </>
  );
}
