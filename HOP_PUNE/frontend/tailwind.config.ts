/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tokens per UIUX_Design_Brief_Supply_Chain_Disruption_Agent_v2.md §2.1
        canvas: "#0A0F16",
        surface: "#101724",
        "surface-raised": "#162131",
        border: "#263447",
        "text-primary": "#E9EEF5",
        "text-secondary": "#9DAEC3",
        "signal-active": "#12BCA6",
        "status-auto": "#43D49C",
        "status-pending": "#F5B93E",
        "status-rejected": "#F06D73",
        "trust-alert": "#9C8CFF",
      },
      fontFamily: {
        display: ["Arial Narrow", "Arial", "Helvetica Neue", "sans-serif"],
        body: ["Arial", "Helvetica Neue", "sans-serif"],
        mono: ["SFMono-Regular", "Menlo", "monospace"],
        script: ["Comic Sans MS", "Bradley Hand", "Segoe Print", "cursive"],
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
          "0%, 100%": { borderColor: "#DCE3EA" },
          "20%, 60%": { borderColor: "#7257E8" },
        },
        "float-in": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-node": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.75" },
          "50%": { transform: "scale(1.2)", opacity: "1" },
        },
        dash: {
          to: { strokeDashoffset: "-216" },
        },
      },
      animation: {
        "pulse-border": "pulse-border 1.6s ease-in-out infinite",
        "trust-flash": "trust-flash 0.6s ease-in-out 2",
        "float-in": "float-in 0.6s ease-out both",
        "pulse-node": "pulse-node 2.4s ease-in-out infinite",
        dash: "dash 3s linear infinite",
      },
    },
  },
  plugins: [],
};
