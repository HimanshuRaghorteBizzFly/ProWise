import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    // Tests run as a dev preview: sample data exists only behind this flag (never in normal use or production).
    // Tests about normal use switch it off with vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "").
    env: { NEXT_PUBLIC_USE_MOCKS: "true" },
  },
});
