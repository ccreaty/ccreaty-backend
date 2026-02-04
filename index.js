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
   GEMINI IMAGE TEST
====================== */
app.get("/test-image", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY no configurada",
      });
    }

    const prompt =
      "Fotografía realista de un frasco de suplemento natural para hombres, fondo blanco, iluminación profesional, estilo ecommerce";

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-image:generateContent?key=" +
        process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: data,
      });
    }

    const imageBase64 =
      data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!imageBase64) {
      return res.status(500).json({
        success: false,
        error: "No se generó imagen (no llegó inlineData)",
        raw: data,
      });
    }

    res.json({
      success: true,
      image_base64: imageBase64,
    });
  } catch (error) {
    console.error("❌ Error Imagen Gemini:", error);
    res.status(500).json({
      success: false,
      error: error.message,
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
