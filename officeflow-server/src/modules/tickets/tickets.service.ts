import type { Prisma } from "@prisma/client";
import { TicketPriority, TicketStatus, UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import {
  AssignTicketInput,
  CreateTicketInput,
  UpdateTicketInput,
  UpdateTicketStatusInput,
} from "./tickets.schema";
import { AppError } from "../../utils/AppError";

// Kieu du lieu user dang dang nhap, dung de kiem tra quyen.
type CurrentUser = {
  userId: number;
  role: UserRole;
};

// Kieu du lieu query khi lay danh sach ticket.
type TicketQuery = {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: number;
};

// Cac truong ticket se tra ve cho client.
const ticketSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.TicketSelect;

// Kiem tra user co phai ADMIN hoac IT_STAFF khong.
function isAdminOrITStaff(currentUser: CurrentUser) {
  return (
    currentUser.role === UserRole.ADMIN ||
    currentUser.role === UserRole.IT_STAFF
  );
}

// Kiem tra user co phai EMPLOYEE khong.
function isEmployee(currentUser: CurrentUser) {
  return currentUser.role === UserRole.EMPLOYEE;
}

// Lay danh sach ticket, co phan trang, filter va tim kiem.
export async function getTicketsService(
  currentUser: CurrentUser,
  query: TicketQuery,
) {
  // Tinh page, limit va skip de phan trang.
  const page = query.page || 1;
  const limit = query.limit || 10;
  const skip = (page - 1) * limit;

  // Tao dieu kien where cho Prisma.
  const where: Prisma.TicketWhereInput = {};

  // EMPLOYEE chi duoc xem ticket do chinh minh tao.
  if (isEmployee(currentUser)) {
    where.createdById = currentUser.userId;
  }

  // Neu co status thi loc theo status.
  if (query.status) {
    where.status = query.status;
  }

  // Neu co priority thi loc theo priority.
  if (query.priority) {
    where.priority = query.priority;
  }

  // Neu co categoryId thi loc theo category.
  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  // Neu co keyword thi tim trong title hoac description.
  if (query.keyword) {
    where.OR = [
      { title: { contains: query.keyword } },
      { description: { contains: query.keyword } },
    ];
  }

  // Lay danh sach ticket va tong so ticket cung luc.
  const [tickets, totalItems] = await Promise.all([
    prisma.ticket.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      select: ticketSelect,
    }),
    prisma.ticket.count({ where }),
  ]);

  // Tra ve data kem thong tin phan trang.
  return {
    data: tickets,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
}

// Lay chi tiet ticket theo id.
export async function getTicketByIdService(
  id: number,
  currentUser: CurrentUser,
) {
  // Tim ticket trong database.
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: ticketSelect,
  });

  // Neu khong tim thay thi bao loi.
  if (!ticket) {
    throw new AppError("Ticket not found", 404);
  }

  // Kiem tra ticket nay co phai cua user hien tai khong.
  const isOwner = ticket.createdBy.id === currentUser.userId;

  // EMPLOYEE khong duoc xem ticket cua nguoi khac.
  if (isEmployee(currentUser) && !isOwner) {
    throw new AppError("Forbidden", 403);
  }

  // Tra ve chi tiet ticket.
  return ticket;
}

// Tao ticket moi cho user hien tai.
export async function createTicketService(
  input: CreateTicketInput,
  currentUser: CurrentUser,
) {
  // Tao ticket trong database.
  const ticket = await prisma.ticket.create({
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      categoryId: input.categoryId,
      createdById: currentUser.userId,
    },
    select: ticketSelect,
  });

  // Tra ve ticket vua tao.
  return ticket;
}

