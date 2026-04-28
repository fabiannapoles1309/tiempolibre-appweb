# Despliegue en Render

Esta guia describe como desplegar Rapidoo (TiempoLibre) en
[Render](https://render.com) usando el archivo `render.yaml` (Blueprint) que
vive en la raiz del repositorio.

Resultado final: tres recursos administrados por Render conectados entre si
sin intervencion manual:

| Recurso             | Tipo          | Que sirve                              |
|---------------------|---------------|----------------------------------------|
| `rapidoo-db`        | PostgreSQL 16 | Base de datos                          |
| `tiempolibre-api`   | Web Service   | API Express bundlada con esbuild       |
| `tiempolibre-web`   | Static Site   | SPA de React + Vite                    |

---

## 1. Preparativos (una sola vez)

1. Sube el repositorio a GitHub, GitLab o Bitbucket. Render despliega desde
   un repo Git, no acepta uploads manuales.
2. Crea una cuenta gratuita en https://render.com y conecta el proveedor Git.
3. (Opcional) Si vas a usar dominio propio, ten listo el DNS donde
   apuntaras `app.tudominio.com` y `api.tudominio.com`.

> No necesitas crear ningun recurso a mano. El Blueprint los provisiona.

---

## 2. Crear los recursos con el Blueprint

1. En el dashboard de Render: **New +** → **Blueprint**.
2. Selecciona el repositorio.
3. Render lee `render.yaml` y muestra los tres recursos que va a crear.
4. Confirma. Render hace lo siguiente automaticamente:
   - Provisiona la base de datos `rapidoo-db`.
   - Construye y arranca `tiempolibre-api`. Inyecta `DATABASE_URL` (cadena
     de conexion de la BD) y genera `SESSION_SECRET` la primera vez.
   - Construye y publica `tiempolibre-web` con `VITE_API_BASE_URL` apuntando
     al hostname de la API.
   - Re-despliega `tiempolibre-api` cuando ya conoce el hostname del SPA
     para asignar `CORS_ORIGIN`.

> El primer build tarda 5-10 minutos (instalacion de pnpm + bundle del SPA).
> Los builds siguientes son mas rapidos por el cache de dependencias.

---

## 3. Aplicar el esquema de BD

Render no ejecuta migraciones automaticamente. Despues del primer despliegue:

```bash
# Desde tu maquina, con la cadena de conexion EXTERNA de rapidoo-db
# (la encuentras en la pagina del recurso → Connect → External Database URL).
DATABASE_URL="postgres://..." pnpm --filter @workspace/db run push
```

Si necesitas precargar usuarios/datos demo, el seed vive en
`artifacts/api-server/src/seed.ts` (no esta expuesto como script en
`package.json`). Puedes ejecutarlo directamente:

```bash
DATABASE_URL="postgres://..." pnpm exec tsx artifacts/api-server/src/seed.ts
```

> En produccion conviene usar la URL **interna** de la BD (la que ya esta en
> `DATABASE_URL` del servicio `tiempolibre-api`) y ejecutar `pnpm push` o el
> seed desde el **Shell** de Render (pestania "Shell" del Web Service
> `tiempolibre-api`) para evitar abrir la BD a Internet.

---

## 4. Variables de entorno

### tiempolibre-api

| Variable          | Origen                    | Descripcion                                        |
|-------------------|---------------------------|----------------------------------------------------|
| `PORT`            | Render                    | Puerto donde escucha Express.                      |
| `NODE_ENV`        | render.yaml               | `production` activa cookies `Secure`/`SameSite=None` y el guardia CSRF. |
| `LOG_LEVEL`       | render.yaml               | Nivel de Pino.                                     |
| `DATABASE_URL`    | `fromDatabase`            | Cadena de PostgreSQL de `rapidoo-db`.              |
| `SESSION_SECRET`  | `generateValue: true`     | Render genera un valor seguro la primera vez.      |
| `CORS_ORIGIN`     | `fromService.host` (web)  | Hostname del SPA. `app.ts` le prepende `https://`. |

### tiempolibre-web

| Variable             | Origen                    | Descripcion                                        |
|----------------------|---------------------------|----------------------------------------------------|
| `VITE_API_BASE_URL`  | `fromService.host` (api)  | Hostname de la API. `main.tsx` le prepende `https://`. |

> **Defensa CSRF**: en produccion la API rechaza con HTTP 403 cualquier
> `POST/PUT/PATCH/DELETE` cuyo header `Origin` (o `Referer` como fallback)
> no este en `CORS_ORIGIN`. Es por eso que `CORS_ORIGIN` es obligatorio
> (el servidor falla al arrancar si esta vacio en `NODE_ENV=production`).

### Sobreescribir manualmente (opcional)

Si mapeas un dominio propio (seccion 5), edita estos valores desde el
dashboard de Render:

- `tiempolibre-api` → `CORS_ORIGIN = https://app.tudominio.com`
- `tiempolibre-web` → `VITE_API_BASE_URL = https://api.tudominio.com` y
  re-despliega para que el bundle se rehaga con el nuevo valor.

---

## 5. Dominios propios

1. En Render: cada servicio → **Settings** → **Custom Domains** → **Add**.
2. Sigue las instrucciones de DNS (CNAME hacia `*.onrender.com`).
3. Render emite el certificado TLS automaticamente.
4. Actualiza `CORS_ORIGIN` y `VITE_API_BASE_URL` como se indica en la
   seccion 4 y dispara un re-deploy del SPA (el `VITE_API_BASE_URL` se
   inyecta al compilar, no en runtime).

---

## 6. Checklist de smoke test

Despues del primer deploy estable, verifica:

- [ ] `https://tiempolibre-api.onrender.com/healthz` devuelve `{"ok":true}`.
- [ ] El SPA carga (`https://tiempolibre-web.onrender.com`).
- [ ] Login con un usuario de prueba funciona y la cookie de sesion se
      guarda (DevTools → Application → Cookies, debe ser `SameSite=None`,
      `Secure`).
- [ ] Una llamada mutante (por ejemplo, crear orden) desde el SPA legitimo
      tiene exito (200/201).
- [ ] Una llamada mutante con `Origin` falsificado (`curl -H "Origin: https://evil.com" ...`)
      devuelve `403 {"error":"Origen no permitido para esta operación"}`.

---

## 7. Notas operativas

- **Free tier**: la API entra en "sleep" tras 15 minutos sin trafico y la
  primera peticion despues despierta el servicio (5-10s de cold start). La
  BD free se borra automaticamente a los 90 dias. Para produccion sube todo
  a `starter` o superior.
- **Logs**: en cada servicio, pestania **Logs** del dashboard.
- **Shell**: en cada Web Service, pestania **Shell** para ejecutar
  `pnpm --filter @workspace/db run db:push`, `pnpm seed`, etc.
- **Backups de BD**: en `starter` y superiores Render hace snapshots
  automaticos diarios. En `free` no hay backups.
- **Region**: `render.yaml` usa `oregon`. Si tus usuarios estan en LATAM,
  cambia a `ohio` o crea los recursos en `frankfurt`/`singapore` segun
  cercania (todos los recursos deben estar en la misma region).

---

## 8. Solucion de problemas comunes

**El SPA carga pero las llamadas a la API fallan con CORS:**
Verifica que `CORS_ORIGIN` en `tiempolibre-api` contenga el origen exacto
del SPA (sin path, con o sin `https://`). Re-despliega la API tras editarlo.

**El SPA carga pero las llamadas devuelven 403 "Origen no permitido":**
La cookie no se esta enviando o el header `Origin` no coincide con
`CORS_ORIGIN`. Revisa que el SPA este abierto desde el origen autorizado
(no desde `localhost` o un dominio no registrado).

**El primer despliegue de la API falla con `CORS_ORIGIN must be set`:**
Esto ocurre si el SPA aun no se ha desplegado (Render no puede resolver
`fromService.host`). Espera a que el SPA termine de desplegarse y reinicia
el deploy de la API desde el dashboard.

**Las cookies no se guardan en el navegador:**
El SPA y la API deben servirse por HTTPS (Render lo hace automaticamente
para subdominios `.onrender.com` y para dominios propios con certificado).
La cookie usa `SameSite=None; Secure`, que el navegador rechaza por HTTP.
