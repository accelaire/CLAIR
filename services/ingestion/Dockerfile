# Build stage
FROM node:20-alpine AS builder

# Install OpenSSL for Prisma client generation
RUN apk add --no-cache openssl

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy package files from monorepo root
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY services/ingestion/package.json ./services/ingestion/
COPY packages/shared/package.json ./packages/shared/ 2>/dev/null || true
COPY packages/config/package.json ./packages/config/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api/prisma ./apps/api/prisma
COPY services/ingestion ./services/ingestion
COPY packages ./packages

# Generate Prisma client
RUN pnpm --filter @clair/api db:generate

# Build ingestion service
RUN pnpm --filter @clair/ingestion build

# Production stage
FROM node:20-alpine AS runner

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Europe/Paris

# Copy from builder
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/ingestion/dist ./services/ingestion/dist
COPY --from=builder /app/services/ingestion/package.json ./services/ingestion/
COPY --from=builder /app/services/ingestion/node_modules ./services/ingestion/node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma

WORKDIR /app/services/ingestion

CMD ["node", "--max-old-space-size=2048", "dist/cli.js", "schedule"]
