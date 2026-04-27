# Etapa 1: Construcción
FROM node:20 AS builder
RUN npm install -g pnpm@9
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm run build

# Etapa 2: Servidor Nginx (Producción)
FROM nginx:alpine
# Copiamos la carpeta dist generada por Vite
COPY --from=builder /app/dist /usr/share/nginx/html
# Configuramos el puerto 8080 que es el que Google exige
RUN sed -i 's/80/8080/g' /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
