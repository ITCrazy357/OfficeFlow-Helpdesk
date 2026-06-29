import { Router } from "express";
import {
  registerController,
  loginController,
  meController,
} from "./auth.controller";
import { validate } from "../../middlewares/validate.middleware";
import { loginSchema, registerSchema } from "./auth.schema";
import { requireAuth } from "../../middlewares/auth.middleware";

const router = Router();

router.post("/register", validate(registerSchema), registerController);
router.post("/login", validate(loginSchema), loginController);
router.get("/me", requireAuth, meController);

export default router;
