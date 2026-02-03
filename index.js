import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

// Inicializar Gemini
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY no está definida");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "ccreaty-backend" });
});

// Test Gemini
app.post("/gemini/test", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt requerido" });
    }

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    res.json({ success: true, response });
  } catch (error) {
    console.error("Gemini error:", error);
    res.status(500).json({ error: "Error generando contenido" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
});

