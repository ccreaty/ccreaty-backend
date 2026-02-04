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
   IMAGE GENERATION (IMAGEN 3) - TEST
====================== */
app.get("/test-image", async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION || "us-central1";

    if (!projectId) {
      return res.status(500).json({
        success: false,
        error: "Falta la variable GCP_PROJECT_ID en Railway",
      });
    }

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

    const imageBase64 = data.predictions?.[0]?.bytesBase64Encoded;

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
   IMAGE GENERATION (IMAGEN 3) - DYNAMIC
====================== */
app.post("/generate-image", async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION || "us-central1";

    if (!projectId) {
      return res.status(500).json({
        success: false,
        error: "Falta la variable GCP_PROJECT_ID en Railway",
      });
    }

    const {
      productName = "Supplement",
      productType = "natural supplement",
      style = "ecommerce premium",
      background = "white background",
      colors = "neutral tones",
      vibe = "ultra realistic, professional lighting, sharp focus",
      extra = "",
    } = req.body || {};

    const prompt = [
      "High-quality, ultra realistic product advertising photo.",
      `Product name: ${productName}.`,
      `Product type: ${productType}.`,
      `Style: ${style}.`,
      `Background: ${background}.`,
      `Color palette: ${colors}.`,
      `Mood: ${vibe}.`,
      extra ? `Extra instructions: ${extra}.` : "",
      "Professional studio lighting, sharp focus, realistic shadows, no cartoon, no illustration, no text on image, premium ecommerce look.",
    ]
      .filter(Boolean)
      .join(" ");

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001:predict`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1 },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: data,
        prompt_used: prompt,
      });
    }

    const imageBase64 = data.predictions?.[0]?.bytesBase64Encoded;

    if (!imageBase64) {
      return res.status(500).json({
        success: false,
        error: "No se recibió bytesBase64Encoded desde Vertex AI",
        raw: data,
        prompt_used: prompt,
      });
    }

    res.json({
      success: true,
      prompt_used: prompt,
      image_base64: imageBase64,
    });
  } catch (error) {
    console.error("❌ Dynamic image error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/* ======================
   VIDEO GENERATION (RUNWAY)
====================== */
app.post("/generate-video", async (req, res) => {
  try {
    const { image_url, prompt, duration = 10 } = req.body;

    if (!image_url || !prompt) {
      return res.status(400).json({
        success: false,
        error: "Faltan image_url o prompt",
      });
    }

    const runwayResponse = await fetch(
      "https://api.dev.runwayml.com/v1/image_to_video",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
          "Content-Type": "application/json",
          "X-Runway-Version": "2024-11-06",
        },
        body: JSON.stringify({
          model: "gen4_turbo",
          promptImage: image_url,
          promptText: prompt,
          duration: duration,
        }),
      }
    );

    const data = await runwayResponse.json();

    if (!runwayResponse.ok) {
      return res.status(500).json({
        success: false,
        error: data,
      });
    }

    res.json({
      success: true,
      task_id: data.id,
    });
  } catch (error) {
    console.error("❌ Runway video error:", error);
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
   START SERVER
====================== */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
