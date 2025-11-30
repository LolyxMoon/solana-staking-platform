/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      colors: {
        // Streamflow exact color palette
        dark: {
          950: "#060609", // main background - almost pure black
          900: "#0F1420", // secondary background - very dark
          800: "#1A1F2E", // card background
          700: "#242937", // elevated elements
          600: "#2F3541", // borders/dividers - very subtle
        },
        primary: {
          500: "#5B8DEF", // streamflow blue accent (softer)
          600: "#4A7FE7", // hover state
          700: "#3B71D4", // active state
        },
        accent: {
          green: "#10B981", // success/rewards
          red: "#EF4444", // error/danger
          yellow: "#F59E0B", // warning
        },
      },
    },
  },
  plugins: [],
};
