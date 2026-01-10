/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'retro-bg': '#1a1815',
        'retro-panel': '#2b2724',
        'retro-border': '#4a453f',
        'retro-text': '#d6cfc7',
        'retro-accent': '#d4b483',
        'retro-red': '#c9564c',
        'retro-green': '#5d8a66',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', "Liberation Mono", "Courier New", 'monospace'],
      }
    },
  },
  plugins: [],
}