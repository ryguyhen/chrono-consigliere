/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        serif: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'monospace'],
      },
      colors: {
        cream: '#111111',
        parchment: '#191919',
        ink: {
          DEFAULT: '#F0F0F0',
          2: '#C8C8C8',
        },
        muted: '#787878',
        gold: {
          DEFAULT: '#F5C518',
          dark: '#C9A020',
          pale: 'rgba(245,197,24,0.10)',
        },
        surface: '#1C1C1C',
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '1.4', letterSpacing: '0.06em' }],
        xs: ['11px', { lineHeight: '1.5' }],
        sm: ['13px', { lineHeight: '1.5' }],
        base: ['15px', { lineHeight: '1.6' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        DEFAULT: '3px',
      },
    },
  },
  plugins: [],
};
