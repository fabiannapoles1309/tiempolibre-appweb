import { reportsRouter } from "./routes/reports";
import app from "./app";
import { logger } from "./lib/logger";

// 1. Le decimos que use el puerto de Google Cloud, o el 8080 por defecto
const rawPort = process.env["PORT"] || "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// 2. Agregamos "0.0.0.0" para que Google Cloud Run tenga permiso de conectarse
app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening on port " + port);
});
