"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`w-8 h-8 rounded-lg border border-slate-200 dark:border-zinc-800 ${className}`} />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTheme();
      }}
      type="button"
      className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center justify-center ${
        isDark
          ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800"
          : "bg-white border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-100 shadow-xs"
      } ${className}`}
      title={isDark ? "Switch to Light theme" : "Switch to Dark theme"}
      aria-label="Toggle Theme"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-purple-600" />
      )}
    </button>
  );
}
