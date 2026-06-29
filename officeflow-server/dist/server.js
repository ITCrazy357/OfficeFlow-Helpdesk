"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const prisma_1 = require("./config/prisma");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/api/auth", auth_routes_1.default);
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "OfficeFlow API is running 🚀🚀🚀",
    });
});
app.get("/api/db-health", async (req, res) => {
    try {
        const departments = await prisma_1.prisma.department.findMany();
        res.json({
            success: true,
            message: "Database connected successfully 🚀🚀🚀",
            data: departments,
        });
    }
    catch (error) {
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
