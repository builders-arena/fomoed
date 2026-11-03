# Fly.io image for the Fomoed fee-distribution bots (standalone runner).
FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app
COPY . .

# Install all workspace deps (devDeps included — the bot runs via tsx).
RUN pnpm install --frozen-lockfile --prod=false
# Generate the Prisma client for this (linux) runtime.
RUN pnpm --filter @float/db exec prisma generate

# No public ports — this is a worker. The admin API binds internally only.
CMD ["pnpm", "--filter", "@float/bots", "standalone"]
