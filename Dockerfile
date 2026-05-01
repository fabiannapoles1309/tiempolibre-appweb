FROM node:22-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app
COPY . .
RUN pnpm install
RUN pnpm add -w @rollup/rollup-linux-x64-musl lightningcss-linux-x64-musl @tailwindcss/oxide-linux-x64-musl 2>/dev/null || true
ENV PORT=8080
ENV BASE_PATH=/
RUN pnpm --filter @workspace/delivery-saas build

FROM nginx:alpine
COPY --from=builder /app/artifacts/delivery-saas/dist/public /usr/share/nginx/html
RUN echo 'server { listen 8080; location / { root /usr/share/nginx/html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
