import { useThemeStore } from "@/store/theme-store";

export function useTheme() {
  const { theme, setTheme, toggleTheme } = useThemeStore();

  return {
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme,
  };
}

