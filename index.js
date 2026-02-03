import express from "express";
import cors from "cors";

const app = express();

// -------------------- MIDDLEWARE --------------------
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// -------------------- HEALTH CHECK --------------------
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "CCREATY backend activo 🚀"
  });
});

// -------------------- TEST GEMINI --------------------
app.get("/test-gemini", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY no definida en Railway"
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: "Dame 3 ángulos de venta para un suplemento natural para hombres"
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    res.json({
      success: true,
      geminiResponse: data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend CCREATY corriendo en puerto ${PORT}`);
});

