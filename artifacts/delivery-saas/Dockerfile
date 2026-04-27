FROM node:20-alpine AS builder
WORKDIR /workspace
RUN npm install -g pnpm
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/delivery-saas/package.json ./artifacts/delivery-saas/
COPY lib/api-client-react/package.json ./lib/api-client-react/
RUN pnpm install --filter "@workspace/delivery-saas..." --no-frozen-lockfile
RUN pnpm add -w @rollup/rollup-linux-x64-musl
COPY . .
RUN pnpm --filter "@workspace/delivery-saas" run build

FROM nginx:alpine
COPY --from=builder /workspace/artifacts/delivery-saas/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
