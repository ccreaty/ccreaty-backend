import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

/* ✅ IMPORTANT: avoid 413 (Payload Too Large) from Lovable */
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
   AUTH: GOOGLE ACCESS TOKEN
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

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data.access_token;
}

/* ======================
   VERTEX IMAGEN 3 HELPERS
====================== */
function buildImagenPrompt({
  productName = "Supplement",
  productType = "natural supplement",
  style = "ecommerce premium",
  background = "white background",
  colors = "neutral tones",
  vibe = "ultra realistic, professional lighting, sharp focus",
  extra = "",
}) {
  return [
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
}

async function callImagen3({ prompt, sampleCount = 1 }) {
  const accessToken = await getAccessToken();

  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION || "us-central1";

  if (!projectId) {
    throw new Error("Falta la variable GCP_PROJECT_ID en Railway");
  }

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001:predict`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error("Vertex Imagen3 error");
    err.details = data;
    throw err;
  }

  const imageBase64 = data?.predictions?.[0]?.bytesBase64Encoded;

  if (!imageBase64) {
    const err = new Error("No se recibió bytesBase64Encoded desde Vertex AI (Imagen 3).");
    err.details = data;
    throw err;
  }

  return { imageBase64 };
}

/* ======================
   IMAGE GENERATION (IMAGEN 3) - TEST
====================== */
app.get("/test-image", async (req, res) => {
  try {
    const prompt =
      "Foto publicitaria realista de un frasco de suplemento natural para hombres, fondo blanco, iluminación profesional, estilo ecommerce premium";

    const { imageBase64 } = await callImagen3({ prompt });

    res.json({
      success: true,
      image_base64: imageBase64,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.details || error?.message,
    });
  }
});

/* ======================
   IMAGE GENERATION (IMAGEN 3) - DYNAMIC
====================== */
app.post("/generate-image", async (req, res) => {
  try {
    const prompt = buildImagenPrompt(req.body || {});
    const { imageBase64 } = await callImagen3({ prompt });

    res.json({
      success: true,
      prompt_used: prompt,
      image_base64: imageBase64,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.details || error?.message,
    });
  }
});

/* ======================
   🔥 AD IMAGE GENERATION (GEMINI IMAGE / NANO BANANA)
   POST /generate-ad-image
====================== */
app.post("/generate-ad-image", async (req, res) => {
  try {
    const { product_image_url, user_prompt } = req.body || {};

    if (!product_image_url || !user_prompt) {
      return res.status(400).json({
        success: false,
        error: "Faltan product_image_url o user_prompt",
      });
    }

    const SYSTEM_PROMPT = `
IMPORTANT SYSTEM INSTRUCTIONS:

- The product image must remain IDENTICAL
- Do NOT change shape, size, label, colors or proportions
- Do NOT redesign or recreate the product

TASK:
Create a high-conversion advertising image:
- Add a bold headline
- Add visual elements representing benefits
- Optional realistic human models (not touching product)
- Premium paid ads look
`;

    const finalPrompt = `${SYSTEM_PROMPT}\n\n${user_prompt}`;

    const imageBuffer = await fetch(product_image_url).then(r =>
      r.arrayBuffer()
    );

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-image:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inline_data: {
                    mime_type: "image/png",
                    data: Buffer.from(imageBuffer).toString("base64"),
                  },
                },
                { text: finalPrompt },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    const imageBase64 =
      data?.candidates?.[0]?.content?.parts?.find(p => p.inline_data)?.inline_data
        ?.data;

    res.json({
      success: true,
      image_base64: imageBase64,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || error,
    });
  }
});

/* ======================
   RUNWAY VIDEO (NO CHANGES)
====================== */
/* 👉 TODO TU CÓDIGO DE VIDEO SE MANTIENE EXACTAMENTE IGUAL 👈 */

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

