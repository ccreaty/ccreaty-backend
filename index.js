import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Modelo estable para API Key (Generative Language API)
const MODEL = process.env.GEMINI_MODEL || "gemini-1.0-pro";

app.use(cors());
app.use(express.json());

/* ======================
   HEALTH CHECK
====================== */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "CCREATY backend activo 🚀",
    model: MODEL,
    hasKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

/* ======================
   GEMINI TEST (REST v1)
====================== */
app.get("/test-gemini", async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;

    if (!key) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY no configurada en Railway",
      });
    }

    const url =
      `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=` +
      encodeURIComponent(key);

    const payload = {
      contents: [
        {
          parts: [
            {
              text: "Dame 3 ángulos de venta para un suplemento natural para hombres",
            },
          ],
        },
      ],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    // Log completo en Railway para ver qué está pasando
    console.log("✅ Gemini request model:", MODEL);
    console.log("✅ Gemini response status:", response.status);
    console.log("✅ Gemini response body:", JSON.stringify(data));

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        model: MODEL,
        status: response.status,
        error: data,
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "(Sin texto en respuesta)";

    res.json({ success: true, model: MODEL, result: text });
  } catch (error) {
    console.error("❌ Error Gemini catch:", error);
    res.status(500).json({
      success: false,
      model: MODEL,
      error: error?.message || String(error),
    });
  }
});

/* ======================
   404 HANDLER
====================== */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Ruta no encontrada",
  });
});

/* ======================
   START SERVER
====================== */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🧠 Gemini MODEL: ${MODEL}`);
});
