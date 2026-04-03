import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['Pretendard', 'monospace'],
      },
      colors: {
        brand: {
          wood: '#2c1810',
          'wood-light': '#3d2a1e',
          koji: '#c49a3c',
          'koji-light': '#d4b060',
          'koji-muted': '#a8853a',
          rice: '#f7f3ed',
          'rice-dark': '#ede5d8',
          ceramic: '#6b5e53',
          'ceramic-light': '#8a7d72',
          clay: '#b5452a',
          'clay-light': '#d4654a',
        },
        surface: {
          primary: '#f7f3ed',
          secondary: '#ede5d8',
          card: '#faf8f4',
          dark: '#2c1810',
          'dark-hover': '#3d2a1e',
        },
        ink: {
          primary: '#2c1810',
          secondary: '#6b5e53',
          muted: '#8a7d72',
          inverse: '#f7f3ed',
        },
        accent: {
          receipt: '#2d6a4f',
          usage: '#b5452a',
          balance: '#2c1810',
        },
      },
    },
  },
  plugins: [],
};
export default config;
