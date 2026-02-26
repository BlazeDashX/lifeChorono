import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand:      { DEFAULT: '#7C3AED', light: '#EDE9FE', dark: '#4C1D95' },
        productive: '#10B981',
        leisure:    '#F59E0B',
        restoration:'#06B6D4',
        neutral:    '#64748B',
        surface:    '#13131A',
        bg:         '#0A0A0F',
      },
    }
  },
  plugins: [],
};
export default config;