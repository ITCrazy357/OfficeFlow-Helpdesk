import { Response } from "express";
import { TicketPriority, TicketStatus } from "@prisma/client";
import { AuthRequest } from "../../types/express";
import { successResponse, errorResponse } from "../../utils/api-response";
import {
  assignTicketService,
  createTicketService,
  deleteTicketService,
  getTicketByIdService,
  getTicketsService,
  updateTicketService,
  updateTicketStatusService,
} from "./tickets.service";

// Kieu du lieu user dang dang nhap, dung de kiem tra quyen.
function parseNumber(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return undefined;
  }

  return numberValue;
}

function parseString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const text = value.trim();
  return text || undefined;
}

function parseTicketStatus(value: unknown) {
  if (
    typeof value === "string" &&
    Object.values(TicketStatus).includes(value as TicketStatus)
  ) {
    return value as TicketStatus;
  }

  return undefined;
}

function parseTicketPriority(value: unknown) {
  if (
    typeof value === "string" &&
    Object.values(TicketPriority).includes(value as TicketPriority)
  ) {
    return value as TicketPriority;
  }

  return undefined;
}

//
function getTicketId(req: AuthRequest, res: Response) {
  const id = parseNumber(req.params.id);

  if (!id) {
    errorResponse(res, 400, "Invalid ticket id");
    return undefined;
  }

  return id;
}

function getErrorStatus(message: string) {
  if (message === "Forbidden") {
    return 403;
  }

  if (message.includes("not found")) {
    return 404;
  }

  return 400;
}

export async function getTicketsController(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const query = {
      page: parseNumber(req.query.page),
      limit: parseNumber(req.query.limit),
      keyword: parseString(req.query.keyword),
      status: parseTicketStatus(req.query.status),
      priority: parseTicketPriority(req.query.priority),
      categoryId: parseNumber(req.query.categoryId),
    };

    const result = await getTicketsService(req.user, query);

    return successResponse(res, 200, "Get tickets successfully", result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Get tickets failed";
    return errorResponse(res, 500, message);
  }
}

export async function getTicketByIdController(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const id = getTicketId(req, res);

    if (!id) {
      return;
    }

    const ticket = await getTicketByIdService(id, req.user);

    return successResponse(res, 200, "Get ticket successfully", ticket);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Get ticket failed";
    return errorResponse(res, getErrorStatus(message), message);
  }
}

export async function createTicketController(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const ticket = await createTicketService(req.body, req.user);

    return successResponse(res, 201, "Create ticket successfully", ticket);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Create ticket failed";
    return errorResponse(res, 400, message);
  }
}

export async function updateTicketController(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const id = getTicketId(req, res);

    if (!id) {
      return;
    }

    const ticket = await updateTicketService(id, req.body, req.user);

    return successResponse(res, 200, "Update ticket successfully", ticket);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Update ticket failed";
    return errorResponse(res, getErrorStatus(message), message);
  }
}

export async function updateTicketStatusController(
  req: AuthRequest,
  res: Response,
) {
  try {
    if (!req.user) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const id = getTicketId(req, res);

    if (!id) {
      return;
    }

    const ticket = await updateTicketStatusService(id, req.body, req.user);

    return successResponse(
      res,
      200,
      "Update ticket status successfully",
      ticket,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Update ticket status failed";
    return errorResponse(res, getErrorStatus(message), message);
  }
}

export async function assignTicketController(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const id = getTicketId(req, res);

    if (!id) {
      return;
    }

    const ticket = await assignTicketService(id, req.body, req.user);

    return successResponse(res, 200, "Assign ticket successfully", ticket);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Assign ticket failed";
    return errorResponse(res, getErrorStatus(message), message);
  }
}

export async function deleteTicketController(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const id = getTicketId(req, res);

    if (!id) {
      return;
    }

    const result = await deleteTicketService(id, req.user);

    return successResponse(res, 200, "Delete ticket successfully", result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Delete ticket failed";
    return errorResponse(res, getErrorStatus(message), message);
  }
}
