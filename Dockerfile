# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Graph Resolver backend (NestJS + Prisma 7).
#
# Two build targets used by infra/docker:
#   target: development  → `nest start --watch` with the source mounted in;
#                          Prisma client is generated into src/generated/prisma
#   target: production   → compiled output (dist/) run as the `node` user
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS base
ENV NODE_ENV=development
# Prisma's engines detect the OpenSSL version at build/CLI time; bookworm-slim's
# minimal openssl confuses the detection ("Failed to detect libssl/openssl"),
# so install the full package up front.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Dependencies (shared by every target) ────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Development image (compose.dev.yml) ───────────────────────────────────────
# Source is bind-mounted at runtime; node_modules stays in the image (Compose
# pins /app/node_modules with a named volume).
FROM deps AS development
# prisma.config.ts reads `env('DATABASE_URL')`, so the CLI needs *some* value
# to load the config. `prisma generate` never connects to this URL; Compose
# overrides it with the real value at runtime.
ENV DATABASE_URL=postgresql://prisma:prisma@postgres:5432/prisma?schema=public
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY . .
# Prisma 7 (schema at ./prisma/schema via prisma.config.ts) — generate copies
# the client into src/generated/prisma, then nest's swc builder compiles it.
# Regenerating here must happen AFTER COPY . . so the container's artifacts
# overwrite any host-generated ones.
RUN npx prisma generate
EXPOSE 3000
# Regenerate on start (schema-safe; NOT a migration) then hot-reload.
CMD ["sh", "-c", "npx prisma generate && npm run start:dev"]

# ── Production build ─────────────────────────────────────────────────────────
FROM deps AS build
ENV DATABASE_URL=postgresql://prisma:prisma@postgres:5432/prisma?schema=public
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Run as an unprivileged user (the `node` user exists in node:*-slim images).
USER node
EXPOSE 3000
CMD ["node", "dist/main"]