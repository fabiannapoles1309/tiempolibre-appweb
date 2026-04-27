# syntax=docker/dockerfile:1.7

# =============================================================================
# Builder: install workspace deps and run `vite build` for the SPA.
# `VITE_API_BASE_URL` is baked into the bundle at build time — pass it via
#   --build-arg VITE_API_BASE_URL=https://api.example.com
# =============================================================================
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat \
 && npm install -g pnpm@10.26.1

WORKDIR /workspace

# 1) Workspace skeleton (every package.json the lockfile references).
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

# 2) Install deps for the SPA only.
RUN pnpm install --frozen-lockfile --filter "@workspace/delivery-saas..."

# 3) Sources needed for the SPA build.
COPY lib/api-client-react ./lib/api-client-react
COPY lib/api-zod          ./lib/api-zod
COPY artifacts/delivery-saas ./artifacts/delivery-saas

# 4) Bake the API URL into the bundle.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN pnpm --filter @workspace/delivery-saas run build

# =============================================================================
# Runtime: nginx serving the static SPA. Cloud Run injects $PORT.
# =============================================================================
FROM nginx:1.27-alpine AS runtime

# nginx:alpine ships an entrypoint that runs envsubst on every file in
# /etc/nginx/templates/*.template, so we drop the template here and the
# container substitutes ${PORT} on startup.
COPY artifacts/delivery-saas/nginx.conf.template /etc/nginx/templates/default.conf.template

# Static SPA bundle.
COPY --from=builder /workspace/artifacts/delivery-saas/dist /usr/share/nginx/html

ENV PORT=8080
EXPOSE 8080

# nginx:alpine's default CMD already runs nginx in the foreground after
# templating, so we don't override it.
