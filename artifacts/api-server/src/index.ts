import app from "./app";
import { logger } from "./lib/logger";

const port = process.env.PORT || "8080";

app.listen(Number(port), "0.0.0.0", () => {
  logger.info({ port }, "🚀 Servidor Tiempo Libre Activo");
});