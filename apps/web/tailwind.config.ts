import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0a1628',
          light: '#132038',
          muted: '#1e2d4a',
          deep: '#070f1e',
        },
        brand: {
          DEFAULT: '#1b4fd8',
          light: '#2563eb',
          bright: '#3b82f6',
          pale: '#dbeafe',
        },
        offwhite: '#f8faff',
        theme: {
          identites: '#1b4fd8',
          experiences: '#0ea5e9',
          ingeniosite: '#7c3aed',
          organisation: '#059669',
          planete: '#16a34a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
