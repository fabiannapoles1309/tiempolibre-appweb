FROM node:20-slim
RUN npm install -g pnpm@9
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm run build
EXPOSE 8080
CMD ["pnpm", "run", "start"]
