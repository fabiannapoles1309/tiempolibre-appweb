import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { attachUser } from "./middlewares/auth";

const app: Express = express();

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
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
