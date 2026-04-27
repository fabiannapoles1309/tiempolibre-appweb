# Despliegue de Rapidoo en Google Cloud Run

Esta guía describe paso a paso cómo migrar Rapidoo desde Replit a Google Cloud
Run. La aplicación se despliega como **dos servicios independientes**:

| Servicio          | Imagen                              | Contiene                              |
|-------------------|-------------------------------------|---------------------------------------|
| `tiempolibre-api` | `artifacts/api-server/Dockerfile`   | API Express (Node.js 22)              |
| `tiempolibre-web` | `artifacts/delivery-saas/Dockerfile`| SPA React/Vite servido por nginx      |

La base de datos se aloja en **Cloud SQL para PostgreSQL**.

---

## 1. Pre-requisitos (una sola vez)

```bash
# Autenticarse y elegir proyecto
gcloud auth login
gcloud config set project <TU_PROJECT_ID>

# Habilitar APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com
```

### 1.1. Repositorio en Artifact Registry

```bash
gcloud artifacts repositories create rapidoo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Imágenes Docker de Rapidoo"
```

### 1.2. Cloud SQL (PostgreSQL)

```bash
gcloud sql instances create rapidoo-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1

gcloud sql databases create rapidoo --instance=rapidoo-db
gcloud sql users create rapidoo --instance=rapidoo-db --password='<CONTRASEÑA_SEGURA>'
```

Cadena de conexión (Cloud Run la conecta vía socket Unix automáticamente):

```
postgres://rapidoo:<CONTRASEÑA>@/rapidoo?host=/cloudsql/<PROJECT_ID>:us-central1:rapidoo-db
```

> Después del primer despliegue agrega `--add-cloudsql-instances=<PROJECT_ID>:us-central1:rapidoo-db`
> al servicio `tiempolibre-api` (ver §4).

### 1.3. Secret Manager

```bash
# DATABASE_URL: la cadena de arriba
echo -n 'postgres://rapidoo:...@/rapidoo?host=/cloudsql/...' | \
  gcloud secrets create DATABASE_URL --data-file=-

# SESSION_SECRET: cualquier string aleatorio largo (min 32 chars)
openssl rand -base64 48 | gcloud secrets create SESSION_SECRET --data-file=-
```

### 1.4. Permisos para la cuenta de servicio de Cloud Build

```bash
PROJECT_NUMBER=$(gcloud projects describe <TU_PROJECT_ID> --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

for ROLE in \
  roles/run.admin \
  roles/iam.serviceAccountUser \
  roles/artifactregistry.writer \
  roles/secretmanager.secretAccessor ; do
  gcloud projects add-iam-policy-binding <TU_PROJECT_ID> \
    --member="serviceAccount:${CB_SA}" --role="${ROLE}"
done
```

### 1.5. Cuenta de servicio de runtime para la API

El servicio `tiempolibre-api` se despliega bajo una cuenta de servicio
dedicada (no la default Compute Engine SA, que tiene permisos demasiado
amplios). Esa cuenta debe poder leer los secretos y conectarse a Cloud SQL.

```bash
PROJECT_ID=<TU_PROJECT_ID>

# 1) Crear la SA de runtime
gcloud iam service-accounts create rapidoo-runtime \
  --display-name="Rapidoo API runtime" \
  --project=$PROJECT_ID

RUNTIME_SA="rapidoo-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

# 2) Permisos mínimos
for ROLE in \
  roles/cloudsql.client \
  roles/secretmanager.secretAccessor ; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${RUNTIME_SA}" --role="${ROLE}"
done

# 3) Permitir que Cloud Build asuma esta SA al desplegar
gcloud iam service-accounts add-iam-policy-binding $RUNTIME_SA \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project=$PROJECT_ID
```

> El nombre `rapidoo-runtime@PROJECT_ID.iam.gserviceaccount.com` es el valor
> por defecto de la sustitución `_RUNTIME_SA` en `cloudbuild.yaml`. Si usas
> otro nombre actualiza ese valor al ejecutar `gcloud builds submit`.

---

## 2. Migrar el esquema a Cloud SQL

Conéctate localmente al Cloud SQL Proxy y ejecuta `drizzle-kit push`:

```bash
# Terminal 1 — proxy
cloud-sql-proxy <PROJECT_ID>:us-central1:rapidoo-db &

# Terminal 2 — push del esquema
DATABASE_URL='postgres://rapidoo:<CONTRASEÑA>@127.0.0.1:5432/rapidoo' \
  pnpm --filter @workspace/db run push
```

---

## 3. Primer despliegue

El primer build no conoce las URLs definitivas, así que desplegamos **dos veces**:

### 3.1. Build inicial (placeholders de URL)

> **Pre-requisito**: ya creaste la SA `rapidoo-runtime@<PROJECT_ID>.iam.gserviceaccount.com`
> y la instancia Cloud SQL `<PROJECT_ID>:us-central1:rapidoo-db` siguiendo
> §1.2 y §1.5. Si usaste otros nombres, pasa `_CLOUDSQL_INSTANCE` y
> `_RUNTIME_SA` en el comando de abajo.

