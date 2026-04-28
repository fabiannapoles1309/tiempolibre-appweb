# TiempoLibre — SaaS de Entregas B2B

## Overview

TiempoLibre is a production-ready B2B last-mile delivery management platform designed to streamline and manage delivery operations. It provides a comprehensive solution for businesses requiring efficient last-mile logistics, supporting various user roles like administrators, clients, and drivers. Key capabilities include order management, driver assignment, subscription handling, financial tracking, and incident reporting. The project aims to capture the B2B last-mile delivery market with a reliable and scalable SaaS offering, poised for significant growth in urban logistics.

## User Preferences

- Spanish UI throughout. Spanish error messages.
- Brand: TiempoLibre, light theme, cyan #00B5E2 primary. Slogan "SOMOS TU SISTEMA DE REPARTO". No emojis in the UI.
- Spanish (voseo argentino).
- Zones are numeric strings "1".."8" (no compass names).
- Order payment methods exposed in the create-order form: EFECTIVO and TRANSFERENCIA only (BILLETERA may exist in legacy/seed data but is not user-selectable).
- RBAC scoping (enforced server-side in `routes/orders.ts` and `routes/reports.ts`):
  - ADMIN: sees all orders, may filter by zone/customerId/driverId, sees all KPIs and zone chart.
  - CLIENTE: sees only their own orders (`customerId = session.userId`); only role allowed to create orders.
  - DRIVER: sees only orders assigned to them (`drivers.userId = session.userId` → `orders.driverId`).
