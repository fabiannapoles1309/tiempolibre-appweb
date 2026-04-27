# ── CUARTO 1: Construir la app ──────────────────────

# Usa una imagen de Node.js versión 20 (ligera, basada en Alpine Linux)
FROM node:20-alpine AS builder

# Define /app como el directorio de trabajo dentro del contenedor
WORKDIR /app

# Instala pnpm (el gestor de paquetes que usa tu proyecto)
RUN npm install -g pnpm

# Copia solo los archivos de dependencias primero
# (esto permite que Docker guarde caché y no reinstale todo cada vez)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Instala todas las dependencias del proyecto
RUN pnpm install --frozen-lockfile

# Ahora copia el resto del código fuente
COPY . .

# Ejecuta el build: convierte tu React en archivos estáticos en dist/
RUN pnpm build


# ── CUARTO 2: Servir la app ─────────────────────────

# Usa nginx ligero para servir los archivos
FROM nginx:alpine

# Copia SOLO la carpeta dist/ del cuarto 1 a nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Abre el puerto 8080 (Cloud Run lo requiere así)
EXPOSE 8080

# Ajusta nginx para escuchar en el puerto 8080 en lugar del 80 por defecto
RUN sed -i 's/listen       80;/listen       8080;/g' /etc/nginx/conf.d/default.conf

# Arranca nginx cuando el contenedor inicie
CMD ["nginx", "-g", "daemon off;"]