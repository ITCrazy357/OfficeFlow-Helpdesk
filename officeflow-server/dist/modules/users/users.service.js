"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsersService = getUsersService;
const prisma_1 = require("../../config/prisma");
async function getUsersService() {
    const users = await prisma_1.prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            department: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    return users;
}
