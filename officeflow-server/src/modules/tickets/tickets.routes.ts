import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  assignTicketSchema,
  createTicketSchema,
  updateTicketSchema,
  updateTicketStatusSchema,
} from "./tickets.schema";
import {
  assignTicketController,
  createTicketController,
  deleteTicketController,
  getTicketByIdController,
  getTicketsController,
  updateTicketController,
  updateTicketStatusController,
} from "./tickets.controller";

const router = Router();

router.get("/", requireAuth, getTicketsController);

router.post(
  "/",
  requireAuth,
  validate(createTicketSchema),
  createTicketController,
);

router.get("/:id", requireAuth, getTicketByIdController);

router.patch(
  "/:id",
  requireAuth,
  validate(updateTicketSchema),
  updateTicketController,
);

router.patch(
  "/:id/status",
  requireAuth,
  validate(updateTicketStatusSchema),
  updateTicketStatusController,
);

router.patch(
  "/:id/assign",
  requireAuth,
  validate(assignTicketSchema),
  assignTicketController,
);

router.delete("/:id", requireAuth, deleteTicketController);

export default router;
