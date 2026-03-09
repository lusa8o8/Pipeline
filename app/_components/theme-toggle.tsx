"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const initial: Theme = stored === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`rounded border border-[var(--border-strong)] bg-[var(--card)] px-3 py-1 text-[11px] uppercase tracking-[0.6px] text-[var(--text-muted)] hover:border-[var(--border-hover)] hover:text-[var(--text-secondary)]${className ? ` ${className}` : ""}`}
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
