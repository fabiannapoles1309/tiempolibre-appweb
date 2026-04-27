FROM node:20 AS builder
RUN npm install -g pnpm@9
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
RUN sed -i 's/80/8080/g' /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
