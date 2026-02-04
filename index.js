import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// MODELO ACTIVO ACTUAL (API KEY)
const MODEL = "gemini-2.0-flash";

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
   GEMINI TEST (FINAL)
====================== */
app.get("/test-gemini", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY no configurada",
      });
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Dame 3 ángulos de venta para un suplemento natural para hombres",
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        model: MODEL,
        error: data,
      });
    }

    res.json({
      success: true,
      model: MODEL,
      result: data.candidates[0].content.parts[0].text,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/* ======================
   404
====================== */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Ruta no encontrada",
  });
});

/* ======================
   START
====================== */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
