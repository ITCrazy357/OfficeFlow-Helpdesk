import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";

type JwtPayload = {
  userId: number;
  role: UserRole;
};

export function signAccessToken(payload: JwtPayload) {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is missing");
  }

  return jwt.sign(payload, secret, {
    expiresIn: "1d",
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is missing");
  }

  return jwt.verify(token, secret) as JwtPayload;
}