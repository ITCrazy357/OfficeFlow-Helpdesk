"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerService = registerService;
exports.loginService = loginService;
exports.getMeService = getMeService;
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = require("../../config/prisma");
const jwt_1 = require("../../utils/jwt");
const AppError_1 = require("../../utils/AppError");
async function registerService(input) {
    const existedUser = await prisma_1.prisma.user.findUnique({
        where: { email: input.email },
    });
    if (existedUser) {
        throw new AppError_1.AppError("Email already exists", 400);
    }
    const passwordHash = await bcrypt_1.default.hash(input.password, 10);
    const user = await prisma_1.prisma.user.create({
        data: {
            name: input.name,
            email: input.email,
            passwordHash,
            departmentId: input.departmentId,
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            departmentId: true,
            createdAt: true,
        },
    });
    return user;
}
//
async function loginService(input) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { email: input.email },
    });
    if (!user) {
        throw new AppError_1.AppError("Invalid email or password", 400);
    }
    if (user.isActive === false) {
        throw new AppError_1.AppError("Account is inactive", 400);
    }
    const passwordMatch = await bcrypt_1.default.compare(input.password, user.passwordHash);
    if (!passwordMatch) {
        throw new AppError_1.AppError("Invalid email or password", 400);
    }
    const accessToken = (0, jwt_1.signAccessToken)({
        userId: user.id,
        role: user.role,
    });
    const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        departmentId: user.departmentId,
        createdAt: user.createdAt,
    };
    return { accessToken, user: safeUser };
}
async function getMeService(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            department: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });
    if (!user) {
        throw new AppError_1.AppError("User not found", 404);
    }
    return user;
}
