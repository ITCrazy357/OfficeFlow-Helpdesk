"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTicketController = exports.assignTicketController = exports.updateTicketStatusController = exports.updateTicketController = exports.createTicketController = exports.getTicketByIdController = exports.getTicketsController = void 0;
const client_1 = require("@prisma/client");
const api_response_1 = require("../../utils/api-response");
const tickets_service_1 = require("./tickets.service");
const asyncHandler_1 = require("../../utils/asyncHandler");
// chuyển string từ req thành Number
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
//Xử lý keyword
function parseString(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const text = value.trim();
    return text || undefined;
}
//Xử lý status có đúng enum prisma không
function parseTicketStatus(value) {
    if (typeof value === "string" &&
        Object.values(client_1.TicketStatus).includes(value)) {
        return value;
    }
    return undefined;
}
//Xử lý priority có đúng enum không
function parseTicketPriority(value) {
    if (typeof value === "string" &&
        Object.values(client_1.TicketPriority).includes(value)) {
        return value;
    }
    return undefined;
}
// Lấy Id từ URL
function getTicketId(req, res) {
    const id = parseNumber(req.params.id);
    if (!id) {
        (0, api_response_1.errorResponse)(res, 400, "Invalid ticket id");
        return undefined;
    }
    return id;
}
// Chuyển message lỗi thành HTTO status code
function getErrorStatus(message) {
    if (message === "Forbidden") {
        return 403;
    }
    if (message.includes("not found")) {
        return 404;
    }
    return 400;
}
// Lấy ticket
exports.getTicketsController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
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
});
//
exports.getTicketByIdController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
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
});
//Tạo mới ticket
exports.createTicketController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
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
});
//update ticket
exports.updateTicketController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
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
});
//Cap nhat trang thai ticket
exports.updateTicketStatusController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
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
});
exports.assignTicketController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
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
});
exports.deleteTicketController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
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
});
