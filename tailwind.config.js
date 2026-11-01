module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: '#a3e635',
        panel: '#10171d',
        panelAlt: '#171f27',
        border: '#24313d',
        bg: '#0c1116'
      },
      boxShadow: {
        soft: '0 24px 80px -32px rgba(163, 230, 53, 0.28)'
      }
    }
  },
  plugins: []
};
