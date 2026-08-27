"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    // One-time sync from the pre-paint theme script in app/layout.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setIsDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
    >
      {isDark === null ? null : isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
