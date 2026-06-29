"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerController = registerController;
exports.loginController = loginController;
exports.meController = meController;
const api_response_1 = require("../../utils/api-response");
const auth_service_1 = require("./auth.service");
async function registerController(req, res) {
    try {
        const user = await (0, auth_service_1.registerService)(req.body);
        return (0, api_response_1.successResponse)(res, 201, "Register successfully", user);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Register failed";
        return (0, api_response_1.errorResponse)(res, 400, message);
    }
}
async function loginController(req, res) {
    // TODO:
    // gọi loginService(req.body)
    try {
        const { accessToken, user } = await (0, auth_service_1.loginService)(req.body);
        return (0, api_response_1.successResponse)(res, 200, "Login successfully", {
            accessToken,
            user,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Login failed";
        return (0, api_response_1.errorResponse)(res, 401, message);
    }
    // trả successResponse status 200
    // catch error và trả 401 nếu sai email/password
}
async function meController(req, res) {
    const userId = req.user?.userId;
    if (userId === undefined) {
        return (0, api_response_1.errorResponse)(res, 401, "Unauthorized");
    }
    try {
        const user = await (0, auth_service_1.getMeService)(userId);
        return (0, api_response_1.successResponse)(res, 200, "Get me successfully", user);
    }
    catch {
        return (0, api_response_1.errorResponse)(res, 404, "User not found");
    }
}
