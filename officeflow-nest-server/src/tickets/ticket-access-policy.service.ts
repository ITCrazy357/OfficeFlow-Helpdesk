import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { runSerializableTransaction } from '../common/database/serializable-transaction.util';

export type TicketRecipient = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

@Injectable()
export class TicketAccessPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecipients(
    ticketId: number,
    userIds: number[],
    transaction?: Prisma.TransactionClient,
  ): Promise<TicketRecipient[]> {
    if (userIds.length === 0) return [];
    if (!transaction) {
      return runSerializableTransaction(this.prisma, (tx) =>
        this.getRecipients(ticketId, userIds, tx),
      );
    }
    const candidates = await transaction.user.findMany({
      where: {
        id: { in: [...new Set(userIds)] },
        isActive: true,
        isLocked: false,
        mustChangePassword: false,
      },
      select: { id: true, name: true, email: true, role: true },
    });
    const allowed: TicketRecipient[] = [];
    for (const user of candidates) {
      try {
        await this.canAccessTicket(
          ticketId,
          { userId: user.id, role: user.role },
          transaction,
        );
        allowed.push(user);
      } catch (error) {
        if (
          !(error instanceof ForbiddenException) &&
          !(error instanceof NotFoundException)
        )
          throw error;
      }
    }
    return allowed;
  }

  private escalatedScope(managerId: number): Prisma.TicketWhereInput {
    return {
      assignedTo: { managerId },
      slaAlerts: { some: { kind: 'ESCALATED', managerId } },
    };
  }

  async getScope(
    currentUser: CurrentUserPayload,
    database: Pick<Prisma.TransactionClient, 'user'> = this.prisma,
  ): Promise<Prisma.TicketWhereInput> {
    const where: Prisma.TicketWhereInput = {};

    if (currentUser.role === UserRole.EMPLOYEE) {
      where.createdById = currentUser.userId;
    }

    if (currentUser.role === UserRole.MANAGER) {
      const manager = await database.user.findUnique({
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
    database: Pick<Prisma.TransactionClient, 'ticket' | 'user'> = this.prisma,
  ): Promise<void> {
    if (
      currentUser.role === UserRole.MANAGER &&
      ticket.createdById === currentUser.userId
    ) {
      return;
    }

    if (
      currentUser.role === UserRole.EMPLOYEE &&
      ticket.createdById !== currentUser.userId
    ) {
      throw new ForbiddenException('You are not allowed to view this ticket');
    }

    if (currentUser.role === UserRole.MANAGER) {
      const manager = await database.user.findUnique({
        where: { id: currentUser.userId },
        select: { departmentId: true },
      });

      if (
        !manager?.departmentId ||
        ticket.createdBy.departmentId !== manager.departmentId
      ) {
        if (
          ticket.id &&
          (await database.ticket.count({
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

  async canAccessTicket(
    ticketId: number,
    currentUser: CurrentUserPayload,
    database: Pick<Prisma.TransactionClient, 'ticket' | 'user'> = this.prisma,
  ) {
    const ticket = await database.ticket.findUnique({
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
      (currentUser.role === UserRole.EMPLOYEE ||
        currentUser.role === UserRole.MANAGER) &&
      ticket.createdById === currentUser.userId
    ) {
      return ticket;
    }

    if (currentUser.role === UserRole.MANAGER) {
      const manager = await database.user.findUnique({
        where: { id: currentUser.userId },
        select: { departmentId: true },
      });

      if (
        !manager?.departmentId ||
        ticket.createdBy.departmentId !== manager.departmentId
      ) {
        if (
          await database.ticket.count({
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
