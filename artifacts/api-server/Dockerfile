FROM node:22-alpine
WORKDIR /app
COPY dist/ ./dist/
COPY artifacts/api-server/zonas.kml ./zonas.kml
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]