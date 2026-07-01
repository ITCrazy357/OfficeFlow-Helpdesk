"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartmentsService = getDepartmentsService;
const prisma_1 = require("../../config/prisma");
async function getDepartmentsService() {
    const departments = await prisma_1.prisma.department.findMany({
        select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: {
            id: "asc",
        },
    });
    return departments;
}
