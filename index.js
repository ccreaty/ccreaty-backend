import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";

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
   TEST IMAGE (VERTEX AI IMAGEN)
====================== */
app.get("/test-image", async (req, res) => {
  try {
    const auth = new GoogleAuth({
      credentials: JSON.parse(
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
      ),
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION || "us-central1";

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagegeneration@006:predict`;

    const body = {
      instances: [
        {
          prompt: "Foto realista de un suplemento natural premium sobre fondo blanco, estilo e-commerce",
        },
      ],
      parameters: {
        sampleCount: 1,
      },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: data,
      });
    }

    const base64Image = data.predictions[0].bytesBase64Encoded;

    res.json({
      success: true,
      image_base64: base64Image,
    });
  } catch (error) {
    console.error("❌ Error Imagen:", error);
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
