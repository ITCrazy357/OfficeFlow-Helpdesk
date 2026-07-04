import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./config/prisma";

//Router
import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import departmentsRoutes from "./modules/departments/departments.routes";
import ticketsRoutes from "./modules/tickets/tickets.routes";

//swagger
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";

//middleware
import { notFoundMiddleware } from "./middlewares/not-found.middleware";
import { errorMiddleware } from "./middlewares/error.middleware";
import { requestLogger } from "./middlewares/request-logger.middleware";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/departments", departmentsRoutes);
app.use("/api/tickets", ticketsRoutes);

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

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Error handling middleware
app.use(notFoundMiddleware);
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`API is running on port ${PORT} 🚀🚀🚀`);
});
