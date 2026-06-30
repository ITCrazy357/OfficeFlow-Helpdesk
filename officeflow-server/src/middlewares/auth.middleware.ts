import { NextFunction, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { AuthRequest } from "../types/express";
import { UserRole } from "@prisma/client";

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
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
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    return res.json({
      status: 401,
      success: false,
      message: "Invalid or expired token",
    });
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
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
