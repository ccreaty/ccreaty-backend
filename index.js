const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

/* ===========================
   MIDDLEWARE
=========================== */
app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* ===========================
   HEALTH CHECK (OBLIGATORIO)
=========================== */
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "CCREATY backend activo 🚀"
  });
});

/* ===========================
   MEMORY STORE (TEMPORAL)
   Luego esto va a DB
=========================== */
const jobs = {};

/* ===========================
   ANALYZE ENDPOINT
=========================== */
app.post("/analyze", async (req, res) => {
  try {
    const { projectId, imageUrl } = req.body;

    if (!projectId || !imageUrl) {
      return res.status(400).json({
        status: "error",
        message: "projectId and imageUrl are required"
      });
    }

    // RESPUESTA MOCK (PRUEBA)
    const analysisId = crypto.randomUUID();

    return res.status(200).json({
      analysisId,
      productAnalysis: {
        whatItIs: "Liquid Vitamin B Complex",
        mainProblem: "Low energy and vitamin deficiency",
        mainDesire: "More daily energy and mental clarity",
        idealCustomer: "Adults looking to improve energy levels"
      },
      winningAngles: [
        {
          id: "angle_1",
          angleName: "Daily Energy Boost",
          hook: "Feel energized in minutes",
          coreEmotion: "Desire"
        },
        {
          id: "angle_2",
          angleName: "Mental Clarity",
          hook: "Clear your mind naturally",
          coreEmotion: "Confidence"
        },
        {
          id: "angle_3",
          angleName: "Vitamin Deficiency Solution",
          hook: "Your body needs this",
          coreEmotion: "Fear"
        }
      ]
    });
  } catch (err) {
    console.error("Analyze error:", err);
    return res.status(500).json({
      status: "error",
      message: "Analyze failed"
    });
  }
});

/* ===========================
   GENERATE ENDPOINT (ASYNC JOB)
=========================== */
app.post("/generate", async (req, res) => {
  try {
    const { projectId, analysisId, selectedAngleId, task } = req.body;

    if (!projectId || !analysisId || !selectedAngleId || !task) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields"
      });
    }

    const jobId = crypto.randomUUID();

    // Crear job
    jobs[jobId] = {
      status: "pending",
      task,
      createdAt: Date.now()
    };

    // Simular procesamiento async
    setTimeout(() => {
      jobs[jobId].status = "done";

      if (task === "image") {
        jobs[jobId].result = {
          imageUrl:
            "https://via.placeholder.com/600x600.png?text=Generated+Image"
        };
      }

      if (task === "video") {
        jobs[jobId].result = {
          videoUrl:
            "https://www.w3schools.com/html/mov_bbb.mp4"
        };
      }

      if (task === "landing") {
        jobs[jobId].result = {
          landingSections: [
            "Hero",
            "BeforeAfter",
            "Benefits",
            "Ingredients",
            "Offer",
            "HowToUse",
            "ProductAsSolution"
          ]
        };
      }
    }, 5000); // 5s fake processing

    return res.status(200).json({
      jobId,
      status: "pending"
    });
  } catch (err) {
    console.error("Generate error:", err);
    return res.status(500).json({
      status: "error",
      message: "Generate failed"
    });
  }
});

/* ===========================
   JOB STATUS ENDPOINT
=========================== */
app.get("/job/:id", (req, res) => {
  const job = jobs[req.params.id];

  if (!job) {
    return res.status(404).json({
      status: "error",
      message: "Job not found"
    });
  }

  return res.status(200).json(job);
});

/* ===========================
   SERVER START (RAILWAY)
=========================== */
const PORT = process.env.PORT;

if (!PORT) {
  console.error("❌ PORT no definido");
  process.exit(1);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend escuchando en puerto ${PORT}`);
});
