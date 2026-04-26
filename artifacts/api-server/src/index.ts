import app from "./app";

const PORT = process.env.PORT || 8080;

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Servidor activo en puerto ${PORT}`);
});