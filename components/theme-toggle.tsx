"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY } from "@/lib/theme-script";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Geen localStorage beschikbaar — thema onthouden slaan we dan gewoon over.
    }
    setIsDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Zet dagmodus aan" : "Zet avondmodus aan"}
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground transition-colors hover:bg-foreground/20 sm:size-10"
    >
      {isDark === null ? (
        <span className="size-4 sm:size-5" />
      ) : isDark ? (
        <Sun className="size-4 sm:size-5" />
      ) : (
        <Moon className="size-4 sm:size-5" />
      )}
    </button>
  );
}
