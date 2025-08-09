/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#0B0D10',
        ink: '#14161B',
        electric: '#00E8D1',
        gold: '#FFD66B',
      },
      borderRadius: {
        card: '18px',
        button: '12px',
      },
      boxShadow: {
        cardShadow: '0px 4px 16px -4px rgba(0,0,0,0.45)',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '20px',
        xl: '32px',
      },
    },
  },
  plugins: [],
};
