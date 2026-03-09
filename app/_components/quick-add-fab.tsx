"use client";

import Link from "next/link";
import { useState } from "react";

const ITEMS = [
  { label: "New Dream", href: "/dashboard" },
  { label: "New Project", href: "/dashboard" },
  { label: "New Task", href: "/dashboard" },
];

export function QuickAddFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-[72px] right-4 z-50 md:bottom-8 md:right-8">
      {open ? (
        <div className="absolute bottom-14 right-0 min-w-40 overflow-hidden rounded-md border border-[#2A2A2A] bg-[#111]">
          {ITEMS.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-3 text-sm text-[#DDD] hover:bg-[#1A1A1A] ${
                index < ITEMS.length - 1 ? "border-b border-[#1A1A1A]" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl leading-none text-black shadow-lg"
        aria-label={open ? "Close quick add" : "Open quick add"}
      >
        {open ? "×" : "+"}
      </button>
    </div>
  );
}

