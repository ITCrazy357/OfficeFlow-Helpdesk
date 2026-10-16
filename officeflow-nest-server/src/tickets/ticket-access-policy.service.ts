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

  private escalatedScope(managerId: number): Prisma.TicketWhereInput {
    return {
      assignedTo: { managerId },
      slaAlerts: { some: { kind: 'ESCALATED', managerId } },
    };
  }

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
        where.OR = [
          { createdById: currentUser.userId },
          this.escalatedScope(currentUser.userId),
        ];
      } else {
        where.OR = [
          { createdBy: { departmentId: manager.departmentId } },
          this.escalatedScope(currentUser.userId),
        ];
      }
    }

    return where;
  }

  async assertCanView(
    ticket: {
      id?: number;
      createdById: number;
      createdBy: { departmentId: number | null };
    },
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
        if (
          ticket.id &&
          (await this.prisma.ticket.count({
            where: {
              id: ticket.id,
              ...this.escalatedScope(currentUser.userId),
            },
          }))
        )
          return;
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

      if (
        !manager?.departmentId ||
        ticket.createdBy.departmentId !== manager.departmentId
      ) {
        if (
          await this.prisma.ticket.count({
            where: { id: ticketId, ...this.escalatedScope(currentUser.userId) },
          })
        )
          return ticket;
        throw new ForbiddenException('Forbidden');
      }
      return ticket;
    }
    throw new ForbiddenException('Forbidden');
  }
}
