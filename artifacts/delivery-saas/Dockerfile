FROM nginx:alpine
COPY dist/public/ /usr/share/nginx/html/
RUN echo "server { listen 8080; root /usr/share/nginx/html; index index.html; location / { try_files \$uri \$uri/ /index.html; } }" > /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
