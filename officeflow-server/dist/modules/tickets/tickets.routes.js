"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const tickets_schema_1 = require("./tickets.schema");
const tickets_controller_1 = require("./tickets.controller");
const router = (0, express_1.Router)();
/**
 * @openapi
 * /tickets:
 *   get:
 *     summary: Get tickets with pagination, search and filters
 *     tags:
 *       - Tickets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *           example: vpn
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Get tickets successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/", auth_middleware_1.requireAuth, tickets_controller_1.getTicketsController);
/**
 * @openapi
 * /tickets:
 *   post:
 *     summary: Create a new ticket
 *     tags:
 *       - Tickets
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *                 example: Cannot connect to VPN
 *               description:
 *                 type: string
 *                 example: I cannot connect to company VPN from my laptop.
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 example: HIGH
 *               categoryId:
 *                 type: integer
 *                 example: 3
 *     responses:
 *       201:
 *         description: Create ticket successfully
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation failed
 */
router.post("/", auth_middleware_1.requireAuth, (0, validate_middleware_1.validate)(tickets_schema_1.createTicketSchema), tickets_controller_1.createTicketController);
/**
 * @openapi
 * /tickets/{id}:
 *   get:
 *     summary: Get ticket detail by id
 *     tags:
 *       - Tickets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Get ticket successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Ticket not found
 */
router.get("/:id", auth_middleware_1.requireAuth, tickets_controller_1.getTicketByIdController);
/**
 * @openapi
 * /tickets/{id}:
 *   patch:
 *     summary: Update ticket by id
 *     tags:
 *       - Tickets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Cannot connect to VPN
 *               description:
 *                 type: string
 *                 example: I cannot connect to company VPN from my laptop.
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 example: HIGH
 *               categoryId:
 *                 type: integer
 *                 example: 3
 *     responses:
 *       200:
 *         description: Update ticket successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Ticket not found
 *       422:
 *         description: Validation failed
 */
router.patch("/:id", auth_middleware_1.requireAuth, (0, validate_middleware_1.validate)(tickets_schema_1.updateTicketSchema), tickets_controller_1.updateTicketController);
/**
 * @openapi
 * /tickets/{id}/status:
 *   patch:
 *     summary: Update ticket status
 *     tags:
 *       - Tickets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED]
 *                 example: IN_PROGRESS
 *     responses:
 *       200:
 *         description: Update ticket status successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Ticket not found
 *       422:
 *         description: Validation failed
 */
router.patch("/:id/status", auth_middleware_1.requireAuth, (0, validate_middleware_1.validate)(tickets_schema_1.updateTicketStatusSchema), tickets_controller_1.updateTicketStatusController);
/**
 * @openapi
 * /tickets/{id}/assign:
 *   patch:
 *     summary: Assign ticket to IT staff
 *     tags:
 *       - Tickets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assignedToId
 *             properties:
 *               assignedToId:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: Assign ticket successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Ticket not found
 *       422:
 *         description: Validation failed
 */
router.patch("/:id/assign", auth_middleware_1.requireAuth, (0, validate_middleware_1.validate)(tickets_schema_1.assignTicketSchema), tickets_controller_1.assignTicketController);
/**
 * @openapi
 * /tickets/{id}:
 *   delete:
 *     summary: Delete ticket by id
 *     tags:
 *       - Tickets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Delete ticket successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Ticket not found
 */
router.delete("/:id", auth_middleware_1.requireAuth, tickets_controller_1.deleteTicketController);
exports.default = router;
