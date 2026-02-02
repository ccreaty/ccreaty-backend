const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// RUTA RAÍZ (OBLIGATORIA)
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "CCREATY backend activo 🚀"
  });
});

// RAILWAY PORT (CRÍTICO)
const PORT = process.env.PORT;

if (!PORT) {
  console.error("❌ PORT no definido");
  process.exit(1);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend escuchando en puerto ${PORT}`);
});
