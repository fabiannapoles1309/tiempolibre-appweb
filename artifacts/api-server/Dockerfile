FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

RUN pnpm install --frozen-lockfile
RUN cd artifacts/api-server && node ./build.mjs

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/artifacts/api-server/dist/ ./dist/
COPY artifacts/api-server/zonas.kml ./zonas.kml
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]