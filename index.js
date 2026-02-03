import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/* =========================
   RUTA BASE (TEST)
========================= */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "CCREATY backend activo 🚀"
  });
});

/* =========================
   TEST GEMINI REAL
========================= */
app.get("/test-gemini", async (req, res) => {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: "Dame 3 ángulos de venta para un suplemento natural para hombres" }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
});
