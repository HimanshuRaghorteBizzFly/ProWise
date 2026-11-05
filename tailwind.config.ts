import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "var(--color-app-bg)",
          surface: "var(--color-surface)",
          sidebar: "var(--color-sidebar)",
          elevated: "var(--color-elevated)",
          hover: "var(--color-hover)",
          border: "var(--color-border)",
          text: {
            primary: "var(--color-text-primary)",
            secondary: "var(--color-text-secondary)",
            muted: "var(--color-text-muted)",
          },
          accent: {
            DEFAULT: "var(--color-accent)",
            hover: "var(--color-accent-hover)",
            subtle: "var(--color-accent-subtle)",
            foreground: "var(--color-accent-foreground)",
          },
        },
        health: {
          ontrack: {
            bg: "var(--color-health-ontrack-bg)",
            text: "var(--color-health-ontrack-text)",
            border: "var(--color-health-ontrack-border)",
          },
          atrisk: {
            bg: "var(--color-health-atrisk-bg)",
            text: "var(--color-health-atrisk-text)",
            border: "var(--color-health-atrisk-border)",
          },
          delayed: {
            bg: "var(--color-health-delayed-bg)",
            text: "var(--color-health-delayed-text)",
            border: "var(--color-health-delayed-border)",
          },
          unknown: {
            bg: "var(--color-health-unknown-bg)",
            text: "var(--color-health-unknown-text)",
            border: "var(--color-health-unknown-border)",
          },
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "'Helvetica Neue'",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        workspace: "12px",
        pill: "9999px",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(60, 64, 67, 0.08), 0 1px 3px 1px rgba(60, 64, 67, 0.05)",
        floating: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)",
        modal: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;

