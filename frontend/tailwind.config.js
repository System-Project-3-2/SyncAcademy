/** @type {import('tailwindcss').Config} */
const config = {
  // Enable dark mode with class strategy for manual toggle
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dynamic theme colors that can be customized
        theme: {
          // Light mode colors
          light: {
            bg: '#f8fafc',
            'bg-secondary': '#ffffff',
            surface: '#ffffff',
            text: '#0f172a',
            'text-secondary': '#475569',
            border: '#e2e8f0',
          },
          // Dark mode colors
          dark: {
            bg: '#0f172a',
            'bg-secondary': '#1e293b',
            surface: '#1e293b',
            text: '#f8fafc',
            'text-secondary': '#94a3b8',
            border: '#334155',
          },
        },
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // Theme transition animation
      transitionProperty: {
        'theme': 'background-color, border-color, color, fill, stroke, box-shadow',
      },
      transitionDuration: {
        'theme': '300ms',
      },
      transitionTimingFunction: {
        'theme': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      // Animation for theme toggle
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'theme-toggle': 'themeToggle 0.3s ease-in-out',
      },
      keyframes: {
        themeToggle: {
          '0%': { transform: 'scale(0.8) rotate(-30deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
