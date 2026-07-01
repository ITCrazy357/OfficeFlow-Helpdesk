"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTicketsController = getTicketsController;
exports.getTicketByIdController = getTicketByIdController;
exports.createTicketController = createTicketController;
exports.updateTicketController = updateTicketController;
exports.updateTicketStatusController = updateTicketStatusController;
exports.assignTicketController = assignTicketController;
exports.deleteTicketController = deleteTicketController;
const client_1 = require("@prisma/client");
const api_response_1 = require("../../utils/api-response");
const tickets_service_1 = require("./tickets.service");
// Kieu du lieu user dang dang nhap, dung de kiem tra quyen.
function parseNumber(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue) || numberValue <= 0) {
        return undefined;
    }
    return numberValue;
}
function parseString(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const text = value.trim();
    return text || undefined;
}
function parseTicketStatus(value) {
    if (typeof value === "string" &&
        Object.values(client_1.TicketStatus).includes(value)) {
        return value;
    }
    return undefined;
}
function parseTicketPriority(value) {
    if (typeof value === "string" &&
        Object.values(client_1.TicketPriority).includes(value)) {
        return value;
    }
    return undefined;
}
//
function getTicketId(req, res) {
    const id = parseNumber(req.params.id);
    if (!id) {
        (0, api_response_1.errorResponse)(res, 400, "Invalid ticket id");
        return undefined;
    }
    return id;
}
function getErrorStatus(message) {
    if (message === "Forbidden") {
        return 403;
    }
    if (message.includes("not found")) {
        return 404;
    }
    return 400;
}
async function getTicketsController(req, res) {
    try {
        if (!req.user) {
            return (0, api_response_1.errorResponse)(res, 401, "Unauthorized");
        }
        const query = {
            page: parseNumber(req.query.page),
            limit: parseNumber(req.query.limit),
            keyword: parseString(req.query.keyword),
            status: parseTicketStatus(req.query.status),
            priority: parseTicketPriority(req.query.priority),
            categoryId: parseNumber(req.query.categoryId),
        };
        const result = await (0, tickets_service_1.getTicketsService)(req.user, query);
        return (0, api_response_1.successResponse)(res, 200, "Get tickets successfully", result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Get tickets failed";
        return (0, api_response_1.errorResponse)(res, 500, message);
    }
}
async function getTicketByIdController(req, res) {
    try {
        if (!req.user) {
            return (0, api_response_1.errorResponse)(res, 401, "Unauthorized");
        }
        const id = getTicketId(req, res);
        if (!id) {
            return;
        }
        const ticket = await (0, tickets_service_1.getTicketByIdService)(id, req.user);
        return (0, api_response_1.successResponse)(res, 200, "Get ticket successfully", ticket);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Get ticket failed";
        return (0, api_response_1.errorResponse)(res, getErrorStatus(message), message);
    }
}
async function createTicketController(req, res) {
    try {
        if (!req.user) {
            return (0, api_response_1.errorResponse)(res, 401, "Unauthorized");
        }
        const ticket = await (0, tickets_service_1.createTicketService)(req.body, req.user);
        return (0, api_response_1.successResponse)(res, 201, "Create ticket successfully", ticket);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Create ticket failed";
        return (0, api_response_1.errorResponse)(res, 400, message);
    }
}
async function updateTicketController(req, res) {
    try {
        if (!req.user) {
            return (0, api_response_1.errorResponse)(res, 401, "Unauthorized");
        }
        const id = getTicketId(req, res);
        if (!id) {
            return;
        }
        const ticket = await (0, tickets_service_1.updateTicketService)(id, req.body, req.user);
        return (0, api_response_1.successResponse)(res, 200, "Update ticket successfully", ticket);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Update ticket failed";
        return (0, api_response_1.errorResponse)(res, getErrorStatus(message), message);
    }
}
async function updateTicketStatusController(req, res) {
    try {
        if (!req.user) {
            return (0, api_response_1.errorResponse)(res, 401, "Unauthorized");
        }
        const id = getTicketId(req, res);
        if (!id) {
            return;
        }
        const ticket = await (0, tickets_service_1.updateTicketStatusService)(id, req.body, req.user);
        return (0, api_response_1.successResponse)(res, 200, "Update ticket status successfully", ticket);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Update ticket status failed";
        return (0, api_response_1.errorResponse)(res, getErrorStatus(message), message);
    }
}
async function assignTicketController(req, res) {
    try {
        if (!req.user) {
            return (0, api_response_1.errorResponse)(res, 401, "Unauthorized");
        }
        const id = getTicketId(req, res);
        if (!id) {
            return;
        }
        const ticket = await (0, tickets_service_1.assignTicketService)(id, req.body, req.user);
        return (0, api_response_1.successResponse)(res, 200, "Assign ticket successfully", ticket);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Assign ticket failed";
        return (0, api_response_1.errorResponse)(res, getErrorStatus(message), message);
    }
}
async function deleteTicketController(req, res) {
    try {
        if (!req.user) {
            return (0, api_response_1.errorResponse)(res, 401, "Unauthorized");
        }
        const id = getTicketId(req, res);
        if (!id) {
            return;
        }
        const result = await (0, tickets_service_1.deleteTicketService)(id, req.user);
        return (0, api_response_1.successResponse)(res, 200, "Delete ticket successfully", result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Delete ticket failed";
        return (0, api_response_1.errorResponse)(res, getErrorStatus(message), message);
    }
}
