"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartmentsController = void 0;
const api_response_1 = require("../../utils/api-response");
const departments_service_1 = require("./departments.service");
const asyncHandler_1 = require("../../utils/asyncHandler");
exports.getDepartmentsController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    try {
        const departments = await (0, departments_service_1.getDepartmentsService)();
        return (0, api_response_1.successResponse)(res, 200, "Departments fetched successfully", departments);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Get departments failed";
        return (0, api_response_1.errorResponse)(res, 500, message);
    }
});
