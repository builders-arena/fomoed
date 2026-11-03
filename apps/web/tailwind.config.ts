import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces (deep navy, near-black)
        bg: '#07090F',
        surface: '#0D111A',
        surface2: '#141A26',
        elevated: '#182030',
        border: '#1E2634',
        borderStrong: '#2A3448',
        // Text
        ink: '#F3F5F9',
        muted: '#98A2B3',
        faint: '#5C6677',
        // Brand (Meteora teal-green → violet)
        primary: '#34E5A4',
        primaryDim: '#1FA67A',
        violet: '#7C6BFF',
        // Semantics
        up: '#34E5A4',
        down: '#FF6B6B',
        warn: '#F6A24A',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(52,229,164,0.15), 0 8px 40px -12px rgba(52,229,164,0.25)',
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 32px -16px rgba(0,0,0,0.6)',
        dock: '0 8px 40px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
      },
      backgroundImage: {
        brand: 'linear-gradient(135deg, #34E5A4 0%, #7C6BFF 100%)',
        'brand-soft': 'linear-gradient(135deg, rgba(52,229,164,0.16) 0%, rgba(124,107,255,0.16) 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
