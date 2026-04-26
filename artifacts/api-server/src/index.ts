import app from "./app";
import { logger } from "./lib/logger";

// 1. Definimos un puerto por defecto (8080) si no existe la variable
const port = Number(process.env.PORT) || 8080;

// 2. Quitamos los "throws" que detienen el servidor para que siempre intente arrancar
app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "🚀 Servidor de Tiempo Libre iniciado correctamente");
}).on('error', (err) => {
  logger.error({ err }, "❌ Error al iniciar el servidor");
  process.exit(1);
});