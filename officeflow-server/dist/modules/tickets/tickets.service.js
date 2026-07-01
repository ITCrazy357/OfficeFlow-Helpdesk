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
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
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
const ticketActionSelect = {
    id: true,
    status: true,
    assignedToId: true,
};
function toPositiveInteger(value, fallback) {
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue) || numberValue <= 0) {
        return fallback;
    }
    return numberValue;
}
function getPositiveInteger(value) {
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue) || numberValue <= 0) {
        return undefined;
    }
    return numberValue;
}
function isTicketStatus(value) {
    return (typeof value === "string" &&
        Object.values(client_1.TicketStatus).includes(value));
}
function isTicketPriority(value) {
    return (typeof value === "string" &&
        Object.values(client_1.TicketPriority).includes(value));
}
function assertSupportUser(currentUser) {
    const isSupportUser = currentUser.role === client_1.UserRole.ADMIN ||
        currentUser.role === client_1.UserRole.IT_STAFF;
    if (!isSupportUser) {
        throw new Error("Forbidden");
    }
}
function assertEmployeeCanReadTicket(ticket, currentUser) {
    const isOwner = ticket.createdBy.id === currentUser.userId;
    if (currentUser.role === client_1.UserRole.EMPLOYEE && !isOwner) {
        throw new Error("Forbidden");
    }
}
function assertEmployeeCanUpdateTicket(ticket, currentUser) {
    if (currentUser.role !== client_1.UserRole.EMPLOYEE) {
        return;
    }
    const isOwner = ticket.createdBy.id === currentUser.userId;
    const isOpen = ticket.status === client_1.TicketStatus.OPEN;
    if (!isOwner || !isOpen) {
        throw new Error("Forbidden");
    }
}
async function findTicketPermissionData(id) {
    const ticket = await prisma_1.prisma.ticket.findUnique({
        where: { id },
        select: {
            id: true,
            status: true,
            createdBy: {
                select: {
                    id: true,
                },
            },
        },
    });
    if (!ticket) {
        throw new Error("Ticket not found");
    }
    return ticket;
}
async function ensureCategoryExists(categoryId) {
    if (!categoryId) {
        return;
    }
    const category = await prisma_1.prisma.ticketCategory.findUnique({
        where: { id: categoryId },
        select: { id: true },
    });
    if (!category) {
        throw new Error("Category not found");
    }
}
async function ensureTicketExists(id) {
    const ticket = await prisma_1.prisma.ticket.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!ticket) {
        throw new Error("Ticket not found");
    }
}
async function getTicketsService(currentUser, query) {
    const page = toPositiveInteger(query.page, DEFAULT_PAGE);
    const limit = Math.min(toPositiveInteger(query.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const skip = (page - 1) * limit;
    const where = {};
    const categoryId = getPositiveInteger(query.categoryId);
    const keyword = query.keyword?.trim();
    if (currentUser.role === client_1.UserRole.EMPLOYEE) {
        where.createdById = currentUser.userId;
    }
    if (isTicketStatus(query.status)) {
        where.status = query.status;
    }
    if (isTicketPriority(query.priority)) {
        where.priority = query.priority;
    }
    if (categoryId) {
        where.categoryId = categoryId;
    }
    if (keyword) {
        where.OR = [
            { title: { contains: keyword } },
            { description: { contains: keyword } },
        ];
    }
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
async function getTicketByIdService(id, currentUser) {
    const ticket = await prisma_1.prisma.ticket.findUnique({
        where: { id },
        select: ticketSelect,
    });
    if (!ticket) {
        throw new Error("Ticket not found");
    }
    assertEmployeeCanReadTicket(ticket, currentUser);
    return ticket;
}
async function createTicketService(input, currentUser) {
    await ensureCategoryExists(input.categoryId);
    return prisma_1.prisma.ticket.create({
        data: {
            title: input.title,
            description: input.description,
            priority: input.priority,
            categoryId: input.categoryId,
            createdById: currentUser.userId,
        },
        select: ticketSelect,
    });
}
async function updateTicketService(id, input, currentUser) {
    const ticket = await findTicketPermissionData(id);
    assertEmployeeCanUpdateTicket(ticket, currentUser);
    await ensureCategoryExists(input.categoryId);
    return prisma_1.prisma.ticket.update({
        where: { id },
        data: {
            title: input.title,
            description: input.description,
            priority: input.priority,
            categoryId: input.categoryId,
        },
        select: ticketSelect,
    });
}
async function updateTicketStatusService(id, input, currentUser) {
    assertSupportUser(currentUser);
    await ensureTicketExists(id);
    return prisma_1.prisma.ticket.update({
        where: { id },
        data: {
            status: input.status,
        },
        select: ticketActionSelect,
    });
}
async function assignTicketService(id, input, currentUser) {
    assertSupportUser(currentUser);
    await ensureTicketExists(id);
    const assignedTo = await prisma_1.prisma.user.findUnique({
        where: { id: input.assignedToId },
        select: { id: true, role: true },
    });
    if (!assignedTo) {
        throw new Error("AssignedTo not found");
    }
    const canReceiveTicket = assignedTo.role === client_1.UserRole.ADMIN ||
        assignedTo.role === client_1.UserRole.IT_STAFF;
    if (!canReceiveTicket) {
        throw new Error("AssignedTo must be IT_STAFF or ADMIN");
    }
    return prisma_1.prisma.ticket.update({
        where: { id },
        data: {
            assignedToId: input.assignedToId,
        },
        select: ticketActionSelect,
    });
}
async function deleteTicketService(id, currentUser) {
    const ticket = await findTicketPermissionData(id);
    if (currentUser.role === client_1.UserRole.ADMIN) {
        await prisma_1.prisma.ticket.delete({ where: { id } });
        return { message: "Ticket deleted" };
    }
    if (currentUser.role === client_1.UserRole.EMPLOYEE) {
        assertEmployeeCanUpdateTicket(ticket, currentUser);
        await prisma_1.prisma.ticket.delete({ where: { id } });
        return { message: "Ticket deleted" };
    }
    throw new Error("Forbidden");
}
