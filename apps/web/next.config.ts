import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@platform/types', '@platform/ai', '@platform/enrichment', '@platform/research'],
  serverExternalPackages: ['@anthropic-ai/sdk'],
};

export default config;
