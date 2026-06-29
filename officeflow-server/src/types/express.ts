import { Request } from "express";
import { UserRole } from "@prisma/client";

export type AuthUser = {
  userId: number;
  role: UserRole;
};

export type AuthRequest = Request & {
  user?: AuthUser;
};
