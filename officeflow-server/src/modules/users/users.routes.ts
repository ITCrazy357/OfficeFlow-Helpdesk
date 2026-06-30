import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRoles } from "../../middlewares/auth.middleware";
import { getUsersController } from "./users.controller";

const router = Router();

router.get("/", requireAuth, requireRoles(UserRole.ADMIN), getUsersController);

export default router;
