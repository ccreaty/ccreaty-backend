import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

/* ======================
   MIDDLEWARE
====================== */
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
   GEMINI TEST ROUTE
====================== */
app.get("/test-gemini", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY no está configurada en Railway",
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // ✅ MODELO CORRECTO Y ACTUAL
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest",
    });

    const result = await model.generateContent(
      "Dame 3 ángulos de venta para un suplemento natural para hombres"
    );

    const response = result.response.text();

    res.json({
      success: true,
      result: response,
    });
  } catch (error) {
    console.error("❌ Error Gemini:", error.message);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/* ======================
   404 HANDLER
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
