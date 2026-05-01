FROM node:22-alpine
WORKDIR /app
RUN npm install -g serve
COPY artifacts/delivery-saas/dist/public/ ./public/
ENV PORT=8080
EXPOSE 8080
CMD ["serve", "-s", "public", "-l", "8080"]