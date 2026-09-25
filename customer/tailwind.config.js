/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      xs: '390px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1440px',
      '3xl': '1920px',
    },
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B0B0C',
          950: '#060607',
          900: '#0B0B0C',
          800: '#151517',
          700: '#222225',
          600: '#34343A',
          500: '#55555D',
        },
        paper: {
          DEFAULT: '#F5F4F0',
          50: '#FBFAF8',
          100: '#F5F4F0',
          200: '#EBE9E3',
          300: '#DAD7CE',
        },
        accent: {
          DEFAULT: '#FF4B12',
          light: '#FF6A3A',
          dark: '#C73A0A',
          50: '#FFF1EB',
        },
        /** WOLF brand gold (logo artwork). */
        gold: { DEFAULT: '#C9A14A', light: '#E4C98A', dark: '#8F6E28', 50: '#FBF6EA' },
        success: { DEFAULT: '#0E7C47', 50: '#E8F5EE' },
        warning: { DEFAULT: '#A15C00', 50: '#FFF6E5' },
        danger: { DEFAULT: '#C8102E', 50: '#FDECEF' },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'Impact', 'Arial Narrow', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        'display-sm': ['2.25rem', { lineHeight: '0.95', letterSpacing: '-0.01em' }],
        'display-md': ['3rem', { lineHeight: '0.92', letterSpacing: '-0.015em' }],
        'display-lg': ['4.5rem', { lineHeight: '0.88', letterSpacing: '-0.02em' }],
        'display-xl': ['6.5rem', { lineHeight: '0.85', letterSpacing: '-0.025em' }],
        'display-2xl': ['9rem', { lineHeight: '0.82', letterSpacing: '-0.03em' }],
      },
      letterSpacing: {
        label: '0.14em',
      },
      borderRadius: {
        xs: '2px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,11,12,0.04), 0 8px 24px -12px rgba(11,11,12,0.12)',
        lift: '0 2px 4px rgba(11,11,12,0.04), 0 18px 40px -16px rgba(11,11,12,0.25)',
        drawer: '-24px 0 60px -20px rgba(11,11,12,0.35)',
        focus: '0 0 0 3px rgba(255,75,18,0.35)',
      },
      maxWidth: {
        site: '1600px',
        prose: '68ch',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'slide-down': { from: { transform: 'translateY(-100%)' }, to: { transform: 'translateY(0)' } },
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'heart-pop': {
          '0%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.35)' },
          '60%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        'badge-bump': {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.4)' },
          '100%': { transform: 'scale(1)' },
        },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        progress: { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out both',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-right': 'slide-in-right 0.42s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-left': 'slide-in-left 0.42s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-down': 'slide-down 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        'heart-pop': 'heart-pop 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
        'badge-bump': 'badge-bump 0.4s ease-out',
        marquee: 'marquee 40s linear infinite',
        'toast-in': 'toast-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
