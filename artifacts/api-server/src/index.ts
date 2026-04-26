import express from "express";

const app = express();

const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Servidor activo en puerto ${PORT}`);
});
