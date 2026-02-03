require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

// -------------------- MIDDLEWARE --------------------
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Evita requests colgados
app.use((req, res, next) => {
  res.setTimeout(120000); // 120 segundos
  next();
});

// -------------------- HEALTH CHECK --------------------
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Backend CCREATY activo 🚀",
    timestamp: new Date().toISOString()
  });
});

// -------------------- ASK (copys / texto) --------------------
app.post("/ask", (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== "string") {
    return res.status(400).json({
      status: "error",
      message: "El campo 'question' es obligatorio"
    });
  }

  res.json({
    status: "ok",
    answer: `Pregunta recibida: ${question}`
  });
});

// -------------------- ANALYZE PRODUCT --------------------
app.post("/analyze", (req, res) => {
  const { projectId, imageUrl } = req.body;

  if (!projectId || !imageUrl) {
    return res.status(400).json({
      status: "error",
      message: "Faltan campos: projectId o imageUrl"
    });
  }

  // Respuesta MOCK para que el frontend no se quede cargando
  res.json({
    status: "ok",
    analysisId: `analysis_${Date.now()}`,
    productAnalysis: {
      summary: "Producto recibido y analizado correctamente.",
      notes: [
        "Este es un análisis simulado.",
        "Aquí se conectará Gemini más adelante."
      ]
    },
    winningAngles: [
      {
        id: "angle_1",
        title: "Beneficio principal",
        hook: "Descubre el secreto que nadie te cuenta",
        promise: "Resultados visibles en poco tiempo"
      },
      {
        id: "angle_2",
        title: "Prueba social",
        hook: "Miles ya lo están usando",
        promise: "Confianza real y comprobada"
      },
      {
        id: "angle_3",
        title: "Urgencia",
        hook: "Últimas unidades disponibles",
        promise: "No te quedes por fuera"
      }
    ]
  });
});

// -------------------- IMAGE GENERATION (placeholder Gemini) --------------------
app.post("/ai/image", (req, res) => {
  const { prompt, referenceImage } = req.body;

  if (!prompt) {
    return res.status(400).json({
      status: "error",
      message: "El campo 'prompt' es obligatorio"
    });
  }

  res.json({
    status: "ok",
    jobId: `img_${Date.now()}`,
    message: "Generación de imagen en proceso (simulada)",
    prompt,
    referenceImage: referenceImage || null
  });
});

// -------------------- 404 --------------------
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: `Ruta no encontrada: ${req.method} ${req.path}`
  });
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor activo en puerto ${PORT}`);
});

