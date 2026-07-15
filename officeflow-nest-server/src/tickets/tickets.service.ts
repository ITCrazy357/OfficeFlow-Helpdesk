import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TicketStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
//DTO
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { GetTicketsQueryDto } from './dto/get-tickets-query.dto';

type CurrentUser = {
  userId: number;
  role: UserRole;
};

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTickets(currentUser: CurrentUser, query: GetTicketsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {};

    if (currentUser.role === UserRole.EMPLOYEE) {
      where.createdById = currentUser.userId;
    }

    if (currentUser.role === UserRole.MANAGER) {
      const manager = await this.prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { departmentId: true },
      });

      if (!manager?.departmentId) {
        where.createdById = currentUser.userId;
      } else {
        where.createdBy = {
          departmentId: manager.departmentId,
        };
      }
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.keyword) {
      where.OR = [
        {
          title: {
            contains: query.keyword,
          },
        },
        {
          description: {
            contains: query.keyword,
          },
        },
      ];
    }

    const [tickets, totalItems] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
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
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      items: tickets,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async create(createTicketDto: CreateTicketDto, currentUser: CurrentUser) {
    const ticket = await this.prisma.ticket.create({
      data: {
        title: createTicketDto.title,
        description: createTicketDto.description,
        priority: createTicketDto.priority,
        categoryId: createTicketDto.categoryId,
        createdById: currentUser.userId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return ticket;
  }

  async getById(id: number, currentUser: CurrentUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            departmentId: true,
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
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    if (
      currentUser.role === UserRole.EMPLOYEE &&
      ticket.createdById !== currentUser.userId
    ) {
      throw new ForbiddenException('You are not allowed to view this ticket');
    }

    if (currentUser.role === UserRole.MANAGER) {
      const manager = await this.prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { departmentId: true },
      });

      if (
        !manager?.departmentId ||
        ticket.createdBy.departmentId !== manager.departmentId
      ) {
        throw new ForbiddenException('Forbidden');
      }
    }

    return {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      createdBy: {
        id: ticket.createdBy.id,
        name: ticket.createdBy.name,
        email: ticket.createdBy.email,
      },
      assignedTo: ticket.assignedTo,
      category: ticket.category,
    };
  }

  async update(
    id: number,
    updateTicketDto: UpdateTicketDto,
    currentUser: CurrentUser,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        createdById: true,
        assignedToId: true,
        categoryId: true,
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    if (currentUser.role === UserRole.EMPLOYEE) {
      if (ticket.createdById !== currentUser.userId) {
        throw new ForbiddenException('Forbidden');
      }

      if (ticket.status !== TicketStatus.OPEN) {
        throw new BadRequestException('Ticket is not open');
      }
    }

    if (
      currentUser.role === UserRole.IT_STAFF &&
      ticket.assignedToId !== null &&
      ticket.assignedToId !== currentUser.userId
    ) {
      throw new ForbiddenException('Forbidden');
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: { id },
      data: {
        title: updateTicketDto.title,
        description: updateTicketDto.description,
        priority: updateTicketDto.priority,
        categoryId: updateTicketDto.categoryId,
      },
      select: {
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
      },
    });

    return updatedTicket;
  }

  async updateStatus(
    id: number,
    updateStatusDto: UpdateTicketStatusDto,
    currentUser: CurrentUser,
  ) {
    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.IT_STAFF
    ) {
      throw new ForbiddenException('Forbidden');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const updateTicket = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: updateStatusDto.status,
      },
      select: {
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
      },
    });

    return updateTicket;
  }

  async assign(
    id: number,
    assignTicketDto: AssignTicketDto,
    currentUser: CurrentUser,
  ) {
    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.IT_STAFF
    ) {
      throw new ForbiddenException('Forbidden');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const assigned = await this.prisma.user.findUnique({
      where: { id: assignTicketDto.assignedToId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!assigned) {
      throw new NotFoundException('Assignee not found');
    }

    if (
      assigned.role !== UserRole.IT_STAFF &&
      assigned.role !== UserRole.ADMIN
    ) {
      throw new BadRequestException('Assignee must be IT staff or admin');
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: { id },
      data: {
        assignedToId: assignTicketDto.assignedToId,
      },
      select: {
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
      },
    });

    return updatedTicket;
  }

  async remove(id: number, currentUser: CurrentUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        status: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const canDelete =
      currentUser.role === UserRole.ADMIN ||
      (currentUser.role === UserRole.EMPLOYEE &&
        ticket.createdById === currentUser.userId &&
        ticket.status === TicketStatus.OPEN);

    if (!canDelete) {
      throw new ForbiddenException('Forbidden');
    }

    await this.prisma.ticket.delete({
      where: { id },
    });

    return { id };
  }
}
