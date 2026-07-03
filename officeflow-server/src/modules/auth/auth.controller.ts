import { Response } from "express";
import { AuthRequest } from "../../types/express";
import { successResponse, errorResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/asyncHandler";
import { registerService, loginService, getMeService } from "./auth.service";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const registerController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await registerService(req.body);

      return successResponse(res, 201, "Register successfully", user);
    } catch (error) {
      return errorResponse(
        res,
        400,
        getErrorMessage(error, "Register failed"),
      );
    }
  },
);

export const loginController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    try {
      const { accessToken, user } = await loginService(req.body);

      return successResponse(res, 200, "Login successfully", {
        accessToken,
        user,
      });
    } catch (error) {
      return errorResponse(res, 401, getErrorMessage(error, "Login failed"));
    }
  },
);

export const meController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    try {
      const user = await getMeService(userId);

      return successResponse(res, 200, "Get user successfully", user);
    } catch (error) {
      return errorResponse(res, 404, getErrorMessage(error, "Get user failed"));
    }
  },
);
