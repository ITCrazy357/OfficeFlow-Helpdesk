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
import { PrismaService } from '../prisma/prisma.service';

const mockTransaction = {
  ticket: {
    delete: jest.fn(),
    findUnique: jest.fn(),
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

describe('TicketsService', () => {
  let service: TicketsService;

  beforeEach(async () => {
    jest.clearAllMocks();
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

  it('should preserve resolveAt and side effects when status does not change', async () => {
    const unchangedTicket = {
      id: 5,
      title: 'VPN issue',
      description: 'Cannot connect to VPN',
      status: TicketStatus.RESOLVED,
      priority: 'MEDIUM',
      dueAt: new Date(),
      resolveAt: new Date('2026-08-01T10:00:00.000Z'),
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
        { status: TicketStatus.RESOLVED },
        { userId: 1, role: UserRole.ADMIN },
      ),
    ).resolves.toEqual(unchangedTicket);

    expect(mockTransaction.ticket.updateMany).not.toHaveBeenCalled();
    expect(mockTransaction.ticketHistory.create).not.toHaveBeenCalled();
    expect(mockAuditLogsService.create).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

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
        { status: TicketStatus.CLOSED },
        { userId: 1, role: UserRole.ADMIN },
      ),
    ).rejects.toThrow('Ticket status changed concurrently');

    expect(mockTransaction.ticketHistory.create).not.toHaveBeenCalled();
    expect(mockAuditLogsService.create).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('should reject assigning a ticket to an inactive IT user', async () => {
    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      title: 'VPN issue',
      assignedToId: null,
    });
    mockPrismaService.user.findUnique.mockResolvedValue({
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

    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it('should reject assigning a ticket to a locked IT user', async () => {
    mockPrismaService.ticket.findUnique.mockResolvedValue({
      id: 5,
      title: 'VPN issue',
      assignedToId: null,
    });
    mockPrismaService.user.findUnique.mockResolvedValue({
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

    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
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
    mockPrismaService.ticket.findUnique
      .mockResolvedValueOnce({
        id: 5,
        createdById: 2,
        createdBy: { departmentId: 1 },
      })
      .mockResolvedValueOnce({
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
    expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
      'officeflow/ticket-attachments/report',
      'raw',
      'authenticated',
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

    expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
      'officeflow/ticket-attachments/recording',
      'video',
      'authenticated',
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

  it('should not delete the database record when Cloudinary deletion fails', async () => {
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

    await expect(service.deleteAttachment(5, 20, currentUser)).rejects.toThrow(
      'Cloudinary unavailable',
    );
    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
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
