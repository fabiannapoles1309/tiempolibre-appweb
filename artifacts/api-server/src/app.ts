import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { attachUser } from "./middlewares/auth";

const app: Express = express();
const isProduction = process.env.NODE_ENV === "production";

// Cloud Run sits behind Google Front End. Trust the first proxy hop so that
// req.ip / req.protocol / req.secure reflect the original client (required
// for cookie `secure` flag and for accurate request logging).
app.set("trust proxy", 1);

// CORS_ORIGIN: comma-separated allowlist of frontend origins (e.g.
// "https://app.rapidoo.com,https://staging.rapidoo.com"). Cookies are
// credentialed; with sameSite=none in production browsers require an
// explicit matching origin (no wildcard).
//
// Fail-closed in production: if CORS_ORIGIN is missing we crash at startup
// instead of falling back to the dev-only reflect-origin behavior. That
// avoids a misconfigured production deploy silently accepting requests from
// any origin while sending credentialed cookies.
function canonicalOrigin(raw: string): string {
  const url = new URL(raw); // throws on invalid input
  if (url.pathname !== "" && url.pathname !== "/") {
    throw new Error(
      `CORS_ORIGIN entry "${raw}" must be a bare origin (no path).`,
    );
  }
  return `${url.protocol}//${url.host}`;
}

const corsOriginEnv = process.env.CORS_ORIGIN?.trim();
const corsOriginList: string[] = corsOriginEnv
  ? corsOriginEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        try {
          return canonicalOrigin(entry);
        } catch (err) {
          throw new Error(
            `Invalid CORS_ORIGIN entry "${entry}": ${(err as Error).message}`,
          );
        }
      })
  : [];

if (isProduction && corsOriginList.length === 0) {
  throw new Error(
    "CORS_ORIGIN must be set in production (comma-separated list of allowed origins, e.g. https://app.rapidoo.com).",
  );
}

// Single source of truth: the same canonicalized set is consumed by both
// the cors middleware and the CSRF guard, so a trailing slash in the env
// var can never cause CORS to reject what CSRF accepts (or vice versa).
const corsOrigin: cors.CorsOptions["origin"] =
  corsOriginList.length > 0 ? corsOriginList : true;

// Lightweight liveness/readiness endpoint outside /api so Cloud Run probes
// (and any uptime check) succeed without touching auth or the DB.
app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

// CSRF defense via Origin/Referer enforcement on state-changing requests.
//
// Background: with `SameSite=None` (required for cross-site cookies between
// the SPA and API on different Cloud Run hostnames) the browser will send
// the auth cookie on cross-origin POSTs initiated by ANY site, which
// re-opens classic CSRF. We mitigate by requiring that mutating requests
// carry an Origin (or Referer) header whose origin matches the configured
// CORS allowlist. Same-origin browser requests always send Origin on
// non-GET, and our SPA always runs cross-origin in production, so this is
// satisfied by the legitimate clients.
//
// In development (CORS_ORIGIN unset) we keep the guard off so curl, Postman
// and the Replit preview proxy continue to work.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

const allowedOriginSet = new Set(corsOriginList);

function csrfOriginGuard(req: Request, res: Response, next: NextFunction): void {
  // No allowlist configured (dev) → guard disabled.
  if (allowedOriginSet.size === 0) return next();
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.path === "/healthz") return next();

  const originHeader =
    normalizeOrigin(req.headers.origin as string | undefined) ??
    normalizeOrigin(req.headers.referer as string | undefined);

  if (originHeader && allowedOriginSet.has(originHeader)) {
    return next();
  }

  req.log?.warn(
    { origin: req.headers.origin, referer: req.headers.referer, path: req.path, method: req.method },
    "CSRF guard rejected request",
  );
  res.status(403).json({ error: "Origen no permitido para esta operación" });
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// CSRF guard runs BEFORE attachUser so we never even attempt to look up the
// session for a forged cross-origin request.
app.use(csrfOriginGuard);
app.use(attachUser);

app.use("/api", router);

// Centralized error handler
app.use((err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  req.log?.error({ err }, "Unhandled error");
  if (res.headersSent) return;
  const message = err instanceof Error ? err.message : "Error interno";
  res.status(500).json({ error: message });
});

export default app;
