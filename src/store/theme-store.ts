import { create } from "zustand";

type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  resolvedTheme: "light" | "dark";
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "light",
  resolvedTheme: "light",
  setTheme: (theme) => {
    let resolved: "light" | "dark" = "light";
    if (theme === "system") {
      if (typeof window !== "undefined") {
        resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    } else {
      resolved = theme;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("prowise-theme", theme);
      if (resolved === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }

    set({ theme, resolvedTheme: resolved });
  },

  toggleTheme: () => {
    const current = get().theme;
    const next = current === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
}));
