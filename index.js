import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "CCREATY backend activo 🚀",
  });
});

// ✅ TEST GEMINI REAL
app.get("/test-gemini", async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.0-pro",
    });

    const result = await model.generateContent(
      "Dame 3 ángulos de venta para un suplemento natural para hombres"
    );

    const text = result.response.text();

    res.json({
      success: true,
      output: text,
    });
  } catch (error) {
    console.error("❌ Error Gemini:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
