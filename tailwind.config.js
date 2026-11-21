/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      colors: {
        canvas: '#F6F5F1',
        ink: '#18221F',
        muted: '#64706B',
        line: '#E6E4DD'
      },
      boxShadow: {
        card: '0 2px 10px -2px rgba(24, 34, 31, 0.04), 0 1px 3px rgba(24, 34, 31, 0.03)',
        float: '0 14px 34px -6px rgba(24, 34, 31, 0.14), 0 4px 12px -2px rgba(24, 34, 31, 0.06)',
        fab: '0 12px 26px -4px rgba(15, 118, 110, 0.38), 0 4px 10px -2px rgba(15, 118, 110, 0.22)'
      }
    }
  },
  plugins: []
};
