import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { cairo: ['Cairo', 'sans-serif'] },
      colors: {
        // Derived from the CSS custom properties in globals.css (single
        // source of truth) rather than duplicated literals. Neither token
        // is currently consumed as a Tailwind utility class anywhere in the
        // app, so this is a zero-risk alignment, not a behavior change.
        sidebar: { dark: 'var(--sidebar-dark)', mid: 'var(--sidebar)', light: 'var(--sidebar-hover)' },
        gold: { DEFAULT: 'var(--brand-copper)', soft: 'var(--brand-copper-soft)' },
        copper: {
          50: '#fbf5ef',
          100: '#f7e9dc',
          200: '#edcfb2',
          300: '#dfb184',
          400: '#cc8e55',
          500: '#b87333',
          600: '#9c5f2b',
          700: '#7d4925',
          800: '#653d24',
          900: '#533420',
          950: '#2d1a0f',
        },
        emerald: {
          50: '#eff9f7',
          100: '#d8f0ec',
          200: '#b5dfda',
          300: '#86c7c1',
          400: '#53a8a4',
          500: '#358a88',
          600: '#266f6e',
          700: '#205958',
          800: '#1b4848',
          900: '#163c3d',
          950: '#082526',
        },
        green: {
          50: '#eff9f7',
          100: '#d8f0ec',
          200: '#b5dfda',
          300: '#86c7c1',
          400: '#53a8a4',
          500: '#358a88',
          600: '#266f6e',
          700: '#205958',
          800: '#1b4848',
          900: '#163c3d',
          950: '#082526',
        },
        surface: { DEFAULT: '#f2f5f3', card: '#ffffff', input: '#f3f7f6' },
      },
      animation: {
        'fade-in':   'fadeIn .2s ease forwards',
        'slide-in':  'slideIn .25s ease forwards',
        'slide-up':  'slideUp .3s ease forwards',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0', transform: 'translateY(6px)' },   to: { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(16px)' },  to: { opacity: '1', transform: 'translateX(0)' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' },  to: { opacity: '1', transform: 'translateY(0)' } },
      }
    }
  },
  plugins: []
}
export default config
