import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        // Philly GamePlan: "night game under the lights"
        night: {
          950: "#050b10",
          900: "#07121a",
          850: "#0a1822",
          800: "#0e1f2b",
          700: "#152c3a",
        },
        mint: {
          200: "#a7f7e6",
          300: "#5eead4",
          400: "#2dd4bf",
        },
        glow: {
          cyan: "#22d3ee",
          violet: "#a78bfa",
          amber: "#fbbf24",
          rose: "#fb7185",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "ui-sans-serif", "sans-serif"],
        score: ["var(--font-score)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(94,234,212,0.28), 0 12px 40px -10px rgba(45,212,191,0.55)",
        "glow-sm": "0 0 0 1px rgba(94,234,212,0.22), 0 6px 20px -8px rgba(45,212,191,0.5)",
        lift: "0 24px 60px -24px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        beam: {
          "0%,100%": { opacity: "0.35", transform: "rotate(-8deg)" },
          "50%": { opacity: "0.6", transform: "rotate(4deg)" },
        },
        "field-scroll": { "0%": { backgroundPosition: "0 0" }, "100%": { backgroundPosition: "0 96px" } },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.7" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        float: "float 6s ease-in-out infinite",
        beam: "beam 9s ease-in-out infinite",
        "field-scroll": "field-scroll 5s linear infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.2,0.6,0.3,1) infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
