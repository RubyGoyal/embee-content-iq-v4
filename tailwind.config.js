/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F5F1EA",
        "paper-2": "#EFEAE0",
        "paper-3": "#E7E0D2",
        ink: "#1A1815",
        "ink-80": "#2E2A24",
        "ink-60": "#6B655A",
        "ink-40": "#9A9286",
        "ink-20": "#C9C2B3",
        rule: "#D9D1BF",
        amber: "#C66A1A",
        "amber-soft": "#E8B97E",
        green: "#2F6B3D",
      },
      fontFamily: {
        serif: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Inter Tight"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
