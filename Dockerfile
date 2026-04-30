FROM node:20 AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY artifacts/ ./artifacts/
COPY lib/ ./lib/
RUN pnpm install --no-frozen-lockfile --ignore-scripts
ENV PORT=8080
ENV BASE_PATH=/
ENV VITE_API_URL=https://tiempolibre-api-612959916526.us-central1.run.app
RUN pnpm --filter @workspace/delivery-saas build

FROM nginx:stable-alpine
COPY --from=builder /app/artifacts/delivery-saas/dist/public /usr/share/nginx/html
RUN printf 'server {\n  listen 8080;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]