/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "#1A1A1A",
        panel: "#2D2D2D",
        accent: "#63B3ED",
        text: "#E2E8F0",
        muted: "#4A5568"
      }
    }
  },
  plugins: []
}
