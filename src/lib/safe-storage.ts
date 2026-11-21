import { createJSONStorage, type StateStorage } from "zustand/middleware";

const memoryFallback = new Map<string, string>();

const safeStorage: StateStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") {
      return memoryFallback.get(key) ?? null;
    }
    try {
      return window.localStorage.getItem(key) ?? memoryFallback.get(key) ?? null;
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  },
  setItem: (key: string, value: string): void => {
    memoryFallback.set(key, value);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Storage restricted or quota exceeded
      }
    }
  },
  removeItem: (key: string): void => {
    memoryFallback.delete(key);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Storage restricted
      }
    }
  },
};

export const safeJSONStorage = createJSONStorage(() => safeStorage);
