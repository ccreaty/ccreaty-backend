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

  return { imageBase64, raw: data };
}

/* ======================
   IMAGE GENERATION (IMAGEN 3) - TEST
====================== */
app.get("/test-image", async (req, res) => {
  try {
    const prompt =
      "Foto publicitaria realista de un frasco de suplemento natural para hombres, fondo blanco, iluminación profesional, estilo ecommerce premium";

    const { imageBase64 } = await callImagen3({ prompt, sampleCount: 1 });

    res.json({
      success: true,
      image_base64: imageBase64,
    });
  } catch (error) {
    console.error("❌ Image test error:", error?.details || error);
    res.status(500).json({
      success: false,
      error: error?.details || error?.message || "Error desconocido",
    });
  }
});

/* ======================
   IMAGE GENERATION (IMAGEN 3) - DYNAMIC
   POST /generate-image
====================== */
app.post("/generate-image", async (req, res) => {
  try {
    const {
      productName = "Supplement",
      productType = "natural supplement",
      style = "ecommerce premium",
      background = "white background",
      colors = "neutral tones",
      vibe = "ultra realistic, professional lighting, sharp focus",
      extra = "",
    } = req.body || {};

    const prompt = buildImagenPrompt({
      productName,
      productType,
      style,
      background,
      colors,
      vibe,
      extra,
    });

    const { imageBase64 } = await callImagen3({ prompt, sampleCount: 1 });

    res.json({
      success: true,
      prompt_used: prompt,
      image_base64: imageBase64,
    });
  } catch (error) {
    console.error("❌ Dynamic image error:", error?.details || error);
    res.status(500).json({
      success: false,
      error: error?.details || error?.message || "Error desconocido",
    });
  }
});

/* ======================
   LANDING: GENERATE ONE SECTION AT A TIME (prevents 413 + concurrency issues)
   POST /generate-landing-section
   Body: { sectionName, productContext, style?, background?, colors?, vibe?, extra? }
====================== */
app.post("/generate-landing-section", async (req, res) => {
  try {
    const {
      sectionName = "Section",
      productContext = "natural supplement",
      style = "ecommerce premium",
      background = "white background",
      colors = "neutral tones",
      vibe = "ultra realistic, professional lighting, sharp focus",
      extra = "",
    } = req.body || {};

    const prompt = [
      "High-quality, ultra realistic ecommerce landing section image.",
      `Landing section: ${sectionName}.`,
      `Product context: ${productContext}.`,
      `Style: ${style}.`,
      `Background: ${background}.`,
      `Color palette: ${colors}.`,
      `Mood: ${vibe}.`,
      extra ? `Extra instructions: ${extra}.` : "",
      "No text on image, no logos added, premium ecommerce look, professional studio lighting, sharp focus, realistic shadows.",
    ]
      .filter(Boolean)
      .join(" ");

    const { imageBase64 } = await callImagen3({ prompt, sampleCount: 1 });

    res.json({
      success: true,
      sectionName,
      prompt_used: prompt,
      image_base64: imageBase64,
    });
  } catch (error) {
    console.error("❌ Landing section error:", error?.details || error);
    res.status(500).json({
      success: false,
      error: error?.details || error?.message || "Error desconocido",
    });
  }
});

/* ======================
   RUNWAY HELPERS
====================== */
function requireRunwayEnv() {
  if (!process.env.RUNWAY_API_KEY) {
    throw new Error("Falta RUNWAY_API_KEY en Railway");
  }
  // RUNWAY_API_VERSION recommended as a fixed date string (you already have it set)
  if (!process.env.RUNWAY_API_VERSION) {
    throw new Error("Falta RUNWAY_API_VERSION en Railway");
  }
}

function mapAspectToRunwayRatio(aspect) {
  // Allowed by Runway validation (from your error)
  // "1280:720","720:1280","1104:832","832:1104","960:960","1584:672"
  const a = (aspect || "").toLowerCase().trim();

  // Accept if user passes an allowed ratio already
  const allowed = new Set(["1280:720", "720:1280", "1104:832", "832:1104", "960:960", "1584:672"]);
  if (allowed.has(a)) return a;

  // Common UI names
  if (a === "square" || a === "1:1") return "960:960";
  if (a === "vertical" || a === "9:16" || a === "story" || a === "reel") return "720:1280";
  if (a === "horizontal" || a === "16:9") return "1280:720";
  if (a === "4:5") return "832:1104";

  // Default: vertical (best for ads)
  return "720:1280";
}

async function runwayRequest(path, { method = "GET", body } = {}) {
  requireRunwayEnv();

  const base = "https://api.dev.runwayml.com";
  const url = `${base}${path}`;

  const headers = {
    Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
    "X-Runway-Version": process.env.RUNWAY_API_VERSION,
  };

  if (body) headers["Content-Type"] = "application/json";

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error("Runway API error");
    err.details = data;
    err.status = response.status;
    throw err;
  }

  return data;
}

/* ======================
   VIDEO: START GENERATION (Runway Image-to-Video)
   POST /generate-video
   Body:
   {
     "image_url": "https://....jpg/png",
     "prompt": "Ultra realistic ...",
     "duration": 10 or 20,
     "aspect": "vertical" | "horizontal" | "square" | "9:16" | "16:9" | "1:1" | allowed ratio
     "model": "gen4_turbo" (optional)
   }
====================== */
app.post("/generate-video", async (req, res) => {
  try {
    const {
      image_url,
      prompt = "Ultra realistic ecommerce ad video. Keep product identical. No morphing. Natural lighting. Premium look.",
      duration = 10,
      aspect = "vertical",
      model = "gen4_turbo",
    } = req.body || {};

    if (!image_url) {
      return res.status(400).json({
        success: false,
        error: "Falta image_url",
      });
    }

    const ratio = mapAspectToRunwayRatio(aspect);

    // ✅ Use promptImage in the format Runway expects (array with position: "first")
    const body = {
      model,
      promptText: prompt,
      promptImage: [{ position: "first", uri: image_url }],
      duration: Number(duration) === 20 ? 20 : 10, // force 10 or 20
      ratio,
    };

    const data = await runwayRequest("/v1/image_to_video", {
      method: "POST",
      body,
    });

    // Expected: { id: "...", ... } (or task id)
    const taskId = data?.id || data?.task_id || data?.task?.id;

    if (!taskId) {
      return res.status(500).json({
        success: false,
        error: "Runway no devolvió task id",
        raw: data,
      });
    }

    res.json({
      success: true,
      task_id: taskId,
      runway_ratio: ratio,
      runway_model: model,
    });
  } catch (error) {
    console.error("❌ Generate video error:", error?.details || error);

    res.status(error?.status || 500).json({
      success: false,
      error: error?.details || error?.message || "Error desconocido",
    });
  }
});

/* ======================
   VIDEO: CHECK STATUS (polling)
   GET /video-status/:taskId
====================== */
app.get("/video-status/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: "Falta taskId",
      });
    }

    const data = await runwayRequest(`/v1/tasks/${taskId}`, { method: "GET" });

    // Normalize response for Lovable
    res.json({
      success: true,
      status: data?.status || "UNKNOWN",
      output: data?.output || [],
      raw: data,
    });
  } catch (error) {
    console.error("❌ Video status error:", error?.details || error);

    res.status(error?.status || 500).json({
      success: false,
      error: error?.details || error?.message || "Error desconocido",
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
