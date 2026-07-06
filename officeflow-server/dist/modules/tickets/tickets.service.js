"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTicketsService = getTicketsService;
exports.getTicketByIdService = getTicketByIdService;
exports.createTicketService = createTicketService;
exports.updateTicketService = updateTicketService;
exports.updateTicketStatusService = updateTicketStatusService;
exports.assignTicketService = assignTicketService;
exports.deleteTicketService = deleteTicketService;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const AppError_1 = require("../../utils/AppError");
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
};
// Kiem tra user co phai ADMIN hoac IT_STAFF khong.
function isAdminOrITStaff(currentUser) {
    return (currentUser.role === client_1.UserRole.ADMIN ||
        currentUser.role === client_1.UserRole.IT_STAFF);
}
// Kiem tra user co phai EMPLOYEE khong.
function isEmployee(currentUser) {
    return currentUser.role === client_1.UserRole.EMPLOYEE;
}
// Lay danh sach ticket, co phan trang, filter va tim kiem.
async function getTicketsService(currentUser, query) {
    // Tinh page, limit va skip de phan trang.
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    // Tao dieu kien where cho Prisma.
    const where = {};
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
        prisma_1.prisma.ticket.findMany({
            where,
            skip,
            take: limit,
            orderBy: {
                createdAt: "desc",
            },
            select: ticketSelect,
        }),
        prisma_1.prisma.ticket.count({ where }),
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
async function getTicketByIdService(id, currentUser) {
    // Tim ticket trong database.
    const ticket = await prisma_1.prisma.ticket.findUnique({
        where: { id },
        select: ticketSelect,
    });
    // Neu khong tim thay thi bao loi.
    if (!ticket) {
        throw new AppError_1.AppError("Ticket not found", 404);
    }
    // Kiem tra ticket nay co phai cua user hien tai khong.
    const isOwner = ticket.createdBy.id === currentUser.userId;
    // EMPLOYEE khong duoc xem ticket cua nguoi khac.
    if (isEmployee(currentUser) && !isOwner) {
        throw new AppError_1.AppError("Forbidden", 403);
    }
    // Tra ve chi tiet ticket.
    return ticket;
}
// Tao ticket moi cho user hien tai.
async function createTicketService(input, currentUser) {
    // Tao ticket trong database.
    const ticket = await prisma_1.prisma.ticket.create({
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
async function updateTicketService(id, input, currentUser) {
    // Tim ticket can cap nhat.
    const ticket = await prisma_1.prisma.ticket.findUnique({
        where: { id },
        select: ticketSelect,
    });
    // Neu khong tim thay thi bao loi.
    if (!ticket) {
        throw new AppError_1.AppError("Ticket not found", 404);
    }
    // Kiem tra ticket co phai cua user hien tai va con OPEN khong.
    const isOwner = ticket.createdBy.id === currentUser.userId;
    const isOpen = ticket.status === client_1.TicketStatus.OPEN;
    // EMPLOYEE chi duoc sua ticket cua minh khi ticket con OPEN.
    if (isEmployee(currentUser) && (!isOwner || !isOpen)) {
        throw new AppError_1.AppError("Forbidden", 403);
    }
    // Cap nhat ticket trong database.
    const updatedTicket = await prisma_1.prisma.ticket.update({
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
async function updateTicketStatusService(id, input, currentUser) {
    // Chi ADMIN hoac IT_STAFF duoc doi status.
    if (!isAdminOrITStaff(currentUser)) {
        throw new AppError_1.AppError("Forbidden", 403);
    }
    // Tim ticket can doi status.
    const ticket = await prisma_1.prisma.ticket.findUnique({
        where: { id },
    });
    // Neu khong tim thay thi bao loi.
    if (!ticket) {
        throw new AppError_1.AppError("Ticket not found", 404);
    }
    // Cap nhat status trong database.
    const updatedTicket = await prisma_1.prisma.ticket.update({
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
async function assignTicketService(id, input, currentUser) {
    // Chi ADMIN hoac IT_STAFF duoc assign ticket.
    if (!isAdminOrITStaff(currentUser)) {
        throw new AppError_1.AppError("Forbidden", 403);
    }
    // Tim ticket can assign.
    const ticket = await prisma_1.prisma.ticket.findUnique({
        where: { id },
    });
    // Neu ticket khong ton tai thi bao loi.
    if (!ticket) {
        throw new AppError_1.AppError("Ticket not found", 404);
    }
    // Tim user se duoc assign.
    const assignedUser = await prisma_1.prisma.user.findUnique({
        where: { id: input.assignedToId },
    });
    // Neu user duoc assign khong ton tai thi bao loi.
    if (!assignedUser) {
        throw new AppError_1.AppError("Assigned user not found", 404);
    }
    // Chi cho assign cho ADMIN hoac IT_STAFF.
    if (assignedUser.role !== client_1.UserRole.IT_STAFF &&
        assignedUser.role !== client_1.UserRole.ADMIN) {
        throw new AppError_1.AppError("Assigned user must be IT_STAFF or ADMIN", 400);
    }
    // Cap nhat nguoi duoc assign cho ticket.
    const updatedTicket = await prisma_1.prisma.ticket.update({
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
async function deleteTicketService(id, currentUser) {
    // Tim ticket can xoa.
    const ticket = await prisma_1.prisma.ticket.findUnique({
        where: { id },
        select: ticketSelect,
    });
    // Neu khong tim thay thi bao loi.
    if (!ticket) {
        throw new AppError_1.AppError("Ticket not found", 404);
    }
    // ADMIN duoc xoa moi ticket.
    if (currentUser.role === client_1.UserRole.ADMIN) {
        await prisma_1.prisma.ticket.delete({
            where: { id },
        });
        return { message: "Ticket deleted" };
    }
    // Kiem tra EMPLOYEE co phai chu ticket va ticket con OPEN khong.
    const isOwner = ticket.createdBy.id === currentUser.userId;
    const isOpen = ticket.status === client_1.TicketStatus.OPEN;
    // EMPLOYEE chi duoc xoa ticket cua minh khi ticket con OPEN.
    if (isEmployee(currentUser) && isOwner && isOpen) {
        await prisma_1.prisma.ticket.delete({
            where: { id },
        });
        return { message: "Ticket deleted" };
    }
    // Cac truong hop con lai khong duoc xoa.
    throw new AppError_1.AppError("Forbidden", 403);
}
