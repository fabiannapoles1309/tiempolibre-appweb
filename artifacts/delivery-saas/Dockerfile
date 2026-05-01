FROM nginx:alpine
COPY dist/public/ /usr/share/nginx/html/
RUN echo 'server { listen 8080; location / { root /usr/share/nginx/html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 8080