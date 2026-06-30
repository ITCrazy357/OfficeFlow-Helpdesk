import { Response } from "express";
import { AuthRequest } from "../../types/express";
import { successResponse, errorResponse } from "../../utils/api-response";
import { registerService, loginService, getMeService } from "./auth.service";

export async function registerController(req: AuthRequest, res: Response) {
  try {
    const user = await registerService(req.body);

    return successResponse(res, 201, "Register successfully", user);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Register failed";

    return errorResponse(res, 400, message);
  }
}

export async function loginController(req: AuthRequest, res: Response) {
  // TODO:
  // gọi loginService(req.body)
  try {
    const { accessToken, user } = await loginService(req.body);
    return successResponse(res, 200, "Login successfully", {
      accessToken,
      user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return errorResponse(res, 401, message);
  }
  // trả successResponse status 200
  // catch error và trả 401 nếu sai email/password
}

export async function meController(req: AuthRequest, res: Response) {
  const userId = req.user?.userId;

  if (userId === undefined) {
    return errorResponse(res, 401, "Unauthorized");
  }

  try {
    const user = await getMeService(userId);
    return res.json({
      status: 200,
      success: true,
      data: user,
      message: "Get user successfully",
    });
  } catch {
    return res.json({
      status: 400,
      success: false,
      message: "Get user failed",
    });
  }
}
