FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY . .
ENV VITE_API_URL=https://tiempolibre-api-612959916526.us-central1.run.app
RUN npx vite build --config vite.config.ts

FROM node:22-alpine
RUN npm install -g serve
WORKDIR /app
COPY --from=builder /app/dist/public ./public
COPY serve.json ./serve.json
EXPOSE 8080
CMD ["serve", "public", "-l", "8080", "--single"]