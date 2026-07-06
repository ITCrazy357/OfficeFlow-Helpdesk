"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRoles = requireRoles;
const jwt_1 = require("../utils/jwt");
const AppError_1 = require("../utils/AppError");
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next(new AppError_1.AppError("Unauthorized", 401));
    }
    const token = authHeader.split(" ")[1];
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        req.user = payload;
        next();
    }
    catch {
        return next(new AppError_1.AppError("Invalid or expired token", 403));
    }
}
function requireRoles(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError_1.AppError("Unauthorized", 401));
        }
        if (!roles.includes(req.user.role)) {
            return next(new AppError_1.AppError("Forbidden", 403));
        }
        next();
    };
}
