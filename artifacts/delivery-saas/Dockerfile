FROM nginx:alpine
# Copiamos la carpeta dist que generaste en Replit
COPY dist /usr/share/nginx/html
# Configuramos el puerto para Google Cloud
RUN sed -i 's/80/8080/g' /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
