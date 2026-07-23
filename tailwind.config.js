/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        lock: {
          DEFAULT: "#14532d",
          light: "#16a34a",
          faint: "#f0fdf4",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Segoe UI",
          "Roboto", "Helvetica Neue", "Arial", "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
};
