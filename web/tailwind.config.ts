import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        oled: "#06060A",
        "panel-dark": "#0C0D14",
        "panel-card": "#12131D",
        "panel-elevated": "#181A28",
        parchment: "#F3EAD8",
        ash: "#CEC4B3",
        pewter: "#9A9184",
        brass: "#E5A93B",
        solar: {
          DEFAULT: "#F2A63B",
          glow: "rgba(242, 166, 59, 0.25)",
          dark: "#B45309",
        },
        frost: {
          DEFAULT: "#38BDF8",
          glow: "rgba(56, 189, 248, 0.25)",
          dark: "#0284C7",
        },
        void: {
          DEFAULT: "#A855F7",
          glow: "rgba(168, 85, 247, 0.25)",
          dark: "#7E22CE",
        },
        jackpot: {
          DEFAULT: "#00EC97",
          glow: "rgba(0, 236, 151, 0.25)",
        },
        hp: {
          DEFAULT: "#EF4444",
          enrage: "#DC2626",
          alert: "#F43F5E",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        serif: [
          "var(--font-serif)",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "Times",
          "serif",
        ],
        lore: [
          "var(--font-lore)",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
