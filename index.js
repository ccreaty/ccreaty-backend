import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

/* ======================
   UTILS
====================== */
function generateId() {
  return crypto.randomUUID();
}

/* ======================
   HEALTH CHECK
====================== */
app.get("/", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    message: "CCREATY backend activo 🚀",
  });
});

/* ======================
   GOOGLE AUTH (IMAGEN 3)
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
app.post("/generate-image", async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION || "us-central1";

    if (!projectId) {
      return res.status(500).json({
        success: false,
        error: "Missing GCP_PROJECT_ID",
      });
    }

    const {
      productName = "Supplement",
      productType = "natural supplement",
      style = "ecommerce premium",
      background = "white background",
      colors = "neutral tones",
      vibe = "ultra realistic, professional lighting",
      extra = "",
    } = req.body || {};

    const prompt = [
      "Ultra realistic product photography.",
      `Product name: ${productName}.`,
      `Product type: ${productType}.`,
      `Style: ${style}.`,
      `Background: ${background}.`,
      `Color palette: ${colors}.`,
      `Mood: ${vibe}.`,
      extra ? `Extra: ${extra}.` : "",
      "No text, no illustration, no distortion. Ecommerce quality.",
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
        prompt,
      });
    }

    const imageBase64 = data.predictions?.[0]?.bytesBase64Encoded;

    res.json({
      success: true,
      id: generateId(),
      image_base64: imageBase64,
      prompt_used: prompt,
    });
  } catch (error) {
    console.error("❌iff Image error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/* ======================
   RUNWAY – GENERATE VIDEO
====================== */
app.post("/generate-video", async (req, res) => {
  try {
    const {
      image_url,
      prompt,
      duration = 10,
      ratio = "720:1280",
    } = req.body;

    if (!image_url || !prompt) {
      return res.status(400).json({
        success: false,
        error: "image_url and prompt are required",
      });
    }

    const runwayRes = await fetch(
      "https://api.dev.runwayml.com/v1/image_to_video",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
          "Content-Type": "application/json",
          "X-Runway-Version": process.env.RUNWAY_API_VERSION,
        },
        body: JSON.stringify({
          model: "gen4_turbo",
          promptImage: image_url,
          promptText: prompt,
          duration,
          ratio,
        }),
      }
    );

    const data = await runwayRes.json();

    if (!runwayRes.ok) {
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
    console.error("❌ Video generation error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/* ======================
   RUNWAY – VIDEO STATUS
====================== */
app.get("/video-status/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;

    const response = await fetch(
      `https://api.dev.runwayml.com/v1/tasks/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
          "X-Runway-Version": process.env.RUNWAY_API_VERSION,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: data,
      });
    }

    res.json({
      success: true,
      status: data.status,
      output: data.output || null,
    });
  } catch (error) {
    console.error("❌ Video status error:", error);
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
    error: "Route not found",
  });
});

/* ======================
   START SERVER
====================== */
app.listen(PORT, () => {
  console.log(`🚀 CCREATY backend running on port ${PORT}`);
});
