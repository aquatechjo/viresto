import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { cairo: ['Cairo', 'sans-serif'] },
      colors: {
        sidebar: { dark: '#1e3329', mid: '#2d4a3e', light: '#3a5c4e' },
        gold: { DEFAULT: '#f5c842', soft: '#fdf3c5' },
        surface: { DEFAULT: '#eef0eb', card: '#ffffff', input: '#f5f6f3' },
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
