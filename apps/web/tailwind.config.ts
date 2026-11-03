import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces (Meteora dark)
        bg: '#0D0D13',
        surface: '#12121C',
        surface2: '#181825',
        elevated: '#202031',
        surface3: '#262636',
        // Borders
        border: '#202031',
        borderStrong: '#2A2A3C',
        // Text
        ink: '#F9F9FB',
        muted: '#9595B2',
        faint: '#6C6C89',
        // Brand — Meteora orange primary, violet secondary, gold accent
        primary: '#F54B00',
        primaryLight: '#F76727',
        violet: '#6E45FF',
        violetLight: '#9E83FF',
        gold: '#F5BD00',
        // Semantics
        up: '#24C98D',
        down: '#FF6B6B',
        warn: '#F5BD00',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '0.875rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(245,75,0,0.18), 0 10px 44px -12px rgba(245,75,0,0.3)',
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 32px -16px rgba(0,0,0,0.6)',
        dock: '0 8px 40px -8px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05)',
      },
      backgroundImage: {
        brand: 'linear-gradient(90deg, #6E45FF 0%, #F54B00 55%, #F76727 100%)',
        'brand-soft':
          'linear-gradient(135deg, rgba(245,75,0,0.14) 0%, rgba(110,69,255,0.14) 100%)',
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
