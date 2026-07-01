"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignTicketSchema = exports.updateTicketStatusSchema = exports.updateTicketSchema = exports.createTicketSchema = void 0;
const zod_1 = require("zod");
exports.createTicketSchema = zod_1.z.object({
    title: zod_1.z.string().min(3, "Title must be at least 3 characters").max(100),
    description: zod_1.z.string().min(10, "Description must be at least 10 characters"),
    priority: zod_1.z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    categoryId: zod_1.z.number().int().positive().optional(),
});
exports.updateTicketSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).max(100).optional(),
    description: zod_1.z.string().min(10).optional(),
    priority: zod_1.z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    categoryId: zod_1.z.number().int().positive().optional(),
});
exports.updateTicketStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"]),
});
exports.assignTicketSchema = zod_1.z.object({
    assignedToId: zod_1.z.number().int().positive(),
});
