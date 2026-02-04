import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

/* ======================
   HEALTH CHECK
====================== */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "CCREATY backend activo 🚀",
  });
});

/* ======================
   GEMINI TEST (REST v1 – ESTABLE)
====================== */
app.get("/test-gemini", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY no configurada",
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=" +
        process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: data,
      });
    }

    res.json({
      success: true,
      result: data.candidates[0].content.parts[0].text,
    });
  } catch (error) {
    console.error("❌ Error Gemini:", error);
    res.status(500).json({
      success: false,
      error: error.message,
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
});
