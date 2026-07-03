import { Request, Response } from "express";
import { successResponse, errorResponse } from "../../utils/api-response";
import { getDepartmentsService } from "./departments.service";
import { asyncHandler } from "../../utils/asyncHandler";

export const getDepartmentsController = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const departments = await getDepartmentsService();
      return successResponse(
        res,
        200,
        "Departments fetched successfully",
        departments,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Get departments failed";
      return errorResponse(res, 500, message);
    }
  },
);