- UI hides ADMIN-only widgets ("Repartidores" KPI, "Pedidos por Zona" chart, zone filter on /orders) and CLIENTE-only CTAs ("Crear Nuevo Pedido") based on role.
- Driver-only pages: `/driver/status`, `/driver/benefits`, `/driver/ranking`. Cliente-only: `/subscription`. Admin-only: `/admin/subscriptions`, `/admin/incidents`. Drivers may report incidents via `/incidents`; admins manage them via `/admin/incidents`.
- `GET /api/drivers` is admin-only; drivers consult their own profile via `GET /api/me/driver`.
- `lib/api-zod/src/index.ts` re-exports zod schemas only (`export * from "./generated/api"`); TS interfaces come from `@workspace/api-client-react` to avoid duplicate-symbol errors.
- Currency formatted as ARS via `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.
- Order payment methods now include `EFECTIVO`, `TRANSFERENCIA`, `BILLETERA`, `TARJETA`, `CORTESIA`. `cashAmount`/`cashChange` are persisted only when `payment === EFECTIVO` (server forces null otherwise). The /finance donut chart always renders all 5 canonical methods with stable colors and Spanish labels (Cortesía visible even at $0). The accounting Excel export includes a "Por método de pago" sheet that always lists all 5 methods plus a TOTAL row.
- Order create accepts optional `deliveryLat`/`deliveryLng`. When provided, the server runs point-in-polygon validation against `zonas.kml` (`mapService.validarPunto`) and rejects out-of-zone points with HTTP 400 `FUERA_DE_ZONA`. When absent, falls back to address geocoding via `validarZona`.
- Cliente order creation requires an active subscription with `remainingDeliveries > 0` (HTTP 402 `NO_SUBSCRIPTION` / `NO_DELIVERIES_LEFT`). El bloque mensual se descuenta **al solicitar** el envío (POST /orders), no al entregar. La reserva atómica + el `INSERT` del pedido se ejecutan dentro de una **única `db.transaction`**: si el insert falla, la reserva se revierte (no hay "fugas" de envíos). El SQL de reserva: `UPDATE subscriptions SET used_deliveries=used_deliveries+1, status=CASE WHEN +1>=monthly THEN 'VENCIDA' ELSE status END WHERE id=? AND used_deliveries<monthly RETURNING`. Si dos pedidos compiten por el último envío, sólo uno entra; el otro recibe 402. Cuando el cliente tiene varias suscripciones `ACTIVA` (p.ej. tras una recarga que crea un nuevo periodo), la reserva siempre toma la más reciente (`orderBy desc(createdAt)`) — el mismo criterio que `GET /me/subscription` muestra en pantalla. La columna `orders.subscription_id` (nullable, agregada en este flujo) persiste exactamente qué suscripción se debitó. Al cancelar (PATCH `status=CANCELADO`), el reembolso usa **ese mismo `subscription_id`** (`GREATEST(used-1,0)` y reactiva `VENCIDA→ACTIVA` si corresponde), evitando reembolsar el bloque equivocado si entremedios hubo recargas. Pasar a `ENTREGADO` ya **no** vuelve a descontar (evita doble cobro).
- Frontend muestra el bloque restante en dos lugares: (a) banner en `/orders/new` con `data-testid="banner-deliveries-counter"` y `text-order-new-remaining` (neutro >5, ámbar 1-5, rojo 0); (b) alerta sobre el grid de KPIs en `/dashboard` con `data-testid="alert-deliveries-low"` que sólo aparece cuando `remainingDeliveries ≤ 5`. Tras crear un envío, la página invalida `getMySubscriptionQueryKey` y muestra `toast.warning` if the nuevo restante quedará en ≤ 5.
- `POST /me/subscription/recharge` adds a 35-envíos block to the latest subscription regardless of whether it is `ACTIVA` or `VENCIDA`, and reactivates it.
- Admin endpoints: `POST /admin/users` (creates CLIENTE w/ tier or DRIVER w/ profile), `GET /admin/customer-deliveries`, `GET /admin/cash-by-customer` (sums `cashAmount` falling back to `amount`), `GET|PUT /admin/benefits-config`, `GET /finance/today-split` (Reparto vs Planes).
- Cliente order detail polls every 5s (React Query `refetchInterval: 5000`) for near-real-time status updates.
- Driver-facing labels: `Patente → Placa`, `Cédula → Tarjeta de Circulación`. The `circulationCardExpiry` column is preserved in the DB but no longer surfaced/edited in the UI.
- Order-new uses an embedded MapLibre map loading `public/zonas.kml` for click-to-pick delivery point with client-side `turf` validation. If the browser lacks WebGL the page degrades gracefully (amber alert), and the server still validates the zone from the address.
- Dates formatted with `date-fns` + Spanish locale (`import { es } from 'date-fns/locale'`).
- Driver welcome SMS: `services/notificationService.ts` exposes `buildDriverWelcomeMessage({name,email,password,appUrl})` (uses `PUBLIC_APP_URL` → `REPLIT_DOMAINS` → fallback) ending with the slogan `"Confianza y seguridad en cada kilometro"`. `POST /admin/users` returns the schema `AdminCreatedUser` with an optional `welcomeMessage` populated only when `role === DRIVER`. The admin UI (`admin-users.tsx`) opens a modal with the message and a "Copiar al portapapeles" button (uses `navigator.clipboard` with a `document.execCommand('copy')` fallback).
- Cliente "Mi Billetera" is read-only and represents accumulated cash collected by drivers on the cliente's deliveries:
  - On `PATCH /orders/:id` when an order transitions into `ENTREGADO` and `payment === 'EFECTIVO'`, the server credits the cliente's wallet by `cashAmount` (fallback `amount`) and inserts a `wallet_tx` row of type `TOPUP` with description `"Cobranza en efectivo - Pedido #N"`. Guarded by `becameDelivered` so it cannot double-credit on subsequent edits.
  - `POST /wallet/topup` rejects CLIENTE with HTTP 403 + `reason: WALLET_READONLY_FOR_CLIENTE`. ADMIN can still top up.
  - `POST /orders` rejects `payment === 'BILLETERA'` for CLIENTE with HTTP 400 + `reason: BILLETERA_NOT_ALLOWED_FOR_CLIENTE` so a tampered client cannot spend the wallet.
  - Frontend (`pages/wallet.tsx`) hides the "Recargar Saldo" card and changes the label to "Saldo cobrado" with explanatory copy when `user.role === CLIENTE`. `/wallet` route allows `["CLIENTE","ADMIN"]` and the cliente sidebar exposes "Mi billetera".
- Pickup address lock for CLIENTE:
  - `POST /orders` overrides any client-supplied `pickup` with `customers.pickupAddress` for CLIENTE before persistence (server-side enforcement).
  - `pages/order-new.tsx` pre-fills the field from `/me/customer.pickupAddress` via `form.setValue` (guarded against re-renders), and renders the input as `readOnly` + muted, with a help message ("Este es tu domicilio de recolección registrado…"). ADMIN keeps the editable field.
- Dashboard KPI for CLIENTE:
  - `routes/reports.ts /reports/dashboard` now returns `kpis.todayDeliveryExpense` = sum of today's non-`CANCELADO` orders' `amount` for the requesting cliente.
  - `pages/dashboard.tsx` renders a sixth card "Gasto en envíos hoy" (orange dollar icon) next to "Ingresos Hoy" only when `user.role === CLIENTE`.
- Order create flow (`routes/orders.ts`): for CLIENTE, `recipientName` + `recipientPhone` are required. The server upserts a `recipients` row keyed by (customerId, phone) — incrementing `orderCount`, refreshing `lastUsedAt`, and overriding the marketing consents with whatever the cliente sent on this order. The recipient name is also persisted on the order row itself.
- Package request endpoints (`routes/package-requests.ts`):
  - `POST /me/package-requests` — cliente creates a request. La inserción depende del índice único parcial; si dos requests llegan en paralelo, el perdedor recibe HTTP 409 + `reason: PENDING_REQUEST_EXISTS` (mapeado desde el error PG `23505`, mirando `err.code` y `err.cause.code`).
  - `GET /me/package-requests/active` — returns `{ pending: {...} | null }`.
  - `GET /admin/package-requests?status=` — admin/superuser list with cliente info.
  - `POST /admin/package-requests/:id/approve` — corre dentro de `db.transaction`: hace un `UPDATE ... WHERE id=? AND status='PENDIENTE' RETURNING id` para "claim" la solicitud y, **sólo si claim devuelve filas**, recarga +35 envíos en la última suscripción `ACTIVA`/`VENCIDA` con `monthly_deliveries = monthly_deliveries + 35` (SQL atómico) y la reactiva. Si dos admins aprueban en paralelo, sólo uno entra; el resto recibe 400 ("ya procesada"). Probado: 5 approves paralelos → delta neto = +35.
  - `POST /admin/package-requests/:id/reject` — mismo patrón de transición condicional (`UPDATE ... WHERE id=? AND status='PENDIENTE'`); si no hay filas afectadas, distingue 404 (no existe) vs 400 (ya fue procesada).
  - On creation, `notificationService.notifyAdminsPackageRequest` builds an admin/superuser notification list and logs the message body. There is no SMTP integration in the repo — the persisted `package_requests` row is the source of truth and the admin UI is the action surface.
- Tipos de vehículo (drivers):
  - Lista canónica en `artifacts/delivery-saas/src/lib/vehicle-types.ts`: `["Moto", "Bicicleta eléctrica", "Moto taxi", "Carro"]`. Cualquier nuevo tipo se agrega aquí.
  - Tanto el alta de driver desde `/admin/users` (admin/superuser → role=DRIVER) como el CRUD dedicado de `/drivers` usan un `<Select>` con esas 4 opciones (data-testid `select-vehicle-type` y `select-driver-vehicle`). Hay validación zod (`refine` contra el set canónico) en ambos formularios.
  - DB: la columna `drivers.vehicle` sigue siendo `varchar(64)` libre (sin enum) para no romper datos existentes y dejar margen al admin si en el futuro hace falta otro tipo. Los registros viejos fueron normalizados (Honda/Yamaha → Moto, Furgoneta → Carro, vacío → Moto) para que la pantalla de edición no marque error.
- Personal interno (admin/superuser directory):
  - `GET /api/admin/staff-users` returns ADMIN+SUPERUSER users (id, name, email, role, createdAt) ordered by role then name. Used by `/admin/staff` page to surface the emails that receive package-request and feedback notifications.
- Reporte combinado (Excel):
  - `GET /api/admin/reports/combined?period=DAY|WEEK|MONTH|YEAR&from=YYYY-MM-DD&to=YYYY-MM-DD` (admin/superuser) streams an `.xlsx` with columns `Período | Cliente | Establecimiento | Envíos | Costo total envíos (MXN) | Cash recibido (MXN) | Total combinado (MXN)` plus a TOTAL row.
  - SQL aggregates orders by `date_trunc(period, created_at)` × `customer_id`. Excludes `status='CANCELADO'` from envíos/costo; cash sum only counts `payment='EFECTIVO' AND status='ENTREGADO'` (only delivered cash is "money on hand"). `from`/`to` are validated against `^\d{4}-\d{2}-\d{2}$` and applied as `created_at >= from` / `created_at < to + 1 day`.
  - Frontend page `/admin/reports-combined` exposes a period selector, two date pickers and a "Descargar Excel" button (auth via fetch with credentials).
- Email service + Sendgrid:
  - `services/emailService.ts` exports `sendEmail({to, subject, text, html?})`. Calls Sendgrid via the Replit Connectors REST endpoint (`/api/v2/connection?include_secrets=true&connector_names=sendgrid`) to fetch an `api_key`, then sends with `@sendgrid/mail`. If no token / no key / send fails, it logs `[email-fallback] recipients=N subject="…" bodyChars=N` (metadata only, no body to avoid PII leaks) and returns `{sent:false, reason}` — never throws.
  - `notifyAdminsPackageRequest` was refactored to call `sendEmail` instead of `console.log`, so package-request notifications now go to admin emails the moment Sendgrid is connected (until then, the same console fallback works).
  - `TIEMPOLIBRE_EMAIL_FROM` env var overrides the default `no-reply@tiempolibre.app` From address. (`RAPIDOO_EMAIL_FROM` still honored as a fallback for backward compatibility.)

- **Folios públicos independientes (rebrand 2026-04-28)**: PKs `serial id` se conservan; se añadieron tres columnas con secuencias propias para folios visibles e independientes:
  - `users.customer_code` → `CLI-NNNNNN` (sólo CLIENTE), secuencia `customer_code_seq`. Asignado en `POST /auth/register` y `POST /admin/users` cuando `role='CLIENTE'`.
  - `drivers.driver_code` → `REP-NNNNNN`, secuencia `driver_code_seq`. Asignado en `POST /drivers` y en `POST /admin/users` cuando `role='DRIVER'`.
  - `orders.folio` → `PED-NNNNNN`, secuencia `order_folio_seq`. Asignado dentro de la transacción de creación en `POST /orders` (puede dejar huecos si la INSERT abortó por race-loss; los folios sólo necesitan ser únicos, no contiguos).
  - Filas existentes backfilleadas vía `ROW_NUMBER() OVER (ORDER BY id)`; sequences seteadas con `setval` por encima del máximo backfilleado.
  - UI: `/orders` muestra columna **Folio** (`text-order-folio-{id}`); `/admin/clientes` muestra **Folio** (`text-customer-code-{id}`); `/drivers` muestra **Folio** (`text-driver-code-{id}`).
  - **Status**: the user dismissed the Sendgrid Replit integration on 2026-04-25, so the fallback is the only path live right now. To enable real email later: either retry the Sendgrid connector proposal, or ask the user for a Sendgrid API key and store it as a secret + adapt `getSendgridClient()` to read it.
- Quejas y sugerencias (feedback):
  - DB: `feedback` table (`id`, `user_id` int, `type` varchar QUEJA|SUGERENCIA, `subject` varchar(255), `message` text, `created_at` timestamptz).
  - `POST /api/me/feedback` (any logged-in user): validates type ∈ {QUEJA, SUGERENCIA}, subject 1..255 chars, message 1..4000 chars; persists then asynchronously emails all ADMIN+SUPERUSER addresses via `sendEmail` (subject `[Queja|Sugerencia] {user}: {subject}`, body includes user identity, full message and a deep-link to `/admin/feedback`). Notification failure never blocks the 201 response.
  - `GET /api/admin/feedback` (admin/superuser): returns rows joined with the user (id, userId, userName, userEmail, userRole, type, subject, message, createdAt), most recent first.
  - Frontend: `/feedback` page (cliente, driver, admin) with a typed form (zod-validated), and `/admin/feedback` admin inbox with count cards (Total/Quejas/Sugerencias), search + tipo filter (Todos/Quejas/Sugerencias), and a table.
  - Sidebar: clientes/drivers see "Quejas y sugerencias"; admins see "Personal interno", "Reporte combinado" and "Buzón de quejas".
- Recipient email capture (envío):
  - DB: `recipients` gains a nullable `email` column; `orders` gains a nullable `recipient_email` column. OpenAPI extends `Order` and `CreateOrderBody` with optional `recipientEmail`.
  - `routes/orders.ts` accepts `recipientEmail`, normalizes it to lowercase + trims, validates a basic regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) and max 255 chars; rejects invalid input with HTTP 400 (`RECIPIENT_EMAIL_INVALID` / `RECIPIENT_EMAIL_TOO_LONG`). Persists on the order row and includes it in the recipients upsert. On conflict, updates `email` only when a new value is provided so existing emails are not wiped by an order without an email.
  - `routes/recipients.ts`: `/me/recipients`, `/admin/recipients`, and the Excel export include the recipient `email` column.
  - Frontend: `pages/order-new.tsx` adds an optional "Correo electrónico del destinatario" input (zod-validated email, trimmed, max 255 chars; submission allowed when blank). Phone-based autofill from `/me/recipients` also fills the email field, but only when the field is empty so manual entries are never clobbered. `pages/admin-destinatarios.tsx` displays a new "Correo" column (showing "—" when null).
- Frontend:
  - `pages/order-new.tsx` adds a required "Nombre del destinatario" field plus two optional checkboxes ("Acepta recibir SMS publicitarios", "Acepta recibir correos publicitarios"). Fetches `/api/me/recipients` once on mount; when the typed phone exactly matches a known recipient, autofills name + consents (only if the name field is empty or already equals the recipient's name, so manual edits are not clobbered). The order-create body now passes `recipientName`, `allowMarketingSms`, `allowMarketingEmail` (cast to `any` since the OpenAPI client has not yet been regenerated for these fields).
  - `pages/wallet.tsx` adds a "Solicitar nuevo paquete de entregas" card for CLIENTE — disabled with an amber "En revisión" pill while the cliente has a pending request, otherwise a clickable cyan button.
  - `pages/admin-destinatarios.tsx` (`/admin/destinatarios`, ADMIN+SUPERUSER): searchable table of (cliente, destinatario, teléfono, SMS, Email, envíos, último envío) with an "Descargar Excel" button.
  - `pages/admin-solicitudes-paquetes.tsx` (`/admin/solicitudes-paquetes`, ADMIN+SUPERUSER): "Pendientes" table with Approve/Reject buttons + "Historial" table.
  - Sidebar (`components/layout.tsx`) gains "Destinatarios" and "Solicitudes de paquete" entries for ADMIN (filtered nav also surfaces them to SUPERUSER).
- Pricing settings (configurable plan & extra-package prices):
  - New `pricing_settings` table (key/value, `numeric(12,2)`) with seeded keys `ESTANDAR_PRICE=15000`, `OPTIMO_PRICE=25000`, `EXTRA_PACKAGE_PRICE=15000`. Seed lives in `artifacts/api-server/src/seed.ts` using `PRICING_KEYS`/`PRICING_DEFAULTS` from `@workspace/db` (idempotent `onConflictDoNothing`).
  - `routes/pricing-settings.ts` exposes `GET /pricing-settings` (any authed) and `PUT /admin/pricing-settings` (ADMIN/SUPERUSER). Manual body validation enforces `>=0`, max value `9_999_999_999.99` (numeric(12,2) bound), and ≤2 decimals — invalid inputs return HTTP 400 in Spanish. Helper `getPricing()` falls back to `PRICING_DEFAULTS` if a row is missing so checkout/approve never crash.
  - `routes/subscriptions.ts` `subscribe` now reads `estandarPrice`/`optimoPrice` from `getPricing()` instead of hardcoded TIERS (deliveries=35 stays hardcoded by design).
  - `routes/package-requests.ts` approve transaction also UPSERTS the cliente's wallet row, deducts `extraPackagePrice` via atomic `balance = balance - X` SQL, and inserts a `wallet_tx` PAGO with description `"Cargo por paquete extra de 35 envíos"`. Negative balance is allowed by design (B2B accounts; cliente owes platform).
  - Frontend: new `pages/admin-pricing-settings.tsx` (route `/admin/pricing-settings`, ADMIN; SUPERUSER auto-allowed via `ProtectedRoute`) with 3 inputs + Guardar; nav entry "Configuración de precios". `pages/subscription.tsx` reads PLAN prices from `useGetPricingSettings`. `pages/wallet.tsx` adds an "Envíos del periodo" card for CLIENTE (totales/solicitados/restantes + BlockOf35 grid) sourced from `useGetMySubscription`.

## System Architecture

The project is a monorepo built with `pnpm workspaces`, comprising an `artifacts/api-server` (Express 5 + Drizzle ORM for Postgres) and an `artifacts/delivery-saas` (React + Vite + Tailwind + shadcn UI frontend). Shared libraries (`lib/api-spec`, `lib/api-zod`, `lib/api-client-react`, `lib/db`) ensure consistent API definitions and typed hooks.

**Core Features:**

-   **Domain Model:** Includes Users, Zones, Drivers, Orders, Transactions, Wallet (with `wallets` and `wallet_tx`), Incidents, Subscriptions, Recipients, and Package Requests.
-   **Authentication:** JWT (HS256) via httpOnly cookies, bcryptjs for password hashing, and RBAC middleware for route protection.
-   **Order Management:** Supports automatic and manual driver assignment, with atomic state transitions for order delivery that trigger financial and subscription updates.
-   **Financial Tracking:** Comprehensive ledger, user-specific prepaid wallets, and detailed financial reporting, including configurable pricing settings.
-   **Benefit Tracking:** Manages driver benefits, tracking progress and claims.
-   **Recipient Management:** Stores recipient details, including marketing consents, supporting autofill and server-side upsert logic.
-   **Package Requests:** Allows clients to request new delivery blocks, with an atomic approval/rejection process for administrators.
-   **Feedback System:** Implements a complaints and suggestions system for all user roles, with admin review capabilities and email notifications.
-   **UI/UX:** Light theme with cyan primary color, localized for Spanish (Argentina), with role-based widget visibility. Uses Tailwind CSS and shadcn UI.
-   **Geospatial Features:** Interactive delivery point selection using client-side MapLibre with `public/zonas.kml` and `turf` for zone validation. Server-side validation handles point-in-polygon checks and geocoding.
-   **Notification System:** `notificationService` for driver welcome messages and admin package request notifications (logging only, with Sendgrid integration planned).
-   **Reporting:** Generates combined Excel reports for administrators with detailed financial and delivery metrics.

## External Dependencies

-   **PostgreSQL:** Primary database for all application data.
-   **Express 5:** Backend framework handling API routes and business logic.
-   **React + Vite:** Frontend framework for building the user interface.
-   **Tailwind CSS + shadcn UI:** Utility-first CSS framework and UI component library for styling.
-   **Orval:** Tool for generating Zod schemas and React Query hooks from OpenAPI specifications.
-   **bcryptjs:** Library for hashing and comparing passwords securely.
-   **date-fns:** Comprehensive utility library for date manipulation.
-   **MapLibre:** Open-source library for interactive maps, used for delivery point selection.
-   **turf.js:** JavaScript library for geospatial analysis, used for client-side zone validation.
-   **exceljs:** Library for reading, writing, and manipulating XLSX files for report generation.
-   **Sendgrid:** Email communication platform for notifications (currently using a fallback logging mechanism due to connector status).