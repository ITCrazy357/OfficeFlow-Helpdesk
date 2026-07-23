import { Test, TestingModule } from '@nestjs/testing';
import {
  Prisma,
  TicketHistoryAction,
  UserRole,
  type TicketAttachment,
} from '@prisma/client';

import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

const mockTransaction = {
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
    );
  });

  it('should delete an employee own attachment and write history atomically', async () => {
    const currentUser = {
      userId: 10,
      role: UserRole.EMPLOYEE,
    };
    const attachment: Pick<
      TicketAttachment,
      'fileName' | 'fileUrl' | 'publicId' | 'resourceType' | 'uploadedById'
    > = {
      fileName: 'recording.mp4',
      fileUrl: 'https://res.cloudinary.com/demo/video/upload/v1/recording.mp4',
      publicId: 'officeflow/ticket-attachments/recording',
      resourceType: 'video',
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
      uploadedById: 30,
    });

    await expect(service.deleteAttachment(5, 20, currentUser)).rejects.toThrow(
      'Forbidden',
    );
    expect(mockCloudinaryService.deleteFile).not.toHaveBeenCalled();
    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });
});