// Cap nhat thong tin ticket.
export async function updateTicketService(
  id: number,
  input: UpdateTicketInput,
  currentUser: CurrentUser,
) {
  // Tim ticket can cap nhat.
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: ticketSelect,
  });

  // Neu khong tim thay thi bao loi.
  if (!ticket) {
    throw new AppError("Ticket not found", 404);
  }

  // Kiem tra ticket co phai cua user hien tai va con OPEN khong.
  const isOwner = ticket.createdBy.id === currentUser.userId;
  const isOpen = ticket.status === TicketStatus.OPEN;

  // EMPLOYEE chi duoc sua ticket cua minh khi ticket con OPEN.
  if (isEmployee(currentUser) && (!isOwner || !isOpen)) {
    throw new AppError("Forbidden", 403);
  }

  // Cap nhat ticket trong database.
  const updatedTicket = await prisma.ticket.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      categoryId: input.categoryId,
    },
    select: ticketSelect,
  });

  // Tra ve ticket sau khi cap nhat.
  return updatedTicket;
}

// Cap nhat trang thai ticket.
export async function updateTicketStatusService(
  id: number,
  input: UpdateTicketStatusInput,
  currentUser: CurrentUser,
) {
  // Chi ADMIN hoac IT_STAFF duoc doi status.
  if (!isAdminOrITStaff(currentUser)) {
    throw new AppError("Forbidden", 403);
  }

  // Tim ticket can doi status.
  const ticket = await prisma.ticket.findUnique({
    where: { id },
  });

  // Neu khong tim thay thi bao loi.
  if (!ticket) {
    throw new AppError("Ticket not found", 404);
  }

  // Cap nhat status trong database.
  const updatedTicket = await prisma.ticket.update({
    where: { id },
    data: {
      status: input.status,
    },
    select: ticketSelect,
  });

  // Tra ve ticket sau khi doi status.
  return updatedTicket;
}

// Gan ticket cho mot user xu ly.
export async function assignTicketService(
  id: number,
  input: AssignTicketInput,
  currentUser: CurrentUser,
) {
  // Chi ADMIN hoac IT_STAFF duoc assign ticket.
  if (!isAdminOrITStaff(currentUser)) {
    throw new AppError("Forbidden", 403);
  }

  // Tim ticket can assign.
  const ticket = await prisma.ticket.findUnique({
    where: { id },
  });

  // Neu ticket khong ton tai thi bao loi.
  if (!ticket) {
    throw new AppError("Ticket not found", 404);
  }

  // Tim user se duoc assign.
  const assignedUser = await prisma.user.findUnique({
    where: { id: input.assignedToId },
  });

  // Neu user duoc assign khong ton tai thi bao loi.
  if (!assignedUser) {
    throw new AppError("Assigned user not found", 404);
  }

  // Chi cho assign cho ADMIN hoac IT_STAFF.
  if (
    assignedUser.role !== UserRole.IT_STAFF &&
    assignedUser.role !== UserRole.ADMIN
  ) {
    throw new AppError("Assigned user must be IT_STAFF or ADMIN", 400);
  }

  // Cap nhat nguoi duoc assign cho ticket.
  const updatedTicket = await prisma.ticket.update({
    where: { id },
    data: {
      assignedToId: input.assignedToId,
    },
    select: ticketSelect,
  });

  // Tra ve ticket sau khi assign.
  return updatedTicket;
}

// Xoa ticket theo rule phan quyen.
export async function deleteTicketService(
  id: number,
  currentUser: CurrentUser,
) {
  // Tim ticket can xoa.
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: ticketSelect,
  });

  // Neu khong tim thay thi bao loi.
  if (!ticket) {
    throw new AppError("Ticket not found", 404);
  }

  // ADMIN duoc xoa moi ticket.
  if (currentUser.role === UserRole.ADMIN) {
    await prisma.ticket.delete({
      where: { id },
    });

    return { message: "Ticket deleted" };
  }

  // Kiem tra EMPLOYEE co phai chu ticket va ticket con OPEN khong.
  const isOwner = ticket.createdBy.id === currentUser.userId;
  const isOpen = ticket.status === TicketStatus.OPEN;

  // EMPLOYEE chi duoc xoa ticket cua minh khi ticket con OPEN.
  if (isEmployee(currentUser) && isOwner && isOpen) {
    await prisma.ticket.delete({
      where: { id },
    });

    return { message: "Ticket deleted" };
  }

  // Cac truong hop con lai khong duoc xoa.
  throw new AppError("Forbidden", 403);
}
