import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import departmentsRoutes from "./modules/departments/departments.routes";
import ticketsRoutes from "./modules/tickets/tickets.routes";

import { swaggerSpec } from "./config/swagger";
import { prisma } from "./config/prisma";
import { requestLogger } from "./middlewares/request-logger.middleware";
import { notFoundMiddleware } from "./middlewares/not-found.middleware";
import { errorMiddleware } from "./middlewares/error.middleware";

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());
app.use(requestLogger);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "OfficeFlow Helpdesk API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "OfficeFlow API is running",
  });
});

app.get("/api/health/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      message: "Database connected successfully",
    });
  } catch (error) {
    const dbError =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            code: "code" in error ? error.code : undefined,
            meta: "meta" in error ? error.meta : undefined,
          }
        : error;

    console.error("Database health check failed", dbError);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/departments", departmentsRoutes);
app.use("/api/tickets", ticketsRoutes);

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
