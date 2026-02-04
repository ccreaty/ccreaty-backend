import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";

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
   AUTH: GOOGLE ACCESS TOKEN
====================== */
async function getAccessToken() {
  const credentials = JSON.parse(
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  );

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: credentials.token_uri,
    exp: now + 3600,
    iat: now,
  };

  const token = jwt.sign(payload, credentials.private_key, {
    algorithm: "RS256",
  });

  const response = await fetch(credentials.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: token,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data.access_token;
}

/* ======================
   IMAGE GENERATION (IMAGEN 3)
====================== */
app.get("/test-image", async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION || "us-central1";

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001:predict`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt:
              "Foto publicitaria realista de un frasco de suplemento natural para hombres, fondo blanco, iluminación profesional, estilo ecommerce premium",
          },
        ],
        parameters: {
          sampleCount: 1,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: data,
      });
    }

    const imageBase64 =
      data.predictions?.[0]?.bytesBase64Encoded;

    res.json({
      success: true,
      image_base64: imageBase64,
    });
  } catch (error) {
    console.error("❌ Image error:", error);
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
