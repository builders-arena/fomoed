/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @float/* are TS workspace packages compiled by Next.
  transpilePackages: ['@float/core', '@float/db'],
  // Prisma must stay external to the server bundle.
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', '.prisma/client'],
  },
  webpack: (config) => {
    // Resolve the ESM-style ".js" import specifiers in our TS workspace
    // packages (@float/core etc.) to their ".ts" sources.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
