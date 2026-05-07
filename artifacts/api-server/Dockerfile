FROM node:22-alpine
WORKDIR /app

# Instalar dependencias
COPY package.json ./
RUN npm install

# Copiar código fuente y compilar
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
