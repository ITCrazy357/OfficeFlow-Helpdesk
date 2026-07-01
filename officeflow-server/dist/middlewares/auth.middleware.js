"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRoles = requireRoles;
const jwt_1 = require("../utils/jwt");
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.json({
            status: 401,
            success: false,
            message: "Unauthorized",
        });
    }
    const token = authHeader.split(" ")[1];
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        req.user = payload;
        next();
    }
    catch {
        return res.json({
            status: 401,
            success: false,
            message: "Invalid or expired token",
        });
    }
}
function requireRoles(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.json({
                status: 401,
                success: false,
                message: "Unauthorized",
            });
        }
        if (!roles.includes(req.user.role)) {
            return res.json({
                status: 403,
                success: false,
                message: "Forbidden",
            });
        }
        next();
    };
}
