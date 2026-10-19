/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand colours from CSS variables; the rgb(var / <alpha-value>) form keeps
        // opacity modifiers such as bg-haverom-green/20 working.
        'haverom-forest': 'rgb(var(--haverom-forest-rgb) / <alpha-value>)',
        'haverom-green': 'rgb(var(--haverom-green-rgb) / <alpha-value>)',
        'haverom-light-green': 'rgb(var(--haverom-light-green-rgb) / <alpha-value>)',
        'haverom-mint': 'rgb(var(--haverom-mint-rgb) / <alpha-value>)',
        'text-primary': '#F4F8FC',
        'text-secondary': '#AFC3D8',
        success: '#2BD576',
        warning: '#FFB020',
        danger: '#FF5C5C'
      },
      fontFamily: {
        sans: ['"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
