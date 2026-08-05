/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        void: "#05070a",
        surface: "#0c1016",
        panel: "rgba(18, 24, 34, 0.72)",
        edge: "rgba(148, 163, 184, 0.12)",
        signal: "#5eead4",
        pulse: "#f472b6",
        amber: "#fbbf24",
        species: {
          1: "#4ade80",
          2: "#f87171",
          3: "#facc15",
          4: "#60a5fa",
        },
      },
      boxShadow: {
        glass: "0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 60px -20px rgba(0,0,0,0.6)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
