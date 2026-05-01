import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { attachUser } from "./middlewares/auth";

const app: Express = express();

// ðŸ”¥ CRÃTICO PARA CLOUD RUN (permite cookies seguras detrás del proxy)
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

// ðŸ”¥ CORS configurado correctamente para tu frontend
app.use(
  cors({
    origin: "https://tiempolibre-web-612959916526.us-central1.run.app",
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ðŸ”¥ Lee la cookie y asigna req.user
app.use(attachUser);

// ðŸ”¥ Rutas API
app.use("/api", router);

// ðŸ”¥ Manejo de errores global
app.use((err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  req.log?.error({ err }, "Unhandled error");
  if (res.headersSent) return;
  const message = err instanceof Error ? err.message : "Error interno";
  res.status(500).json({ error: message });
});

export default app;