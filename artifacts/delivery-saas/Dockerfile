# Usamos una imagen ligera de Node
FROM node:20-slim

# Instalamos pnpm
RUN npm install -g pnpm@9

# Directorio de trabajo
WORKDIR /app

# Copiamos los archivos del proyecto
COPY . .

# Instalamos dependencias y construimos la app
RUN pnpm install --no-frozen-lockfile
RUN pnpm run build

# Exponemos el puerto que pide Google Cloud
EXPOSE 8080

# Comando para arrancar la app en modo preview/producción
CMD ["pnpm", "run", "start"]
