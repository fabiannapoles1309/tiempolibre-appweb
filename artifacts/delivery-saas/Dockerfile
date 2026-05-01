FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm
RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib/ ./lib/
COPY artifacts/delivery-saas/ ./artifacts/delivery-saas/

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ENV BASE_PATH=/
ENV PORT=8080

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm install --frozen-lockfile
RUN cd artifacts/delivery-saas && pnpm run build

FROM node:22-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/artifacts/delivery-saas/dist/public/ ./public/
ENV PORT=8080
EXPOSE 8080
CMD ["serve", "-s", "public", "-l", "8080"]