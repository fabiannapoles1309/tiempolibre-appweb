import app from "./app";
import { logger } from "./lib/logger";

const port = process.env.PORT || "8080";

app.listen(Number(port), "0.0.0.0", () => {
  logger.info({ port }, "🚀 Servidor de Tiempo Libre encendido y listo");
}).on('error', (err) => {
  logger.error({ err }, "❌ Error al iniciar el servidor");
  process.exit(1);
});
