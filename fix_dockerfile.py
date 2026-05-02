with open("artifacts/delivery-saas/Dockerfile", "w", newline="\n") as f:
    f.write("FROM nginx:alpine\n")
    f.write("COPY dist/public/ /usr/share/nginx/html/\n")
    f.write("RUN printf 'server {\\n  listen 8080;\\n  location / {\\n    root /usr/share/nginx/html;\\n    try_files $uri $uri/ /index.html;\\n  }\\n}\\n' > /etc/nginx/conf.d/default.conf\n")
    f.write("EXPOSE 8080\n")
print("OK")
