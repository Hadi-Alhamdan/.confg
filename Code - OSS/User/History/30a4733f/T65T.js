/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",         // Scan index.html
    "./js/**/*.js",         // Scan all .js files in the js folder and its subfolders
                            // This is useful if you add/remove classes with JavaScript
  ],
  theme: {
    extend: {
      // Here you will later add the Dracula color palette
    },
  },
  plugins: [],
}