FROM node:20

# Instalamos pnpm de forma global
RUN npm install -g pnpm@9

WORKDIR /app

# Copiamos archivos de configuración primero
COPY package.json pnpm-lock.yaml* ./

# Instalamos todas las dependencias
RUN pnpm install --no-frozen-lockfile

# Copiamos el resto del código
COPY . .

# Construimos la aplicación de Tiempo Libre
RUN pnpm run build

# Puerto oficial de Google Cloud
EXPOSE 8080

# Comando de encendido
CMD ["pnpm", "run", "start"]
