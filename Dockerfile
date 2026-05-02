FROM node:22-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY lib/ ./lib/
COPY artifacts/delivery-saas/ ./artifacts/delivery-saas/
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter "@workspace/api-zod" build || true
RUN pnpm --filter "@workspace/api-client-react" build || true
WORKDIR /workspace/artifacts/delivery-saas
ENV VITE_API_URL=https://tiempolibre-api-612959916526.us-central1.run.app
ENV NODE_ENV=production
RUN npx vite build --config vite.config.ts
FROM node:22-alpine
RUN npm install -g serve
WORKDIR /app
COPY --from=builder /workspace/artifacts/delivery-saas/dist/public ./public
COPY --from=builder /workspace/artifacts/delivery-saas/serve.json ./serve.json
EXPOSE 8080
CMD ["serve", "public", "-l", "8080", "--single"]