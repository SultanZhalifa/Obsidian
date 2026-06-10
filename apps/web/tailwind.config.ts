import type { Config } from "tailwindcss";

/**
 * OBSIDIAN monochrome design system.
 *
 * Colors are driven entirely by CSS variables defined in globals.css so the
 * whole UI is one coherent graded-grayscale system rather than an ad-hoc set of
 * Tailwind palette colors. The only chromatic values are the deliberately
 * low-chroma semantic accents (up/down/warn/info) used for status meaning.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          0: "var(--bg-0)",
          1: "var(--bg-1)",
          2: "var(--bg-2)",
          3: "var(--bg-3)",
        },
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
        fg: {
          0: "var(--fg-0)",
          1: "var(--fg-1)",
          2: "var(--fg-2)",
        },
        up: "var(--up)",
        "up-bg": "var(--up-bg)",
        down: "var(--down)",
        "down-bg": "var(--down-bg)",
        warn: "var(--warn)",
        info: "var(--info)",
        accent: "var(--accent)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.875rem" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
      },
      boxShadow: {
        panel: "0 1px 0 0 var(--line) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
      keyframes: {
        flashUp: {
          "0%": { backgroundColor: "var(--up-bg)" },
          "100%": { backgroundColor: "transparent" },
        },
        flashDown: {
          "0%": { backgroundColor: "var(--down-bg)" },
          "100%": { backgroundColor: "transparent" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "flash-up": "flashUp 0.6s ease-out",
        "flash-down": "flashDown 0.6s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
