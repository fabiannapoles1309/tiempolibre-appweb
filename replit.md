# Rapidoo — SaaS de Entregas B2B

A production-ready B2B last-mile delivery management platform built on the Replit pnpm monorepo template. UI in Spanish (Argentina); currency in ARS.

## Architecture

- **Monorepo (pnpm workspaces)** with two artifacts:
  - `artifacts/api-server` — Express 5 + Drizzle (Postgres) JSON API at `/api/*`. Port: dynamic via `PORT`.
  - `artifacts/delivery-saas` — React + Vite + Tailwind + shadcn UI. The end-user web app.
- **Shared libraries:**
  - `lib/api-spec` — Single source of truth for the API: OpenAPI 3.1 (`openapi.yaml`).
  - `lib/api-zod` — Zod runtime schemas generated from the OpenAPI spec via Orval (used by both backend and frontend).
  - `lib/api-client-react` — Typed React Query hooks generated from the same spec (consumed by the frontend).
  - `lib/db` — Drizzle ORM schema + connection (`@workspace/db`). Migrations applied with `pnpm --filter @workspace/db run push`.

## Domain model

- **Users** (`users`): id, email, name, password_hash, role ∈ {`ADMIN`, `CLIENTE`, `DRIVER`}.
- **Zones** (`zones`): Norte, Sur, Este, Oeste.
- **Drivers** (`drivers`): name, phone, vehicle, zones[] (text array), active.
- **Orders** (`orders`): customerId, pickup, delivery, zone, payment ∈ {EFECTIVO, TRANSFERENCIA, BILLETERA}, amount, status ∈ {PENDIENTE, ASIGNADO, EN_RUTA, ENTREGADO, CANCELADO}, driverId, notes.
- **Transactions** (`transactions`): platform-wide INGRESO/GASTO ledger linked to orders.
- **Wallet** (`wallets` + `wallet_tx`): per-user prepaid balance with TOPUP/PAGO/REEMBOLSO movements.

## Authentication

- JWT (HS256) signed with `SESSION_SECRET`, stored in an httpOnly `rapidoo_session` cookie (7-day TTL). `cookie-parser` middleware extracts it; `attachUser` middleware decodes and sets `req.user`.
- Passwords hashed with `bcryptjs` (cost 10).
- `requireAuth` and `requireRole(...roles)` middlewares guard every protected route.

## Auto-assignment

`POST /api/orders/assign-auto` (ADMIN only) finds all PENDIENTE orders and assigns each to the active driver covering that order's zone with the lowest current load (count of ASIGNADO + EN_RUTA orders). Manual assignment via `POST /api/orders/:id/assign-manual`.

## Demo credentials (seeded)

- ADMIN: `admin@rapidoo.com` / `admin123`
- CLIENTE: `cliente@rapidoo.com` / `cliente123` (starts with $150 wallet balance)
- DRIVER: `driver@rapidoo.com` / `driver123`

Demo accounts (TiempoLibre brand, current):
- ADMIN: `admin@tiempolibre.com` / `admin123`
- CLIENTE: `cliente@tiempolibre.com` / `cliente123`
- DRIVER: `driver@tiempolibre.com` / `driver123` (linked to driver "Carlos Gómez" via `drivers.userId`)

Plus 3 drivers and 8 sample orders distributed across numeric zones 1–8.

Re-run the seed (idempotent): `pnpm dlx tsx artifacts/api-server/src/seed.ts`

## Development workflow

1. Edit the OpenAPI spec in `lib/api-spec/openapi.yaml`.
2. Regenerate clients: `pnpm --filter @workspace/api-spec run codegen`.
3. Implement the route in `artifacts/api-server/src/routes/*.ts` (validate body with Zod schemas from `@workspace/api-zod`).
4. Use the React Query hooks from `@workspace/api-client-react` in the frontend.
5. Typecheck the workspace: `pnpm -w run typecheck`.
6. DB schema changes: edit `lib/db/src/schema/*.ts` and run `pnpm --filter @workspace/db run push`.

## User preferences

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
- `lib/api-zod/src/index.ts` re-exports zod schemas only (`export * from "./generated/api"`); TS interfaces come from `@workspace/api-client-react` to avoid duplicate-symbol errors.
- Currency formatted as ARS via `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.
- Dates formatted with `date-fns` + Spanish locale (`import { es } from 'date-fns/locale'`).
