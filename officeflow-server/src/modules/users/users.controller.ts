import { Request, Response } from "express";
import { successResponse, errorResponse } from "../../utils/api-response";
import { getUsersService } from "./users.service";
import { asyncHandler } from "../../utils/asyncHandler";

export const getUsersController = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const users = await getUsersService();
      return successResponse(res, 200, "Get users successfully", users);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Get users failed";
      return errorResponse(res, 500, message);
    }
  },
);
