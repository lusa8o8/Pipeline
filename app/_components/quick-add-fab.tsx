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
        <div className="absolute bottom-14 right-0 min-w-40 overflow-hidden rounded-md border border-[var(--border-strong)] bg-[var(--card)]">
          {ITEMS.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--border)] ${
                index < ITEMS.length - 1 ? "border-b border-[var(--border)]" : ""
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
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-2xl leading-none text-[var(--accent-contrast)] shadow-lg"
        aria-label={open ? "Close quick add" : "Open quick add"}
      >
        {open ? "×" : "+"}
      </button>
    </div>
  );
}


