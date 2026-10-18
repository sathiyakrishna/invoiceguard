import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    // defaults plus `wide` (1440px), kept in ascending order so min-width variants cascade correctly
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', wide: '1440px', '2xl': '1536px' },
    extend: {
      colors: {
        navy: { DEFAULT: '#14213D', 700: '#1B2B4F', 600: '#22325A', 500: '#2E3F66' },
        ink: { DEFAULT: '#141A26', 700: '#2F3846', 500: '#4B5565' },
        line: { DEFAULT: '#E2E5EA', soft: '#EEF0F3', input: '#CBD2DC' },
        ground: '#F3F4F6',
        accent: { DEFAULT: '#1D4ED8', dark: '#1E3A8A', soft: '#DBEAFE', text: '#1E40AF' },
        high: { bg: '#FDE2E1', fg: '#B42318', row: '#FEF3F2' },
        med: { bg: '#FEF0C7', fg: '#93370D' },
        low: { bg: '#DCFAE6', fg: '#067647' },
        sky: { 300: '#7DA2FF' }
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        landing: ['Barlow', 'system-ui', 'sans-serif'], // public landing page only
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: [
    // `rail:` applies when the sidebar is the 64px icon rail (768px and up): the user collapsed it
    // (<html data-sb="rail">, set before first paint), or has not chosen yet and the screen is under 1280px.
    plugin(({ addVariant }) => {
      addVariant('rail', [
        '@media (min-width: 768px) { html[data-sb="rail"] & }',
        '@media (min-width: 768px) and (max-width: 1279px) { html:not([data-sb]) & }'
      ]);
    })
  ]
};
export default config;
