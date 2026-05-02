FROM nginx:alpine
COPY dist/public/ /usr/share/nginx/html/
RUN printf 'server {\n    listen 8080;\n    root /usr/share/nginx/html;\n    index index.html;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {\n        expires max;\n    }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
