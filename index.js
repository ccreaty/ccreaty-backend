import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { VertexAI } from "@google-cloud/vertexai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// ======================
// HEALTH CHECK
// ======================
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "CCREATY backend activo 🚀",
  });
});

// ======================
// VERTEX AI IMAGE (NANO BANANA)
// ======================
app.get("/test-image", async (req, res) => {
  try {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      return res.status(500).json({
        success: false,
        error: "Credenciales de Google no configuradas",
      });
    }

    // Convertimos el JSON en credencial real
    const credentials = JSON.parse(
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    );

    const vertexAI = new VertexAI({
      project: credentials.project_id,
      location: "us-central1",
      credentials,
    });

    const model = vertexAI.getGenerativeModel({
      model: "imagegeneration@002", // Nano Banana (Imagen)
    });

    const prompt =
      "Un frasco de suplemento natural para hombres, estilo premium, fondo blanco, iluminación profesional, realista";

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    const imageBase64 =
      response.response.candidates[0].content.parts[0].inlineData.data;

    res.json({
      success: true,
      image_base64: imageBase64,
    });
  } catch (error) {
    console.error("❌ Error Imagen:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ======================
// 404 HANDLER
// ======================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Ruta no encontrada",
  });
});

// ======================
// START SERVER
// ======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
