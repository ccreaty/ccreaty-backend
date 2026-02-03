import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Cargar variables de entorno
dotenv.config();

// Validación básica
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY no está definida");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Ruta raíz (health check)
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "CCREATY backend activo 🚀"
  });
});

// Ruta de prueba Gemini (TEXTO)
app.get("/test-gemini", async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });

    const result = await model.generateContent(
      "Dame 3 ángulos de venta para un suplemento natural para hombres"
    );

    res.json({
      success: true,
      result: result.response.text()
    });
  } catch (error) {
    console.error("❌ Error Gemini:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Levantar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});
