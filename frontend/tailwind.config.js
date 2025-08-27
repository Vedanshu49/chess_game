/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f14",
        panel: "#121820",
        accent: "#3ea6ff",
        text: "#e5eef7",
        muted: "#93a4b2"
      }
    }
  },
  plugins: []
}
