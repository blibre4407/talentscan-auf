/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        institutional: {
          blue: '#1e3a8a', // blue-900
          light: '#eff6ff', // blue-50
          accent: '#3b82f6', // blue-500
        }
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'], // For AI scores
      }
    },
  },
  plugins: [],
}