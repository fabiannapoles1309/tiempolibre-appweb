# Rapidoo — SaaS de Entregas B2B

## Overview

Rapidoo is a production-ready B2B last-mile delivery management platform designed to streamline and manage delivery operations. It offers a comprehensive solution for businesses requiring efficient last-mile logistics, with a focus on usability and robust backend services. The platform supports various user roles, including administrators, clients, and drivers, each with tailored functionalities. Key capabilities include order management, driver assignment, subscription handling, financial tracking, and incident reporting. The project aims to capture the market for B2B last-mile delivery services, providing a reliable and scalable SaaS solution.

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
- Cliente order creation requires an active subscription with `remainingDeliveries > 0` (HTTP 402 `NO_SUBSCRIPTION` / `NO_DELIVERIES_LEFT`).
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

The project is structured as a monorepo using `pnpm workspaces`, consisting of two primary artifacts: `artifacts/api-server` (an Express 5 + Drizzle (Postgres) JSON API) and `artifacts/delivery-saas` (a React + Vite + Tailwind + shadcn UI frontend). Shared libraries (`lib/api-spec`, `lib/api-zod`, `lib/api-client-react`, `lib/db`) ensure a single source of truth for API definitions, Zod schemas, and typed React Query hooks, promoting consistency between frontend and backend.

**Core Features:**

-   **Domain Model:** Includes Users, Zones, Drivers, Orders, Transactions, Wallet (with `wallets` and `wallet_tx`), Incidents, and Subscriptions.
-   **Authentication:** JWT (HS256) based, stored in an httpOnly cookie, with bcryptjs for password hashing and role-based access control (RBAC) middleware for route protection.
-   **Order Management:** Supports automatic assignment of orders to drivers based on zone and load, manual assignment, and atomic state transitions for order delivery, triggering financial updates and subscription usage.
-   **Financial Tracking:** Integrates a platform-wide ledger, per-user prepaid wallets, and detailed financial reports including expenses and split revenue.
-   **Benefit Tracking:** Manages driver benefits with `benefit_items` and `benefit_claims` tables, allowing admins to track monthly deliveries, progress towards benefits, and claim status.
-   **Recipient Management:** `recipients` table for storing delivery recipient details, including marketing consents and usage statistics. This supports client-side autofill and server-side upsert logic during order creation.
-   **Package Requests:** `package_requests` table and associated endpoints allow clients to request new delivery blocks, with an atomic approval/rejection process for administrators.
-   **UI/UX:** Designed with Tailwind CSS and shadcn UI, adhering to a light theme with cyan as the primary color. The UI is localized for Spanish (Argentina) with specific branding (TiempoLibre) and role-based widget visibility.
-   **Geospatial Features:** Utilizes client-side MapLibre with `public/zonas.kml` and `turf` for interactive delivery point selection and client-side zone validation. Server-side validation handles point-in-polygon checks and address geocoding.
-   **Notification System:** Includes a `notificationService` for building driver welcome messages and admin notifications for package requests (logging only, no external SMTP).

## External Dependencies

-   **PostgreSQL:** Primary database managed with Drizzle ORM.
-   **Express 5:** Backend API framework.
-   **React + Vite:** Frontend development stack.
-   **Tailwind CSS + shadcn UI:** Frontend styling and component library.
-   **Orval:** Used for generating Zod runtime schemas and typed React Query hooks from OpenAPI specifications.
-   **bcryptjs:** For password hashing.
-   **date-fns:** For date formatting with Spanish locale.
-   **MapLibre:** Embedded map library for interactive delivery point selection.
-   **turf.js:** Client-side geospatial analysis for zone validation.
-   **exceljs:** For generating Excel reports (e.g., benefits tracking export, recipients export).