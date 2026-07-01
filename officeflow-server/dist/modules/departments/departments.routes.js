"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const departments_controller_1 = require("./departments.controller");
const router = (0, express_1.Router)();
router.get("/", auth_middleware_1.requireAuth, departments_controller_1.getDepartmentsController);
exports.default = router;
