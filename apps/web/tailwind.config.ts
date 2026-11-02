import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0d12',
        panel: '#141821',
        border: '#232a37',
        accent: '#4ade80',
        muted: '#8b93a7',
      },
    },
  },
  plugins: [],
};

export default config;
