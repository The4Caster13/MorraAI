import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        theme: {
          identites: '#7c3aed',
          experiences: '#0891b2',
          ingeniosite: '#ea580c',
          organisation: '#16a34a',
          planete: '#0d9488',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
