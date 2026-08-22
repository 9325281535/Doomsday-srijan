/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tokens per UIUX_Design_Brief_Supply_Chain_Disruption_Agent_v2.md §2.1
        canvas: "#0B0E14",
        surface: "#141821",
        "surface-raised": "#1B2028",
        "surface-dark": "#0D1017",
        border: "#262B36",
        "text-primary": "#E8EAED",
        "text-secondary": "#8B93A1",
        "signal-active": "#4EA1FF",
        "status-auto": "#3DD68C",
        "status-pending": "#F5A623",
        "status-rejected": "#F2545B",
        "trust-alert": "#B94EFF",
        // Cargox-inspired accent system
        accent: "#F5A623",
        "accent-hover": "#E09010",
        "accent-muted": "rgba(245,166,35,0.12)",
        "accent-border": "rgba(245,166,35,0.25)",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
      borderRadius: {
        card: "12px",
      },
      keyframes: {
        "pulse-border": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "trust-flash": {
          "0%, 100%": { borderColor: "#262B36" },
          "20%, 60%": { borderColor: "#B94EFF" },
        },
      },
      animation: {
        "pulse-border": "pulse-border 1.6s ease-in-out infinite",
        "trust-flash": "trust-flash 0.6s ease-in-out 2",
      },
    },
  },
  plugins: [],
};
