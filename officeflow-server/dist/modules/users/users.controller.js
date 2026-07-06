"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsersController = void 0;
const api_response_1 = require("../../utils/api-response");
const users_service_1 = require("./users.service");
const asyncHandler_1 = require("../../utils/asyncHandler");
exports.getUsersController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    try {
        const users = await (0, users_service_1.getUsersService)();
        return (0, api_response_1.successResponse)(res, 200, "Get users successfully", users);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Get users failed";
        return (0, api_response_1.errorResponse)(res, 500, message);
    }
});
