import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { TicketAccessPolicyService } from './ticket-access-policy.service';
import { TicketCommentService } from './ticket-comment.service';

describe('TicketCommentService authorization', () => {
  const ticket = { id: 5, createdById: 2, createdBy: { departmentId: 7 } };
  const manager = { userId: 3, role: UserRole.MANAGER };

  function setup() {
    const tx = {
      user: { findUnique: jest.fn().mockResolvedValue({ departmentId: 8 }) },
      ticket: {
        findUnique: jest.fn().mockResolvedValue(ticket),
        count: jest.fn().mockResolvedValue(0),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...ticket,
          title: 'Private ticket',
          assignedToId: null,
        }),
      },
      ticketComment: {
        create: jest.fn().mockResolvedValue({
          id: 1,
          content: 'stale comment',
          author: { name: 'Manager' },
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      ticketHistory: { create: jest.fn() },
    };
    const db = {
      user: { findUnique: jest.fn().mockResolvedValue({ departmentId: 7 }) },
      ticket: {
        findUnique: jest.fn().mockResolvedValue(ticket),
        count: jest.fn().mockResolvedValue(0),
      },
      ticketComment: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ content: 'Private discussion' }]),
      },
      $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) =>
        work(tx),
      ),
    };
    const prisma = db as unknown as PrismaService;
    const outbox = { enqueue: jest.fn() };
    const service = new TicketCommentService(
      prisma,
      outbox,
      new TicketAccessPolicyService(prisma),
    );
    return { service, tx, outbox };
  }

  it('rejects a comment after the manager leaves the requester department', async () => {
    const { service, tx, outbox } = setup();
    await expect(
      service.addComment(ticket.id, { content: 'stale comment' }, manager),
    ).rejects.toThrow(ForbiddenException);
    expect(tx.ticketComment.create).not.toHaveBeenCalled();
    expect(tx.ticketHistory.create).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('rejects reading discussion after the manager leaves the requester department', async () => {
    const { service, tx } = setup();
    await expect(service.getComments(ticket.id, manager)).rejects.toThrow(
      ForbiddenException,
    );
    expect(tx.ticketComment.findMany).not.toHaveBeenCalled();
  });
});
