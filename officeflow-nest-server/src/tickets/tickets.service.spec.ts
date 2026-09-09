import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Prisma,
  TicketHistoryAction,
  TicketStatus,
  UserRole,
  type TicketAttachment,
} from '@prisma/client';

import { TicketsService } from './tickets.service';
import { TicketSlaFilter } from './dto/get-tickets-query.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';

const mockTransaction = {
  user: { findUnique: jest.fn() },
  ticket: {
    update: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    updateMany: jest.fn(),
  },
  ticketComment: {
    create: jest.fn(),
  },
  ticketAttachment: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  ticketHistory: {
    create: jest.fn(),
  },
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
  ticket: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  ticketAttachment: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockCloudinaryService = {
  createPrivateDownloadUrl: jest.fn(),
  downloadFile: jest.fn(),
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
  emitAsync: jest.fn().mockResolvedValue([]),
};

const mockAuditLogsService = {
  create: jest.fn(),
};

const mockOutboxService = {
  enqueue: jest.fn().mockResolvedValue({ id: 'outbox-event-id' }),
};

describe('TicketsService', () => {
  let service: TicketsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTransaction.user.findUnique.mockReset().mockResolvedValue({
      id: 3,
      name: 'Admin',
      role: UserRole.IT_STAFF,
      isActive: true,
      isLocked: false,
    });
    mockPrismaService.$transaction.mockImplementation(
      async (
        callback: (transaction: typeof mockTransaction) => Promise<unknown>,
      ) => callback(mockTransaction),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CloudinaryService,
          useValue: mockCloudinaryService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
        {
          provide: OutboxService,
          useValue: mockOutboxService,
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  it('should get only own tickets for EMPLOYEE', async () => {
    const currentUser = {
      userId: 10,
      role: UserRole.EMPLOYEE,
    };

    const query = {
      page: 1,
      limit: 10,
    };

    mockPrismaService.ticket.findMany.mockResolvedValue([]);
    mockPrismaService.ticket.count.mockResolvedValue(0);

    const result = await service.getTickets(currentUser, query);

    expect(mockPrismaService.ticket.findMany).toHaveBeenCalledTimes(1);
    const [findManyArgs] = mockPrismaService.ticket.findMany.mock.calls[0] as [
      Prisma.TicketFindManyArgs,
    ];
    expect(findManyArgs.where).toMatchObject({ createdById: 10 });

    expect(result).toEqual({
      items: [],
      pagination: {
        page: 1,
        limit: 10,
        totalItems: 0,
        totalPages: 0,
      },
    });
  });

  it('should apply distinct SLA filters using the 24-hour threshold', async () => {
    jest.useFakeTimers();
    const now = new Date('2026-07-31T08:00:00.000Z');
    const dueSoonAt = new Date('2026-08-01T08:00:00.000Z');
    jest.setSystemTime(now);
    mockPrismaService.ticket.findMany.mockResolvedValue([]);
    mockPrismaService.ticket.count.mockResolvedValue(0);

    try {
      await service.getTickets(
        {
          userId: 1,
          role: UserRole.ADMIN,
        },
        {
          slaState: TicketSlaFilter.DUE_SOON,
        },
      );

      let [findManyArgs] = mockPrismaService.ticket.findMany.mock.calls.at(
        -1,
      ) as [Prisma.TicketFindManyArgs];
      expect(findManyArgs.where).toMatchObject({
        AND: {
          isOverdue: false,
          status: {
            notIn: [
              TicketStatus.RESOLVED,
              TicketStatus.CLOSED,
              TicketStatus.CANCELLED,
            ],
          },
          dueAt: {
            gt: now,
            lte: dueSoonAt,
          },
        },
      });

      await service.getTickets(
        {
          userId: 1,
          role: UserRole.ADMIN,
        },
        {
          slaState: TicketSlaFilter.ON_TRACK,
        },
      );

      [findManyArgs] = mockPrismaService.ticket.findMany.mock.calls.at(-1) as [
        Prisma.TicketFindManyArgs,
      ];
      expect(findManyArgs.where).toMatchObject({
        AND: {
          isOverdue: false,
          status: {
            notIn: [
              TicketStatus.RESOLVED,
              TicketStatus.CLOSED,
              TicketStatus.CANCELLED,
            ],
          },
          dueAt: {
            gt: dueSoonAt,
          },
        },
      });

      await service.getTickets(
        {
          userId: 1,
          role: UserRole.ADMIN,
        },
        {
          slaState: TicketSlaFilter.OVERDUE,
        },
      );

      [findManyArgs] = mockPrismaService.ticket.findMany.mock.calls.at(-1) as [
        Prisma.TicketFindManyArgs,
      ];
      expect(findManyArgs.where).toMatchObject({
        AND: {
          OR: [
            {
              isOverdue: true,
            },
            {
              isOverdue: false,
              dueAt: {
                lte: now,
              },
              status: {
                notIn: [
                  TicketStatus.RESOLVED,
                  TicketStatus.CLOSED,
                  TicketStatus.CANCELLED,
                ],
              },
            },
          ],
        },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('should forbid a manager from updating a ticket outside their department', async () => {
    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      title: 'VPN issue',
      description: 'Cannot connect to VPN',
      status: TicketStatus.OPEN,
      priority: 'MEDIUM',
      dueAt: new Date(),
      resolveAt: null,
      isOverdue: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdById: 20,
      assignedToId: null,
      categoryId: null,
      createdBy: {
        departmentId: 2,
      },
    });
    mockPrismaService.user.findUnique.mockResolvedValue({ departmentId: 1 });

    await expect(
      service.update(
        5,
        { title: 'Updated VPN issue' },
        { userId: 30, role: UserRole.MANAGER },
      ),
    ).rejects.toThrow('Forbidden');

    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it.each(Object.values(TicketStatus))(
    'should preserve %s without side effects when status does not change',
    async (status) => {
      const unchangedTicket = {
        id: 5,
        title: 'VPN issue',
        description: 'Cannot connect to VPN',
        status,
        priority: 'MEDIUM',
        dueAt: new Date(),
        resolveAt:
          status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED
            ? new Date('2026-08-01T10:00:00.000Z')
            : null,
        isOverdue: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: { id: 2, name: 'Employee', email: 'employee@example.com' },
        assignedTo: null,
        category: null,
      };
      mockTransaction.ticket.findUnique.mockResolvedValue(unchangedTicket);

      await expect(
        service.updateStatus(
          unchangedTicket.id,
          { status },
          { userId: 1, role: UserRole.ADMIN },
        ),
      ).resolves.toEqual(unchangedTicket);

      expect(mockTransaction.ticket.updateMany).not.toHaveBeenCalled();
      expect(mockTransaction.ticketHistory.create).not.toHaveBeenCalled();
      expect(mockAuditLogsService.create).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
      expect(mockEventEmitter.emitAsync).not.toHaveBeenCalled();
      expect(mockOutboxService.enqueue).not.toHaveBeenCalled();
    },
  );

  it('should reject a stale concurrent status update without side effects', async () => {
    mockTransaction.ticket.findUnique.mockResolvedValue({
      id: 5,
      title: 'VPN issue',
      description: 'Cannot connect to VPN',
      status: TicketStatus.OPEN,
      priority: 'MEDIUM',
      dueAt: new Date(),
      resolveAt: null,
      isOverdue: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: { id: 2, name: 'Employee', email: 'employee@example.com' },
      assignedTo: null,
      category: null,
    });
    mockTransaction.ticket.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateStatus(
        5,
        { status: TicketStatus.IN_PROGRESS },
        { userId: 1, role: UserRole.ADMIN },
      ),
    ).rejects.toThrow('Ticket status changed concurrently');

    expect(mockTransaction.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 5, status: TicketStatus.OPEN },
      data: { status: TicketStatus.IN_PROGRESS, resolveAt: null },
    });
    expect(mockTransaction.ticketHistory.create).not.toHaveBeenCalled();
    expect(mockAuditLogsService.create).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    expect(mockOutboxService.enqueue).not.toHaveBeenCalled();
    expect(mockEventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it.each([
    [TicketStatus.CLOSED, TicketStatus.OPEN],
    [TicketStatus.OPEN, TicketStatus.CLOSED],
    [TicketStatus.CANCELLED, TicketStatus.IN_PROGRESS],
  ])(
    'should reject forbidden %s -> %s before writing any side effects',
    async (currentStatus, nextStatus) => {
      mockTransaction.ticket.findUnique.mockResolvedValue({
        id: 5,
        title: 'VPN issue',
        description: 'Cannot connect to VPN',
        status: currentStatus,
        priority: 'MEDIUM',
        dueAt: new Date(),
        resolveAt: null,
        isOverdue: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: { id: 2, name: 'Employee', email: 'employee@example.com' },
        assignedTo: null,
        category: null,
      });
      await expect(
        service.updateStatus(
          5,
          { status: nextStatus },
          { userId: 1, role: UserRole.ADMIN },
        ),
      ).rejects.toThrow(
        `Cannot change ticket status from ${currentStatus} to ${nextStatus}`,
      );

      expect(mockTransaction.ticket.updateMany).not.toHaveBeenCalled();
      expect(mockTransaction.ticketHistory.create).not.toHaveBeenCalled();
      expect(mockAuditLogsService.create).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
      expect(mockOutboxService.enqueue).not.toHaveBeenCalled();
      expect(mockEventEmitter.emitAsync).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      from: TicketStatus.IN_PROGRESS,
      to: TicketStatus.RESOLVED,
      previousResolveAt: null,
      expectedResolveAt: new Date('2026-09-08T12:00:00.000Z'),
    },
    {
      from: TicketStatus.RESOLVED,
      to: TicketStatus.CLOSED,
      previousResolveAt: new Date('2026-09-08T10:00:00.000Z'),
      expectedResolveAt: new Date('2026-09-08T10:00:00.000Z'),
    },
    {
      from: TicketStatus.RESOLVED,
      to: TicketStatus.IN_PROGRESS,
      previousResolveAt: new Date('2026-09-08T10:00:00.000Z'),
      expectedResolveAt: null,
    },
  ])(
    'should update $from -> $to with the correct resolveAt and transactional events',
    async ({ from, to, previousResolveAt, expectedResolveAt }) => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
      try {
        const currentTicket = {
          id: 5,
          title: 'VPN issue',
          status: from,
          resolveAt: previousResolveAt,
          dueAt: new Date('2026-09-08T09:00:00.000Z'),
          isOverdue: true,
          createdBy: { id: 2 },
          assignedTo: { id: 3 },
        };
        const updatedTicket = {
          ...currentTicket,
          status: to,
          resolveAt: expectedResolveAt,
        };
        mockPrismaService.user.findUnique.mockResolvedValue({ name: 'Admin' });
        mockTransaction.ticket.findUnique
          .mockResolvedValueOnce(currentTicket)
          .mockResolvedValueOnce(updatedTicket);
        mockTransaction.ticket.updateMany.mockResolvedValue({ count: 1 });

        await expect(
          service.updateStatus(
            5,
            { status: to },
            { userId: 1, role: UserRole.ADMIN },
          ),
        ).resolves.toEqual(updatedTicket);

        // Exact data also proves that changing status does not overwrite SLA fields.
        expect(mockTransaction.ticket.updateMany).toHaveBeenCalledWith({
          where: { id: 5, status: from },
          data: { status: to, resolveAt: expectedResolveAt },
        });
        expect(mockTransaction.ticketHistory.create).toHaveBeenCalledTimes(1);
        expect(mockTransaction.ticketHistory.create).toHaveBeenCalledWith({
          data: {
            ticketId: 5,
            userId: 1,
            action: TicketHistoryAction.STATUS_CHANGED,
            oldValue: from,
            newValue: to,
          },
        });
        expect(mockAuditLogsService.create).toHaveBeenCalledTimes(1);
        expect(mockAuditLogsService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            oldValues: { status: from },
            newValues: { status: to },
          }),
          mockTransaction,
        );
        expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
          mockTransaction,
          {
            type: 'ticket.status_changed',
            payload: {
              ticketId: 5,
              ticketTitle: 'VPN issue',
              changedById: 1,
              changedByName: 'Admin',
              oldStatus: from,
              newStatus: to,
              recipientIds: [2, 3],
            },
          },
        );
        expect(mockOutboxService.enqueue).toHaveBeenCalledTimes(
          to === TicketStatus.RESOLVED ? 2 : 1,
        );
        if (to === TicketStatus.RESOLVED) {
          expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
            mockTransaction,
            {
              type: 'ticket.resolved',
              payload: {
                ticketId: 5,
                ticketTitle: 'VPN issue',
                resolverId: 1,
                resolverName: 'Admin',
                recipientIds: [2, 3],
              },
            },
          );
        }
        expect(mockEventEmitter.emitAsync).toHaveBeenCalledTimes(1);
        expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
          'dashboard.cache.invalidate',
          expect.objectContaining({
            reason: 'TICKET_STATUS_CHANGED',
            entityId: 5,
          }),
        );
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('should reject assigning a ticket to an inactive IT user', async () => {
    mockTransaction.ticket.findUnique.mockResolvedValue({
      id: 5,
      title: 'VPN issue',
      assignedToId: null,
    });
    mockTransaction.user.findUnique.mockResolvedValue({
      id: 20,
      role: UserRole.IT_STAFF,
      isActive: false,
    });

    await expect(
      service.assign(
        5,
        { assignedToId: 20 },
        { userId: 1, role: UserRole.ADMIN },
      ),
    ).rejects.toThrow('Cannot assign ticket to an inactive user');

    expect(mockTransaction.ticket.update).not.toHaveBeenCalled();
    expect(mockPrismaService.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  });

  it('should reject assigning a ticket to a locked IT user', async () => {
    mockTransaction.ticket.findUnique.mockResolvedValue({
      id: 5,
      title: 'VPN issue',
      assignedToId: null,
    });
    mockTransaction.user.findUnique.mockResolvedValue({
      id: 20,
      role: UserRole.IT_STAFF,
      isActive: true,
      isLocked: true,
    });

    await expect(
      service.assign(
        5,
        { assignedToId: 20 },
        { userId: 1, role: UserRole.ADMIN },
      ),
    ).rejects.toThrow('Cannot assign ticket to a locked user');

    expect(mockTransaction.ticket.update).not.toHaveBeenCalled();
  });

  it.each([
    { role: UserRole.IT_STAFF, isActive: false, isLocked: false },
    { role: UserRole.IT_STAFF, isActive: true, isLocked: true },
    { role: UserRole.EMPLOYEE, isActive: true, isLocked: false },
  ])('rejects reopening work for an ineligible assignee: %j', async (state) => {
    mockTransaction.ticket.findUnique.mockReset().mockResolvedValue({
      id: 5,
      status: TicketStatus.RESOLVED,
      assignedTo: { id: 3 },
    });
    mockTransaction.user.findUnique.mockResolvedValue({ id: 3, ...state });
    await expect(
      service.updateStatus(
        5,
        { status: TicketStatus.IN_PROGRESS },
        { userId: 1, role: UserRole.ADMIN },
      ),
    ).rejects.toThrow();
    expect(mockTransaction.ticket.updateMany).not.toHaveBeenCalled();
    expect(mockOutboxService.enqueue).not.toHaveBeenCalled();
    expect(mockEventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it('assigns from transaction-local state with audit, history and outbox', async () => {
    mockTransaction.ticket.findUnique
      .mockReset()
      .mockResolvedValue({ id: 5, title: 'VPN', assignedToId: 4 });
    mockTransaction.ticket.update.mockResolvedValue({
      id: 5,
      assignedTo: { id: 3 },
    });
    await service.assign(
      5,
      { assignedToId: 3 },
      { userId: 1, role: UserRole.ADMIN },
    );
    expect(mockPrismaService.ticket.findUnique).not.toHaveBeenCalled();
    expect(mockTransaction.ticketHistory.create).toHaveBeenCalledWith({
      data: {
        ticketId: 5,
        userId: 1,
        action: TicketHistoryAction.ASSIGNED,
        oldValue: '4',
        newValue: '3',
      },
    });
    expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
      mockTransaction,
      expect.objectContaining({ type: 'ticket.assigned' }),
    );
  });

  it('should create a comment and bounded history in one transaction', async () => {
    const longComment = 'x'.repeat(300);
    const comment = {
      id: 10,
      content: longComment,
      createdAt: new Date(),
      author: {
        id: 1,
        name: 'Admin',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      },
    };
    mockPrismaService.ticket.findUnique.mockResolvedValueOnce({
      id: 5,
      createdById: 2,
      createdBy: { departmentId: 1 },
    });
    mockTransaction.ticket.findUniqueOrThrow.mockResolvedValue({
      id: 5,
      title: 'VPN issue',
      createdById: 2,
      assignedToId: null,
    });
    mockTransaction.ticketComment.create.mockResolvedValue(comment);
    mockTransaction.ticketHistory.create.mockResolvedValue({ id: 100 });

    await expect(
      service.addComment(
        5,
        { content: longComment },
        { userId: 1, role: UserRole.ADMIN },
      ),
    ).resolves.toEqual(comment);

    expect(mockTransaction.ticketComment.create).toHaveBeenCalledTimes(1);
    expect(mockTransaction.ticketHistory.create).toHaveBeenCalledWith({
      data: {
        ticketId: 5,
        userId: 1,
        action: TicketHistoryAction.COMMENTED,
        newValue: longComment.slice(0, 191),
      },
    });
  });

  it('should return attachment IDs in deterministic newest-first order', async () => {
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };
    const attachments = [
      {
        id: 20,
        fileName: 'error.png',
        fileUrl: 'https://res.cloudinary.com/demo/image/upload/error.png',
        fileType: 'image/png',
        fileSize: 1024,
        createdAt: new Date(),
        uploadedBy: {
          id: 1,
          name: 'Admin',
          email: 'admin@example.com',
          role: UserRole.ADMIN,
        },
      },
    ];

    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      createdById: 2,
      createdBy: { departmentId: 1 },
    });
    mockPrismaService.ticketAttachment.findMany.mockResolvedValue(attachments);

    await expect(service.getAttachments(5, currentUser)).resolves.toEqual(
      attachments,
    );
    expect(mockPrismaService.ticketAttachment.findMany).toHaveBeenCalledTimes(
      1,
    );
    const [findAttachmentsArgs] = mockPrismaService.ticketAttachment.findMany
      .mock.calls[0] as [Prisma.TicketAttachmentFindManyArgs];
    expect(findAttachmentsArgs.where).toEqual({ ticketId: 5 });
    expect(findAttachmentsArgs.select).toMatchObject({ id: true });
    expect(findAttachmentsArgs.orderBy).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('should create a signed URL for an authenticated attachment', async () => {
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };
    const accessResult = {
      url: 'https://api.cloudinary.com/private-download',
      expiresAt: new Date('2027-01-15T08:05:00.000Z'),
    };

    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      createdById: 2,
      createdBy: { departmentId: 1 },
    });
    mockPrismaService.ticketAttachment.findUnique.mockResolvedValue({
      fileUrl: 'https://res.cloudinary.com/demo/raw/authenticated/report.pdf',
      publicId: 'officeflow/ticket-attachments/report',
      resourceType: 'raw',
      deliveryType: 'authenticated',
      format: 'pdf',
    });
    mockCloudinaryService.createPrivateDownloadUrl.mockReturnValue(
      accessResult,
    );

    await expect(
      service.getAttachmentAccessUrl(5, 20, currentUser, false),
    ).resolves.toEqual(accessResult);
    expect(mockCloudinaryService.createPrivateDownloadUrl).toHaveBeenCalledWith(
      'officeflow/ticket-attachments/report',
      'pdf',
      'raw',
      'authenticated',
      false,
    );
  });

  it('should return the existing URL for a legacy public attachment', async () => {
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };

    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      createdById: 2,
      createdBy: { departmentId: 1 },
    });
    mockPrismaService.ticketAttachment.findUnique.mockResolvedValue({
      fileUrl: 'https://res.cloudinary.com/demo/image/upload/legacy.png',
      publicId: 'officeflow/ticket-attachments/legacy',
      resourceType: 'image',
      deliveryType: 'upload',
      format: null,
    });

    await expect(
      service.getAttachmentAccessUrl(5, 20, currentUser, true),
    ).resolves.toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/legacy.png',
      expiresAt: null,
    });
    expect(
      mockCloudinaryService.createPrivateDownloadUrl,
    ).not.toHaveBeenCalled();
  });

  it('should download an authorized attachment with its original metadata', async () => {
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };
    const file = Buffer.from('%PDF-1.7');

    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      createdById: 2,
      createdBy: { departmentId: 1 },
    });
    mockPrismaService.ticketAttachment.findUnique.mockResolvedValue({
      fileName: 'Báo cáo quý 1.pdf',
      fileUrl: 'https://res.cloudinary.com/demo/raw/authenticated/report.pdf',
      fileType: 'application/pdf',
      publicId: 'officeflow/ticket-attachments/report',
      resourceType: 'raw',
      deliveryType: 'authenticated',
      format: 'pdf',
    });
    mockCloudinaryService.createPrivateDownloadUrl.mockReturnValue({
      url: 'https://api.cloudinary.com/private-download',
      expiresAt: new Date('2027-01-15T08:05:00.000Z'),
    });
    mockCloudinaryService.downloadFile.mockResolvedValue(file);

    await expect(
      service.downloadAttachment(5, 20, currentUser),
    ).resolves.toEqual({
      file,
      fileName: 'Báo cáo quý 1.pdf',
      contentType: 'application/pdf',
    });
    expect(mockCloudinaryService.createPrivateDownloadUrl).toHaveBeenCalledWith(
      'officeflow/ticket-attachments/report',
      'pdf',
      'raw',
      'authenticated',
      true,
    );
    expect(mockCloudinaryService.downloadFile).toHaveBeenCalledWith(
      'https://api.cloudinary.com/private-download',
    );
  });

  it('should reject incomplete metadata for a protected attachment', async () => {
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };

    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      createdById: 2,
      createdBy: { departmentId: 1 },
    });
    mockPrismaService.ticketAttachment.findUnique.mockResolvedValue({
      fileUrl: 'https://res.cloudinary.com/demo/raw/authenticated/report.pdf',
      publicId: 'officeflow/ticket-attachments/report',
      resourceType: 'raw',
      deliveryType: 'authenticated',
      format: null,
    });

    await expect(
      service.getAttachmentAccessUrl(5, 20, currentUser, true),
    ).rejects.toThrow('Attachment delivery metadata is incomplete');
    expect(
      mockCloudinaryService.createPrivateDownloadUrl,
    ).not.toHaveBeenCalled();
  });

  it('should save the detected Cloudinary resource type when uploading', async () => {
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };
    const file = {
      originalname: 'recording.mp4',
      mimetype: 'video/mp4',
      size: 2048,
    } as Express.Multer.File;
    const createdAttachment = {
      id: 20,
      fileName: 'recording.mp4',
      fileUrl: 'https://res.cloudinary.com/demo/video/upload/v1/recording.mp4',
      fileType: 'video/mp4',
      fileSize: 2048,
      createdAt: new Date(),
      uploadedBy: {
        id: 1,
        name: 'Admin',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      },
    };

    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      createdById: 2,
      createdBy: { departmentId: 1 },
    });
    mockCloudinaryService.uploadFile.mockResolvedValue({
      publicId: 'officeflow/ticket-attachments/recording',
      resourceType: 'video',
      deliveryType: 'authenticated',
      format: 'mp4',
      secureUrl:
        'https://res.cloudinary.com/demo/video/upload/v1/recording.mp4',
    });
    mockTransaction.ticketAttachment.create.mockResolvedValue(
      createdAttachment,
    );
    mockTransaction.ticketHistory.create.mockResolvedValue({ id: 100 });

    await expect(
      service.uploadAttachment(5, file, currentUser),
    ).resolves.toEqual(createdAttachment);
    expect(mockTransaction.ticketAttachment.create).toHaveBeenCalledTimes(1);
    const [createAttachmentArgs] = mockTransaction.ticketAttachment.create.mock
      .calls[0] as [Prisma.TicketAttachmentCreateArgs];
    expect(createAttachmentArgs.data).toMatchObject({
      publicId: 'officeflow/ticket-attachments/recording',
      resourceType: 'video',
      deliveryType: 'authenticated',
      format: 'mp4',
    });
    expect(mockTransaction.ticketHistory.create).toHaveBeenCalledWith({
      data: {
        ticketId: 5,
        userId: 1,
        action: TicketHistoryAction.ATTACHMENT_ADDED,
        newValue: 'recording.mp4',
      },
    });
  });

  it('should use the delivery type when deleting ticket attachments', async () => {
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };

    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      title: 'Printer is unavailable',
      createdById: 2,
      status: TicketStatus.OPEN,
      attachments: [
        {
          id: 11,
          fileUrl:
            'https://res.cloudinary.com/demo/raw/authenticated/report.pdf',
          publicId: 'officeflow/ticket-attachments/report',
          resourceType: 'raw',
          deliveryType: 'authenticated',
        },
      ],
    });
    mockCloudinaryService.deleteFile.mockResolvedValue(undefined);
    mockTransaction.ticket.delete.mockResolvedValue({ id: 5 });
    mockAuditLogsService.create.mockResolvedValue({ id: 100 });

    await expect(service.remove(5, currentUser)).resolves.toEqual({ id: 5 });
    expect(mockCloudinaryService.deleteFile).not.toHaveBeenCalled();
    expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
      mockTransaction,
      expect.objectContaining({
        type: 'cloudinary.asset.delete',
        payload: {
          publicId: 'officeflow/ticket-attachments/report',
          resourceType: 'raw',
          deliveryType: 'authenticated',
        },
      }),
    );
    expect(mockTransaction.ticket.delete).toHaveBeenCalledWith({
      where: { id: 5 },
    });
  });

  it('should clean up Cloudinary when saving an upload fails', async () => {
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };
    const file = {
      originalname: 'report.pdf',
      mimetype: 'application/pdf',
      size: 2048,
    } as Express.Multer.File;

    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      createdById: 2,
      createdBy: { departmentId: 1 },
    });
    mockCloudinaryService.uploadFile.mockResolvedValue({
      publicId: 'officeflow/ticket-attachments/report.pdf',
      resourceType: 'raw',
      deliveryType: 'authenticated',
      format: 'pdf',
      secureUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/report.pdf',
    });
    mockPrismaService.$transaction.mockRejectedValueOnce(
      new Error('Database unavailable'),
    );
    mockCloudinaryService.deleteFile.mockResolvedValue(undefined);

    await expect(
      service.uploadAttachment(5, file, currentUser),
    ).rejects.toThrow('Database unavailable');
    expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
      'officeflow/ticket-attachments/report.pdf',
      'raw',
      'authenticated',
    );
  });

  it('should normalize the attachment name before saving metadata', async () => {
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };
    const file = {
      originalname: '  ..\\folder/\u0000report.pdf  ',
      mimetype: 'application/pdf',
      size: 2048,
    } as Express.Multer.File;

    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      createdById: 2,
      createdBy: { departmentId: 1 },
    });
    mockCloudinaryService.uploadFile.mockResolvedValue({
      publicId: 'officeflow/ticket-attachments/report.pdf',
      resourceType: 'raw',
      deliveryType: 'authenticated',
      format: 'pdf',
      secureUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/report.pdf',
    });
    mockTransaction.ticketAttachment.create.mockResolvedValue({
      id: 20,
      fileName: '.._folder_report.pdf',
    });
    mockTransaction.ticketHistory.create.mockResolvedValue({ id: 100 });

    await service.uploadAttachment(5, file, currentUser);

    expect(mockTransaction.ticketAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName: '.._folder_report.pdf',
        }) as object,
      }),
    );
    expect(mockTransaction.ticketHistory.create).toHaveBeenCalledWith({
      data: {
        ticketId: 5,
        userId: 1,
        action: TicketHistoryAction.ATTACHMENT_ADDED,
        newValue: '.._folder_report.pdf',
      },
    });
  });

  it('should reject an invalid attachment name before uploading', async () => {
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };
    const file = {
      originalname: '\u0000\u001f\u007f\t\n',
      mimetype: 'application/pdf',
      size: 2048,
    } as Express.Multer.File;

    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      createdById: 2,
      createdBy: { departmentId: 1 },
    });

    await expect(
      service.uploadAttachment(5, file, currentUser),
    ).rejects.toThrow('Attachment file name is invalid');
    expect(mockCloudinaryService.uploadFile).not.toHaveBeenCalled();
    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it('should delete an employee own attachment and write history atomically', async () => {
    const currentUser = {
      userId: 10,
      role: UserRole.EMPLOYEE,
    };
    const attachment: Pick<
      TicketAttachment,
      | 'fileName'
      | 'fileUrl'
      | 'publicId'
      | 'resourceType'
      | 'deliveryType'
      | 'uploadedById'
    > = {
      fileName: 'recording.mp4',
      fileUrl: 'https://res.cloudinary.com/demo/video/upload/v1/recording.mp4',
      publicId: 'officeflow/ticket-attachments/recording',
      resourceType: 'video',
      deliveryType: 'authenticated',
      uploadedById: 10,
    };

    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      createdById: 10,
      createdBy: { departmentId: 1 },
    });
    mockPrismaService.ticketAttachment.findUnique.mockResolvedValue(attachment);
    mockCloudinaryService.deleteFile.mockResolvedValue(undefined);
    mockTransaction.ticketAttachment.deleteMany.mockResolvedValue({ count: 1 });
    mockTransaction.ticketHistory.create.mockResolvedValue({ id: 100 });

    await expect(service.deleteAttachment(5, 20, currentUser)).resolves.toEqual(
      { id: 20 },
    );

    expect(mockCloudinaryService.deleteFile).not.toHaveBeenCalled();
    expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
      mockTransaction,
      expect.objectContaining({
        type: 'cloudinary.asset.delete',
        payload: {
          publicId: 'officeflow/ticket-attachments/recording',
          resourceType: 'video',
          deliveryType: 'authenticated',
        },
      }),
    );
    expect(mockTransaction.ticketAttachment.deleteMany).toHaveBeenCalledWith({
      where: { id: 20, ticketId: 5 },
    });
    expect(mockTransaction.ticketHistory.create).toHaveBeenCalledWith({
      data: {
        ticketId: 5,
        userId: 10,
        action: TicketHistoryAction.ATTACHMENT_DELETED,
        newValue: 'recording.mp4',
      },
    });
  });

  it('should commit attachment deletion without calling Cloudinary inline', async () => {
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };

    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      createdById: 2,
      createdBy: { departmentId: 1 },
    });
    mockPrismaService.ticketAttachment.findUnique.mockResolvedValue({
      fileName: 'report.pdf',
      fileUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/report.pdf',
      publicId: 'officeflow/ticket-attachments/report.pdf',
      resourceType: 'raw',
      deliveryType: 'authenticated',
      uploadedById: 2,
    });
    mockCloudinaryService.deleteFile.mockRejectedValue(
      new Error('Cloudinary unavailable'),
    );
    mockTransaction.ticketAttachment.deleteMany.mockResolvedValue({ count: 1 });
    mockTransaction.ticketHistory.create.mockResolvedValue({ id: 100 });

    await expect(service.deleteAttachment(5, 20, currentUser)).resolves.toEqual(
      { id: 20 },
    );
    expect(mockCloudinaryService.deleteFile).not.toHaveBeenCalled();
    expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
      mockTransaction,
      expect.objectContaining({
        type: 'cloudinary.asset.delete',
      }),
    );
  });

  it('propagates an outbox write failure through the delete transaction without touching Cloudinary', async () => {
    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      createdById: 2,
      createdBy: { departmentId: 1 },
    });
    mockPrismaService.ticketAttachment.findUnique.mockResolvedValue({
      fileName: 'report.pdf',
      publicId: 'report.pdf',
      resourceType: 'raw',
      deliveryType: 'authenticated',
      uploadedById: 2,
    });
    mockTransaction.ticketAttachment.deleteMany.mockResolvedValue({ count: 1 });
    mockOutboxService.enqueue.mockRejectedValueOnce(
      new Error('Outbox write failed'),
    );
    await expect(
      service.deleteAttachment(5, 20, { userId: 1, role: UserRole.ADMIN }),
    ).rejects.toThrow('Outbox write failed');
    expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
      mockTransaction,
      expect.any(Object),
    );
    expect(mockCloudinaryService.deleteFile).not.toHaveBeenCalled();
  });

  it('should forbid a manager from deleting an attachment', async () => {
    const currentUser = {
      userId: 30,
      role: UserRole.MANAGER,
    };

    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      createdById: 2,
      createdBy: { departmentId: 7 },
    });
    mockPrismaService.user.findUnique.mockResolvedValue({ departmentId: 7 });
    mockPrismaService.ticketAttachment.findUnique.mockResolvedValue({
      fileName: 'report.pdf',
      fileUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/report.pdf',
      publicId: 'officeflow/ticket-attachments/report.pdf',
      resourceType: 'raw',
      deliveryType: 'authenticated',
      uploadedById: 30,
    });

    await expect(service.deleteAttachment(5, 20, currentUser)).rejects.toThrow(
      'Forbidden',
    );
    expect(mockCloudinaryService.deleteFile).not.toHaveBeenCalled();
    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });
});
