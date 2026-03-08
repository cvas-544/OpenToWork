/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        orange: {
          DEFAULT: "#E8621A",
          light: "#F5884A",
          xlight: "#FEF0E8",
        },
        navy: "#1A1A2E",
      },
      fontFamily: {
        display: ["Bebas Neue", "sans-serif"],
        sans: ["Sora", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
