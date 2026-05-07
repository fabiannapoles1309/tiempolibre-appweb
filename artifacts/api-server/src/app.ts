import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { attachUser } from "./middlewares/auth";

const app: Express = express();

// 🔥 CRÍTICO PARA CLOUD RUN (permite cookies seguras detrás del proxy)
app.set("trust proxy", 1);

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

// 🔥 CORS dinámico — lee FRONTEND_URL de variable de entorno
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = (process.env.FRONTEND_URL || "")
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean);
      if (allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS bloqueado: ${origin}`));
      }
    },
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔥 Lee la cookie y asigna req.user
app.use(attachUser);

// 🔥 Rutas API
app.use("/api", router);

// 🔥 Manejo de errores global
app.use((err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  req.log?.error({ err }, "Unhandled error");
  if (res.headersSent) return;
  const message = err instanceof Error ? err.message : "Error interno";
  res.status(500).json({ error: message });
});

export default app;
