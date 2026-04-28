# Despliegue en Render

Esta guía describe cómo migrar Rapidoo (TiempoLibre) a [Render](https://render.com)
usando el archivo `render.yaml` (Blueprint) que vive en la raíz del repo.

El despliegue crea tres recursos en Render:

| Recurso | Tipo | Qué es |
|---|---|---|
| `tiempolibre-db` | PostgreSQL gestionado | Base de datos del API |
| `tiempolibre-api` | Web Service (Docker) | Express + Drizzle, escucha en `$PORT` |
| `tiempolibre-web` | Static Site | SPA de Vite servido por el CDN de Render |

> El SPA NO necesita Docker en Render: se compila con Vite y los archivos
> estáticos se sirven desde el CDN. Esto es más rápido, más barato y se
> escala automáticamente.

---

## 1. Requisitos previos

1. Cuenta en [render.com](https://render.com) con método de pago (los planes
   gratuitos sirven para probar; usa `starter` o superior para producción).
2. Repo en GitHub / GitLab / Bitbucket conectado a Render.
3. `pnpm-lock.yaml` actualizado y commiteado en `main`. Render usa
   `--frozen-lockfile`, así que cualquier desincronización rompe el build.

---

## 2. Despliegue inicial vía Blueprint

1. En el Dashboard de Render: **New +** → **Blueprint**.
2. Conecta el repo y selecciona la rama (típicamente `main`).
3. Render detecta `render.yaml` y muestra los tres recursos a crear.
4. Confirma. Render ejecuta en orden:
   - Aprovisiona la base de datos `tiempolibre-db`.
   - Construye y despliega `tiempolibre-api` (Docker build con `artifacts/api-server/Dockerfile`).
   - Construye y despliega `tiempolibre-web` (static build con Vite).

> El primer deploy del API puede fallar porque `CORS_ORIGIN` aún no está
> configurado (y el API hace fail-fast en producción si falta). Es esperado.
> Continúa con el paso 3.

---

## 3. Configurar las variables cruzadas (post-deploy)

Como Render asigna las URLs públicas hasta que crea los servicios, hay dos
variables que el `render.yaml` deja marcadas con `sync: false` para que las
ingreses tú una vez tengas los hostnames:

### 3.1 `CORS_ORIGIN` en el API

1. En el dashboard de Render, abre el servicio **tiempolibre-web**.
2. Copia su URL pública (ejemplo: `https://tiempolibre-web.onrender.com`).
3. Abre **tiempolibre-api** → **Environment**.
4. Edita `CORS_ORIGIN` y pégala (sin `/` final). Si vas a tener varios
   frontends (custom domain + .onrender.com), sepáralos con coma:

   ```
   https://tiempolibre-web.onrender.com,https://app.tudominio.com
   ```

5. Guarda. Render reinicia el servicio automáticamente.

### 3.2 `VITE_API_BASE_URL` en el SPA

1. En el dashboard, abre **tiempolibre-api** y copia su URL pública
   (ejemplo: `https://tiempolibre-api.onrender.com`).
2. Abre **tiempolibre-web** → **Environment**.
3. Edita `VITE_API_BASE_URL` y pégala (sin `/` final).
4. Guarda y dispara **Manual Deploy** → **Deploy latest commit** (Vite
   rebake del bundle es necesario porque la URL se inlinea en build time).

---

## 4. Migraciones de Drizzle

Cuando hagas cambios al esquema en `lib/db/src/schema/*.ts`:

```bash
pnpm -w db:push          # local — confirma el plan
pnpm -w db:push --force  # local — aplica
```

Para correr migraciones contra la BD de Render desde tu máquina:

1. En el dashboard de **tiempolibre-db** copia la **External Database URL**.
2. `DATABASE_URL="postgres://..." pnpm -w db:push --force`

> Alternativa: agrega un `preDeployCommand: pnpm -w db:push --force` al
> servicio API en `render.yaml` para que Render aplique el esquema antes de
> cada deploy. Quitado por defecto para evitar sorpresas en producción.

---

## 5. Custom domains (opcional)

1. En el servicio (api o web) → **Settings** → **Custom Domains**.
2. Agrega `api.tudominio.com` y `app.tudominio.com`.
3. Render te da los registros DNS (CNAME para subdominios).
4. Render emite y renueva el certificado TLS automáticamente.
5. **Importante:** después de mapear el dominio del SPA, actualiza
   `CORS_ORIGIN` en el API para incluir el nuevo dominio (puedes mantener
   ambos: `.onrender.com` + el custom).

---

## 6. Diferencias clave vs el dev local

| Aspecto | Local (Replit) | Producción (Render) |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| Cookies | `SameSite=Lax`, `Secure=false` | `SameSite=None`, `Secure=true` |
| `CORS_ORIGIN` | sin definir → reflect-origin | obligatorio, fail-fast si falta |
| Origen del SPA | mismo host que el API (proxy) | hostname distinto al API |
| Base de datos | DB de Replit | `tiempolibre-db` en Render |

---

## 7. Troubleshooting

**El API arranca pero todos los POST devuelven 403 "Origen no permitido".**
El guard CSRF rechazó el origen. Verifica que `CORS_ORIGIN` incluya
exactamente la URL pública del SPA (sin barra final, con el `https://`).

**El SPA carga pero todas las llamadas al API tiran CORS error.**
`VITE_API_BASE_URL` no está bakeado en el bundle. Confirma que la variable
está seteada en el servicio web y dispara un Manual Deploy del SPA.

**El healthcheck del API falla con timeout.**
Render pega a `/healthz` durante el arranque. Si el contenedor tarda más de
~3 minutos en responder OK, marca el deploy como failed. Revisa los logs
del API por errores al conectar a Postgres (`DATABASE_URL` mal formado, IP
allowlist bloqueando, etc.).

**`pnpm install --frozen-lockfile` falla en Render.**
El lockfile no está sincronizado. Localmente: `pnpm install` desde la raíz,
commitea el `pnpm-lock.yaml` actualizado y vuelve a desplegar.
