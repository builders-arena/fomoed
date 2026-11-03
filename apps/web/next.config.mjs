import { PrismaPlugin } from '@prisma/nextjs-monorepo-workaround-plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @float/* are TS workspace packages compiled by Next.
  transpilePackages: ['@float/core', '@float/db', '@float/indexer'],
  // Prisma must stay external to the server bundle.
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', '.prisma/client'],
    // Trace from the monorepo root so the Prisma query engine in the hoisted
    // pnpm store is bundled into the serverless function.
    outputFileTracingRoot: path.join(dir, '../../'),
  },
  webpack: (config, { isServer }) => {
    // Resolve the ESM-style ".js" import specifiers in our TS workspace
    // packages (@float/core etc.) to their ".ts" sources.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    // Copy the Prisma query engine next to the serverless bundle (pnpm monorepo).
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }
    return config;
  },
};

export default nextConfig;
