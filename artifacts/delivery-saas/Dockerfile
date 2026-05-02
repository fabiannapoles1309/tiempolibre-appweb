FROM node:22-alpine
RUN npm install -g serve
WORKDIR /app
COPY dist/public/ ./public/
COPY serve.json ./serve.json
EXPOSE 8080
CMD ["serve", "public", "-l", "8080", "--config", "serve.json"]
