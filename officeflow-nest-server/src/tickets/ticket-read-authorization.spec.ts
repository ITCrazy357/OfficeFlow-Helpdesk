import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type Prisma, UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OutboxService } from '../outbox/outbox.service';
import { TicketAccessPolicyService } from './ticket-access-policy.service';
import { TicketQueryService } from './ticket-query.service';
import { TicketAttachmentService } from './ticket-attachment.service';
import { TicketFeedbackService } from './ticket-feedback.service';

describe('Ticket reads after a manager department change', () => {
  const actor = { userId: 3, role: UserRole.MANAGER };
  const ticket = {
    id: 5,
    title: 'Private ticket',
    createdById: 2,
    createdBy: { id: 2, departmentId: 7 },
    resolutionVersion: 1,
    confirmedAt: null,
  };
  const attachment = {
    fileName: 'private.pdf',
    fileUrl: 'https://res.cloudinary.com/test/raw/authenticated/private.pdf',
    fileType: 'application/pdf',
    publicId: 'fixture',
    resourceType: 'raw',
    deliveryType: 'authenticated',
    format: 'pdf',
  };
  function setup() {
    const tx = {
      user: { findUnique: jest.fn().mockResolvedValue({ departmentId: 8 }) },
      ticket: {
        findUnique: jest.fn().mockResolvedValue(ticket),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      ticketHistory: { findMany: jest.fn().mockResolvedValue([]) },
      ticketAttachment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(attachment),
      },
      ticketFeedback: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ score: 1, comment: 'Private feedback' }),
      },
    };
    const db = {
      ...tx,
      user: { findUnique: jest.fn().mockResolvedValue({ departmentId: 7 }) },
      ticket: {
        findUnique: jest.fn().mockResolvedValue(ticket),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([ticket]),
      },
      $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) =>
        work(tx),
      ),
    };
    const prisma = db as unknown as PrismaService;
    const access = new TicketAccessPolicyService(prisma);
    const cloud = {
      createPrivateDownloadUrl: jest
        .fn()
        .mockReturnValue({ url: attachment.fileUrl, expiresAt: new Date() }),
      downloadFile: jest.fn().mockResolvedValue(Buffer.from('fixture')),
    };
    const query = new TicketQueryService(prisma, access);
    const files = new TicketAttachmentService(
      prisma,
      cloud as unknown as CloudinaryService,
      new OutboxService(),
      access,
    );
    const feedback = new TicketFeedbackService(
      prisma,
      access,
      new AuditLogsService(prisma),
      new OutboxService(),
      new EventEmitter2(),
    );
    const reads: Record<string, () => Promise<unknown>> = {
      detail: () => query.canGetById(5, actor),
      history: () => query.getHistory(5, actor),
      attachments: () => files.getAttachments(5, actor),
      url: () => files.getAttachmentAccessUrl(5, 10, actor, false),
      download: () => files.downloadAttachment(5, 10, actor),
      feedback: () => feedback.get(5, actor),
    };
    return { query, reads, cloud, tx };
  }

  it.each(['detail', 'history', 'attachments', 'url', 'download', 'feedback'])(
    'rejects %s using the current department before exposing private data',
    async (method) => {
      const { reads, cloud } = setup();
      await expect(reads[method]()).rejects.toThrow(ForbiddenException);
      expect(cloud.createPrivateDownloadUrl).not.toHaveBeenCalled();
      expect(cloud.downloadFile).not.toHaveBeenCalled();
    },
  );

  it('builds list scope from the current department and keeps the count in the same snapshot', async () => {
    const { query, tx } = setup();
    await expect(query.getTickets(actor, {})).resolves.toMatchObject({
      items: [],
      pagination: { totalItems: 0 },
    });
    const [args] = tx.ticket.findMany.mock.calls[0] as [
      Prisma.TicketFindManyArgs,
    ];
    expect(args.where?.OR).toContainEqual({ createdBy: { departmentId: 8 } });
  });
});