```bash
gcloud builds submit --config cloudbuild.yaml
```

Esto crea ambos servicios. Anota las URLs que devuelve `gcloud run services list`.

> Las URLs `_API_URL` y `_WEB_URL` que se usan en este primer build son
> placeholders, así que el SPA aún no podrá hablar con la API y la API
> rechazará al SPA por CORS. Los re-deploys de §3.2 lo arreglan.

### 3.2. Re-build con URLs reales

```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=\
_API_URL=https://tiempolibre-api-XXXX-uc.a.run.app,\
_WEB_URL=https://tiempolibre-web-XXXX-uc.a.run.app,\
_CLOUDSQL_INSTANCE=<PROJECT_ID>:us-central1:rapidoo-db,\
_RUNTIME_SA=rapidoo-runtime@<PROJECT_ID>.iam.gserviceaccount.com
```

> **Por qué dos veces:** la URL de la API se inyecta en el bundle del SPA en
> tiempo de compilación (`VITE_API_BASE_URL`) y la URL del SPA se aplica como
> `CORS_ORIGIN` en la API. Si configuras un dominio propio (ver §5) sólo
> necesitarás un build con esos dominios fijos.
>
> **Cloud SQL** se conecta automáticamente vía
> `--add-cloudsql-instances=${_CLOUDSQL_INSTANCE}` en el deploy de la API,
> que monta el socket Unix `/cloudsql/<INSTANCE>` esperado por
> `DATABASE_URL`.

---

## 4. Variables de entorno usadas por la API

| Variable          | Origen                       | Descripción                                    |
|-------------------|------------------------------|------------------------------------------------|
| `PORT`            | inyectado por Cloud Run      | Puerto donde escucha Express (8080).           |
| `NODE_ENV`        | `cloudbuild.yaml`            | `production` activa cookies `Secure`/`SameSite=None` y el guardia CSRF. |
| `LOG_LEVEL`       | `cloudbuild.yaml`            | Nivel de Pino (`info`, `debug`, ...).          |
| `CORS_ORIGIN`     | `cloudbuild.yaml`            | Lista (CSV) de orígenes permitidos. **Obligatorio en producción** — el servidor falla al arrancar si está vacío. |
| `DATABASE_URL`    | Secret Manager               | Cadena de PostgreSQL (formato Unix-socket cuando se usa Cloud SQL). |
| `SESSION_SECRET`  | Secret Manager               | Firma del JWT de sesión.                       |

> **Defensa CSRF**: además de la cookie `SameSite=None; Secure`, en producción
> la API rechaza con HTTP 403 cualquier `POST/PUT/PATCH/DELETE` cuyo header
> `Origin` (o `Referer` como fallback) no esté en `CORS_ORIGIN`. Por eso es
> indispensable que la lista contenga el origen exacto del SPA (incluido el
> esquema `https://` y sin path).

El SPA sólo necesita una variable, definida en build time:

| Variable             | Tipo       | Descripción                                |
|----------------------|------------|--------------------------------------------|
| `VITE_API_BASE_URL`  | build arg  | URL pública de la API (ej. `https://api.rapidoo.com`). |

---

## 5. Dominios personalizados (opcional)

```bash
gcloud beta run domain-mappings create \
  --service=tiempolibre-web --domain=app.rapidoo.com --region=us-central1

gcloud beta run domain-mappings create \
  --service=tiempolibre-api --domain=api.rapidoo.com --region=us-central1
```

Después del mapeo:

1. Apunta los registros DNS que muestre `gcloud`.
2. Re-ejecuta el build con
   `--substitutions=_API_URL=https://api.rapidoo.com,_WEB_URL=https://app.rapidoo.com`.

---

## 6. Probar imágenes localmente

```bash
# API
docker build -f artifacts/api-server/Dockerfile -t rapidoo-api .
docker run --rm -p 8080:8080 \
  -e DATABASE_URL=postgres://... \
  -e SESSION_SECRET=test \
  -e NODE_ENV=production \
  rapidoo-api

# SPA
docker build -f artifacts/delivery-saas/Dockerfile \
  --build-arg VITE_API_BASE_URL=http://localhost:8080 \
  -t rapidoo-web .
docker run --rm -p 8081:8080 rapidoo-web
```

Visita `http://localhost:8081` y verifica que el SPA hable con la API local.

---

## 7. Diferencias clave respecto a Replit

- **Cookies cross-site**: en producción la cookie de sesión usa
  `SameSite=None; Secure` para que el navegador la envíe al llamar al dominio
  de la API desde el dominio del SPA.
- **Trust proxy**: Express confía en el primer hop (Google Front End) para
  obtener la IP real y honrar `Secure` correctamente.
- **CORS**: ya no es permisivo; sólo se aceptan peticiones desde los orígenes
  listados en `CORS_ORIGIN`.
- **API base URL**: el SPA aprende la URL de la API en build time
  (`VITE_API_BASE_URL`); en Replit no se usa porque el proxy sirve todo desde
  el mismo origen.
- **Healthcheck**: ambos servicios exponen `/healthz` que devuelve `200 OK`
  sin tocar la base de datos ni la autenticación.
