import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

/* Prevent 413 */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors());

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
   GOOGLE ACCESS TOKEN
====================== */
async function getAccessToken() {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

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
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data.access_token;
}

/* ======================
   IMAGEN 3 – CONTEXT ONLY
====================== */
async function generateContextImage(prompt) {
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
      instances: [{ prompt }],
      parameters: { sampleCount: 1 },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));

  const imageBase64 = data?.predictions?.[0]?.bytesBase64Encoded;
  if (!imageBase64) throw new Error("Imagen 3 no devolvió imagen");

  return imageBase64;
}

/* ======================
   TEST IMAGE
====================== */
app.get("/test-image", async (req, res) => {
  try {
    const prompt = `
Generate ONLY a photorealistic advertising background.
No product.
Clean studio lighting.
Premium ecommerce look.
Neutral background.
`;

    const image = await generateContextImage(prompt);
    res.json({ success: true, image_base64: image });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ======================
   GENERATE BACKGROUND (BANNER / LANDING / INSPIRATION)
====================== */
app.post("/generate-background", async (req, res) => {
  try {
    const { angle, mood, colors } = req.body || {};

    const prompt = `
IMPORTANT:
Do NOT generate any product.
The product will be added later as a fixed layer.

TASK:
Generate a high-converting advertising background.

Style:
Photorealistic
Professional ad photography
Clean visual hierarchy

Angle:
${angle || "Premium natural supplement"}

Mood:
${mood || "Trust, confidence, desire"}

Color palette:
${colors || "Neutral with premium accents"}

Leave clear space for product placement.
`;

    const image = await generateContextImage(prompt);
    res.json({ success: true, image_base64: image });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ======================
   RUNWAY VIDEO (UNCHANGED)
====================== */
/* TODO: tu código de Runway sigue igual */

/* ======================
   404
====================== */
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Ruta no encontrada" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
