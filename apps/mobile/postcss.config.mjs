// Compiles Tailwind for the editor DOM component. Uniwind compiles the app's own CSS.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
    "./inline-fonts-postcss-plugin.js": {},
  },
};
