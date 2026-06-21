import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@controle-credito/contracts', '@controle-credito/ui'],
  experimental: {
    // monorepo path alias
  },
};

export default config;
