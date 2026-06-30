import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { getDepartmentsController } from "./departments.controller";

const router = Router();

router.get("/", requireAuth, getDepartmentsController);

export default router;
