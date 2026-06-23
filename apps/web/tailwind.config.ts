import type { Config } from 'tailwindcss';

/**
 * Tailwind config para apps/web.
 *
 * Sprint 1: escopo minimo - sem design system elaborado. Cores base
 * (slate, blue) para nao brigar com a estetica desktop-first planejada.
 *
 * Conteudo vem de globals.css via @tailwind directives.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
