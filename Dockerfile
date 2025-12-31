# Build stage
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api ./apps/api
COPY packages ./packages

# Generate Prisma client and build
RUN pnpm --filter @clair/api db:generate
RUN pnpm --filter @clair/api build

# Production stage
FROM node:20-alpine AS runner

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

# Copy everything needed from builder (simpler and more reliable for pnpm monorepo)
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/index.js"]
