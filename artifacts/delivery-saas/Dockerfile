# ── CUARTO 1: Construir la app ──────────────────────
FROM node:20-alpine AS builder

WORKDIR /workspace

# Instala pnpm
RUN npm install -g pnpm

# Copia archivos de configuración raíz
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copia los package.json de cada sub-paquete
COPY artifacts/api-server/package.json     ./artifacts/api-server/
COPY artifacts/delivery-saas/package.json  ./artifacts/delivery-saas/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib/api-client-react/package.json     ./lib/api-client-react/
COPY lib/api-spec/package.json             ./lib/api-spec/
COPY lib/api-zod/package.json              ./lib/api-zod/
COPY lib/db/package.json                   ./lib/db/
COPY scripts/package.json                  ./scripts/

# Instala dependencias incluyendo opcionales para Linux
RUN pnpm install --filter "@workspace/delivery-saas..." --no-frozen-lockfile
RUN pnpm add -w @rollup/rollup-linux-x64-musl

# Copia el resto del código
COPY . .

# Build
RUN pnpm --filter "@workspace/delivery-saas" run build

# ── CUARTO 2: Servir la app ─────────────────────────
FROM nginx:alpine

COPY --from=builder /workspace/artifacts/delivery-saas/dist /usr/share/nginx/html

EXPOSE 8080

RUN sed -i 's/listen       80;/listen       8080;/g' /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]