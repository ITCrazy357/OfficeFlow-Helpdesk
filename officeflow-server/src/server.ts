import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./config/prisma";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "OfficeFlow API is running 🚀🚀🚀",
  });
});

app.get("/api/db-health", async (req, res) => {
  try {
    const departments = await prisma.department.findMany();

    res.json({
      success: true,
      message: "Database connected successfully 🚀🚀🚀",
      data: departments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`API is running on port ${PORT} 🚀🚀🚀`);
});
