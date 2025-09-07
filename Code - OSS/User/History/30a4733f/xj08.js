// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",    // Or "./*.html" if you might have more HTML files
    "./js/**/*.js",    // To scan JS files for dynamically added classes
  ],
  theme: {
    extend: {
      colors: {
        'dracula-bg': '#282a36',
        'dracula-current-line': '#44475a', // Good for card backgrounds
        'dracula-selection': '#44475a',    // Often same as current-line
        'dracula-fg': '#f8f8f2',          // Main text color
        'dracula-comment': '#6272a4',    // Subtle borders, secondary text
        'dracula-cyan': '#8be9fd',
        'dracula-green': '#50fa7b',
        'dracula-orange': '#ffb86c',
        'dracula-pink': '#ff79c6',
        'dracula-purple': '#bd93f9',      // Good for primary actions
        'dracula-red': '#ff5555',
        'dracula-yellow': '#f1fa8c',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', '"Noto Color Emoji"'],
      }
    },
  },
  plugins: [],
}