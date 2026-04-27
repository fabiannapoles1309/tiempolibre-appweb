# syntax=docker/dockerfile:1.7

# =============================================================================
# Builder: install workspace deps, run esbuild, output a single bundled file.
# =============================================================================
FROM node:22-alpine AS builder

# pnpm 10 to match the lockfile (lockfileVersion 9.0).
RUN apk add --no-cache libc6-compat \
 && npm install -g pnpm@10.26.1

WORKDIR /workspace

# 1) Copy the workspace skeleton FIRST so Docker can cache the install layer.
#    pnpm needs every package.json that the lockfile references — even ones
#    we are not building — otherwise --frozen-lockfile fails.
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./
COPY artifacts/api-server/package.json     ./artifacts/api-server/
COPY artifacts/delivery-saas/package.json  ./artifacts/delivery-saas/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib/api-client-react/package.json     ./lib/api-client-react/
COPY lib/api-spec/package.json             ./lib/api-spec/
COPY lib/api-zod/package.json              ./lib/api-zod/
COPY lib/db/package.json                   ./lib/db/
COPY scripts/package.json                  ./scripts/

# 2) Install only what api-server (and its workspace deps) need.
RUN pnpm install --frozen-lockfile --filter "@workspace/api-server..."

# 3) Copy the actual source for api-server and its workspace deps.
COPY lib/db              ./lib/db
COPY lib/api-zod         ./lib/api-zod
COPY artifacts/api-server ./artifacts/api-server

# 4) Bundle the server with esbuild (single dist/index.mjs + workers).
RUN pnpm --filter @workspace/api-server run build

# =============================================================================
# Runtime: tiny image with just node + the bundled output.
# =============================================================================
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    LOG_LEVEL=info

# esbuild bundled every npm dependency, so we only need the dist directory.
COPY --from=builder /workspace/artifacts/api-server/dist ./dist

# Non-root user for safety.
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
