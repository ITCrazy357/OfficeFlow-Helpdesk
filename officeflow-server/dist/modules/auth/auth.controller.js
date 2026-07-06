"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meController = exports.loginController = exports.registerController = void 0;
const api_response_1 = require("../../utils/api-response");
const asyncHandler_1 = require("../../utils/asyncHandler");
const auth_service_1 = require("./auth.service");
function getErrorMessage(error, fallback) {
    return error instanceof Error ? error.message : fallback;
}
exports.registerController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    try {
        const user = await (0, auth_service_1.registerService)(req.body);
        return (0, api_response_1.successResponse)(res, 201, "Register successfully", user);
    }
    catch (error) {
        return (0, api_response_1.errorResponse)(res, 400, getErrorMessage(error, "Register failed"));
    }
});
exports.loginController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    try {
        const { accessToken, user } = await (0, auth_service_1.loginService)(req.body);
        return (0, api_response_1.successResponse)(res, 200, "Login successfully", {
            accessToken,
            user,
        });
    }
    catch (error) {
        return (0, api_response_1.errorResponse)(res, 401, getErrorMessage(error, "Login failed"));
    }
});
exports.meController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
        return (0, api_response_1.errorResponse)(res, 401, "Unauthorized");
    }
    try {
        const user = await (0, auth_service_1.getMeService)(userId);
        return (0, api_response_1.successResponse)(res, 200, "Get user successfully", user);
    }
    catch (error) {
        return (0, api_response_1.errorResponse)(res, 404, getErrorMessage(error, "Get user failed"));
    }
});
