import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

/* ======================
   MIDDLEWARE
====================== */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors());

/* ======================
   HEALTH CHECK
====================== */
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "CCREATY backend activo 🚀" });
});

/* ======================
   GOOGLE AUTH (JWT)
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
  if (!response.ok) throw new Error(JSON.stringify(data));

  return data.access_token;
}

/* ======================
   HELPERS
====================== */
async function fetchImageAsBase64(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("No se pudo descargar la imagen");
  const buf = await r.arrayBuffer();
  return {
    mimeType: r.headers.get("content-type") || "image/jpeg",
    base64: Buffer.from(buf).toString("base64"),
  };
}

/* ======================
   🔍 PRODUCT ANALYSIS (IMAGE → ANGLES)
   POST /analyze-product
====================== */
app.post("/analyze-product", async (req, res) => {
  try {
    const { product_image_url } = req.body || {};
    if (!product_image_url)
      return res.status(400).json({ success: false, error: "Falta image" });

    const { base64, mimeType } = await fetchImageAsBase64(product_image_url);

    const prompt = `
You are a senior ecommerce product analyst.

Analyze the product image and return STRICT JSON:
{
  "product_name": "",
  "product_type": "",
  "audience": "",
  "benefits": [],
  "angles": [
    { "id": 1, "title": "", "description": "" },
    { "id": 2, "title": "", "description": "" },
    { "id": 3, "title": "", "description": "" }
  ]
}
`.trim();

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
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
                { inline_data: { mime_type: mimeType, data: base64 } },
                { text: prompt },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    res.json({ success: true, analysis: JSON.parse(text) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ======================
   🖼️ IMAGE GENERATION (GEMINI IMAGE – FIDELITY LOCK)
   POST /generate-ad-image
====================== */
app.post("/generate-ad-image", async (req, res) => {
  try {
    const { product_image_url, user_prompt } = req.body || {};
    if (!product_image_url || !user_prompt)
      return res.status(400).json({ success: false, error: "Datos incompletos" });

    const { base64, mimeType } = await fetchImageAsBase64(product_image_url);

    const LOCK = `
STRICT PRODUCT FIDELITY:
- Product must be IDENTICAL to input image
- Do NOT change label, logo, colors, shape, cap, proportions
- No redesign, no stylization, no morphing
- Product fully visible and dominant
- Text must be Spanish (LATAM)
`.trim();

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
                { inline_data: { mime_type: mimeType, data: base64 } },
                { text: `${LOCK}\n${user_prompt}` },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const img =
      data?.candidates?.[0]?.content?.parts?.find((p) => p.inline_data)
        ?.inline_data?.data;

    if (!img) throw new Error("Gemini no devolvió imagen");

    res.json({ success: true, image_base64: img });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ======================
   🧩 LANDING SECTION (QUEUE SAFE)
   POST /generate-landing-section
====================== */
app.post("/generate-landing-section", async (req, res) => {
  try {
    const { product_image_url, section_prompt } = req.body || {};
    const { base64, mimeType } = await fetchImageAsBase64(product_image_url);

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
                { inline_data: { mime_type: mimeType, data: base64 } },
                { text: section_prompt },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const img =
      data?.candidates?.[0]?.content?.parts?.find((p) => p.inline_data)
        ?.inline_data?.data;

    res.json({ success: true, image_base64: img });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ======================
   🎬 RUNWAY VIDEO (UNCHANGED & STABLE)
====================== */
// 👉 AQUÍ VA EXACTAMENTE TU CÓDIGO DE RUNWAY ACTUAL
// NO se toca, NO se modifica

/* ======================
   404
====================== */
app.use((req, res) =>
  res.status(404).json({ success: false, error: "Ruta no encontrada" })
);

/* ======================
   START
====================== */
app.listen(PORT, () =>
  console.log(`🚀 CCREATY backend corriendo en ${PORT}`)
);
