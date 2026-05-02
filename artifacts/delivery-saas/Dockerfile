FROM nginx:alpine
COPY dist/public/ /usr/share/nginx/html/
RUN printf 'server {\n  listen 8080;\n  location / {\n    root /usr/share/nginx/html;\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 8080
