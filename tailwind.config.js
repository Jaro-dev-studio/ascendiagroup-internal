/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      black: "#000000",

      primary: {
        DEFAULT: "rgb(var(--primary) / <alpha-value>)",
        foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        50: "#eff6ff",
        100: "#dbeafe",
        200: "#bfdbfe",
        300: "#93c5fd",
        400: "#60a5fa",
        500: "#3b82f6",
        600: "#2563eb",
        700: "#1d4ed8",
        800: "#1e40af",
        900: "#1e3a8a",
      },

      secondary: {
        DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
        foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        50: "#f8fafc",
        100: "#f1f5f9",
        200: "#e2e8f0",
        300: "#cbd5e1",
        400: "#94a3b8",
        500: "#64748b",
        600: "#475569",
        700: "#334155",
        800: "#1e293b",
        900: "#0f172a",
      },

      accent: {
        DEFAULT: "rgb(var(--accent) / <alpha-value>)",
        foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        50: "#ecfdf5",
        100: "#d1fae5",
        200: "#a7f3d0",
        300: "#6ee7b7",
        400: "#34d399",
        500: "#10b981",
        600: "#059669",
        700: "#047857",
        800: "#065f46",
        900: "#064e3b",
      },

      success: {
        DEFAULT: "rgb(var(--success) / <alpha-value>)",
        50: "#ecfdf5",
        100: "#d1fae5",
        500: "#10b981",
        600: "#059669",
        700: "#047857",
      },

      warning: {
        DEFAULT: "rgb(var(--warning) / <alpha-value>)",
        50: "#fffbeb",
        100: "#fef3c7",
        500: "#f59e0b",
        600: "#d97706",
        700: "#b45309",
      },

      danger: {
        DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
        50: "#fef2f2",
        100: "#fee2e2",
        500: "#ef4444",
        600: "#dc2626",
        700: "#b91c1c",
      },

      background: {
        DEFAULT: "rgb(var(--background) / <alpha-value>)",
        secondary: "rgb(var(--background-secondary) / <alpha-value>)",
        tertiary: "rgb(var(--background-tertiary) / <alpha-value>)",
      },
      foreground: "rgb(var(--foreground) / <alpha-value>)",
      card: {
        DEFAULT: "rgb(var(--card) / <alpha-value>)",
        foreground: "rgb(var(--card-foreground) / <alpha-value>)",
      },
      popover: {
        DEFAULT: "rgb(var(--popover) / <alpha-value>)",
        foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
      },
      muted: {
        DEFAULT: "rgb(var(--muted) / <alpha-value>)",
        foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
      },
      destructive: {
        DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
        foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
      },
      border: "rgb(var(--border) / <alpha-value>)",
      input: "rgb(var(--input) / <alpha-value>)",
      ring: "rgb(var(--ring) / <alpha-value>)",
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        "card-hover":
          "0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 6px -2px rgb(15 23 42 / 0.06)",
        popover: "0 10px 30px -10px rgb(15 23 42 / 0.2)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "fade-in-up": "fade-in-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [
    // eslint-disable-next-line
    require("@tailwindcss/typography"),
    // eslint-disable-next-line
    require("@tailwindcss/forms"),
    // eslint-disable-next-line
    require("tailwindcss-animate"),
  ],
};
