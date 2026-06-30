import { Request, Response } from "express";
import { successResponse, errorResponse } from "../../utils/api-response";
import { getUsersService } from "./users.service";

export async function getUsersController(req: Request, res: Response) {
  try {
    // TODO:
    // gọi getUsersService()
    const users = await getUsersService();
    return successResponse(res, 200, "Get users successfully", users);
    // TODO:
    // trả successResponse với status 200
  } catch (error) {
    // TODO:
    // trả errorResponse status 500
    const message = error instanceof Error ? error.message : "Get users failed";
    return errorResponse(res, 500, message);
  }
}
