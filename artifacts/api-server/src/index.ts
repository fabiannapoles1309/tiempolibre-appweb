import app from "./app";
  import { logger } from "./lib/logger";

  // Google Cloud usa el puerto 8080 por defecto
  const port = process.env.PORT || "8080";

  // Escuchar en 0.0.0.0 es la clave para que Google Cloud Run acepte la conexión
  app.listen(Number(port), "0.0.0.0", () => {
    logger.info({ port }, "🚀 Servidor de Tiempo Libre encendido y listo");
  }).on('error', (err) => {
    logger.error({ err }, "❌ Error al iniciar el servidor");
    process.exit(1);
  });