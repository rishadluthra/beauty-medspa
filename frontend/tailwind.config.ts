import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Brand palette matched to decodahealth.com's design system (see
        // ATTENTION_TO_DETAIL.md for how these were extracted).
        brand: {
          bg: "#faf6f0",
          dark: "#1b211b",
          gold: "#c5a37e",
          "gold-dark": "#b08e68",
          sage: "#4a5d4e",
          "navy-teal": "#144761",
          // "Needs attention" tone (errors, cancelled/failed states) — kept
          // muted rather than a harsh bright red to stay within the
          // palette; matches the `rust` entry in lib/chartColors.ts.
          rust: "#9a3412",
        },
      },
    },
  },
  plugins: [],
};
export default config;
