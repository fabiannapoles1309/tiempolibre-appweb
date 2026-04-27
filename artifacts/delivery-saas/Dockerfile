FROM node:20-alpine AS builder

WORKDIR /workspace

RUN npm install -g pnpm

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

RUN pnpm install --filter "@workspace/delivery-saas..." --no-frozen-lockfile

# Copia TODO el código fuente incluyendo los paquetes internos
COPY lib/ ./lib/
COPY artifacts/delivery-saas/ ./artifacts/delivery-saas/

RUN pnpm --filter "@workspace/delivery-saas" run build

FROM nginx:alpine
COPY --from=builder /workspace/artifacts/delivery-saas/dist /usr/share/nginx/html
EXPOSE 8080
RUN sed -i 's/listen       80;/listen       8080;/g' /etc/nginx/conf.d/default.conf
CMD ["nginx", "-g", "daemon off;"]