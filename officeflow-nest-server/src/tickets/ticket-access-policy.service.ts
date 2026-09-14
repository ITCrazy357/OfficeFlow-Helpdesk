import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Injectable()
export class TicketAccessPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getScope(
    currentUser: CurrentUserPayload,
  ): Promise<Prisma.TicketWhereInput> {
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

    return where;
  }

  async assertCanView(
    ticket: { createdById: number; createdBy: { departmentId: number | null } },
    currentUser: CurrentUserPayload,
  ): Promise<void> {
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
  }

  async canAccessTicket(ticketId: number, currentUser: CurrentUserPayload) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        createdById: true,
        createdBy: {
          select: {
            departmentId: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (
      currentUser.role === UserRole.ADMIN ||
      currentUser.role === UserRole.IT_STAFF
    ) {
      return ticket;
    }

    if (
      currentUser.role === UserRole.EMPLOYEE &&
      ticket.createdById === currentUser.userId
    ) {
      return ticket;
    }

    if (currentUser.role === UserRole.MANAGER) {
      const manager = await this.prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { departmentId: true },
      });

      if (!manager?.departmentId) {
        throw new ForbiddenException('Forbidden');
      }

      if (ticket.createdBy.departmentId !== manager.departmentId) {
        throw new ForbiddenException('Forbidden');
      }
      return ticket;
    }
    throw new ForbiddenException('Forbidden');
  }
}
