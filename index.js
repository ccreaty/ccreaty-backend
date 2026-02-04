import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

/* ======================================================
   IN-MEMORY STORES (STABLE & EXPLICIT)
   ====================================================== */

// Projects store
const projects = new Map();

// Jobs store (locks PER JOB, not per project)
const jobs = new Map();

/* ======================================================
   HEALTH CHECK
   ====================================================== */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "CCREATY backend activo 🚀",
  });
});

/* ======================================================
   GOOGLE ACCESS TOKEN (IMAGEN 3)
   ====================================================== */
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

/* ======================================================
   PROJECT INITIALIZATION (ONE PER PRODUCT)
   ====================================================== */
function getOrCreateProject(projectId, originalImageUrl) {
  if (!projects.has(projectId)) {
    projects.set(projectId, {
      projectId,
      originalImageUrl,
      runwayImageUrl: null,
      createdAt: Date.now(),
    });
  }
  return projects.get(projectId);
}

/* ======================================================
   JOB LOCKING (NO GLOBAL LOCKS)
   ====================================================== */
function startJob(jobId) {
  jobs.set(jobId, { status: "running", startedAt: Date.now() });
}

function finishJob(jobId) {
  jobs.set(jobId, { status: "done", finishedAt: Date.now() });
}

/* ======================================================
   IMAGE GENERATION (IMAGEN 3)
   ====================================================== */
app.post("/generate-image", async (req, res) => {
  const jobId = uuidv4();
  startJob(jobId);

  try {
    const accessToken = await getAccessToken();
    const projectId = req.body.projectId || "default-project";

    const project = getOrCreateProject(
      projectId,
      req.body.originalImageUrl || null
    );

    const {
      prompt = "Ultra realistic ecommerce product image",
    } = req.body;

    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${process.env.GCP_PROJECT_ID}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`;

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
      throw new Error(JSON.stringify(data));
    }

    finishJob(jobId);

    res.json({
      success: true,
      jobId,
      image_base64: data.predictions?.[0]?.bytesBase64Encoded,
    });
  } catch (error) {
    finishJob(jobId);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/* ======================================================
   LANDING GENERATION (SEQUENTIAL SECTIONS)
   ====================================================== */
app.post("/generate-landing-section", async (req, res) => {
  const jobId = uuidv4();
  startJob(jobId);

  try {
    const { projectId, sectionName, prompt } = req.body;

    if (!sectionName) {
      throw new Error("Missing sectionName");
    }

    const accessToken = await getAccessToken();
    const project = getOrCreateProject(projectId);

    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${process.env.GCP_PROJECT_ID}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`;

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
      throw new Error(JSON.stringify(data));
    }

    finishJob(jobId);

    res.json({
      success: true,
      section: sectionName,
      image_base64: data.predictions?.[0]?.bytesBase64Encoded,
    });
  } catch (error) {
    finishJob(jobId);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/* ======================================================
   VIDEO GENERATION (RUNWAY – STABLE FLOW)
   ====================================================== */
app.post("/generate-video", async (req, res) => {
  const jobId = uuidv4();
  startJob(jobId);

  try {
    const { projectId, promptText, duration, ratio } = req.body;

    const project = getOrCreateProject(projectId);

    if (!project.runwayImageUrl) {
      project.runwayImageUrl = project.originalImageUrl;
    }

    const response = await fetch(
      "https://api.runwayml.com/v1/image_to_video",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          promptImage: project.runwayImageUrl,
          promptText,
          duration,
          ratio,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }

    finishJob(jobId);

    res.json({
      success: true,
      task_id: data.id || data.task_id,
    });
  } catch (error) {
    finishJob(jobId);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/* ======================================================
   404
   ====================================================== */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Ruta no encontrada",
  });
});

/* ======================================================
   START SERVER
   ====================================================== */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
