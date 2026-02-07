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
async function fetchImageAsBase64(url) {
  const imgResp = await fetch(url);

  if (!imgResp.ok) {
    throw new Error(`No se pudo descargar product_image_url (${imgResp.status})`);
  }

  const contentType = imgResp.headers.get("content-type") || "image/jpeg";
  const buf = await imgResp.arrayBuffer();

  return {
    mimeType: contentType,
    base64: Buffer.from(buf).toString("base64"),
  };
}

function assertHttpsUrl(u) {
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error("product_image_url inválido (no es URL válida)");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("product_image_url debe ser https");
  }
  return parsed;
}

app.post("/generate-ad-image", async (req, res) => {
  try {
    const { product_image_url, user_prompt } = req.body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Missing GEMINI_API_KEY in Railway env vars",
      });
    }

    if (!product_image_url || !user_prompt) {
      return res.status(400).json({
        success: false,
        error: "Faltan product_image_url o user_prompt",
      });
    }

    // Basic URL validation (avoid weird inputs)
    assertHttpsUrl(product_image_url);

    // ✅ Prompt template corto + fidelity lock (siempre aplicado)
    const FIDELITY_LOCK_SHORT = `
PRODUCT FIDELITY LOCK (STRICT):
Keep the product EXACTLY identical to the input photo. Do not change label, logo, typography, colors, materials, reflections, shape, proportions, cap, or packaging. No redesign. No stylization (no 3D/cartoon/illustration). No warp/morph/blur/stretch. Product must be fully visible and dominant. If any risk of altering the product, simplify the scene and preserve the original product unchanged.
All on-image marketing text must be in Spanish (neutral LATAM).
Photorealistic commercial ad photoshoot, high-converting, clean visual hierarchy, no AI artifacts.
`.trim();

    const finalPrompt = `${FIDELITY_LOCK_SHORT}\n\nUSER REQUEST:\n${user_prompt}`.trim();

    // ✅ Download reference image and keep correct mime type
    const { mimeType, base64 } = await fetchImageAsBase64(product_image_url);

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
                    mime_type: mimeType,
                    data: base64,
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

    // ✅ Surface provider errors clearly
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data,
      });
    }

    const imageBase64 =
      data?.candidates?.[0]?.content?.parts?.find((p) => p.inline_data)?.inline_data?.data;

    if (!imageBase64) {
      return res.status(502).json({
        success: false,
        error: "Gemini no devolvió image_base64 (inline_data).",
        raw: data,
      });
    }

    return res.json({
      success: true,
      image_base64: imageBase64,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || String(error),
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

