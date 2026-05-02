FROM node:22-alpine
RUN npm install -g serve
WORKDIR /app
COPY dist/public/ ./public/
COPY serve.json ./serve.json
EXPOSE 8080
CMD ["sh", "-c", "serve public --listen tcp://0.0.0.0:${PORT:-8080} --config serve.json"]
