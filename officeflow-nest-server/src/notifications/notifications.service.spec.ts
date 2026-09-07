import { Test, type TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const mockPrismaService = {
  notification: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.notification.createMany.mockResolvedValue({ count: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  it('uses the outbox event id to make notification creation idempotent', async () => {
    await expect(
      service.create({
        userId: 7,
        type: NotificationType.TICKET_ASSIGNED,
        title: 'Ticket assigned',
        message: 'A ticket was assigned to you',
        targetUrl: '/tickets/42',
        sourceEventId: 'f93fc842-2cf2-4f4b-8791-824457674900',
      }),
    ).resolves.toEqual({ count: 1 });

    expect(mockPrismaService.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 7,
          sourceEventId: 'f93fc842-2cf2-4f4b-8791-824457674900',
        }),
      ],
      skipDuplicates: true,
    });
    expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
  });

  it('should return the updated notification after marking it as read', async () => {
    const notification = {
      id: 5,
      userId: 7,
      type: NotificationType.TICKET_ASSIGNED,
      title: 'Ticket assigned',
      message: 'A ticket was assigned to you',
      targetUrl: '/tickets/1',
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updatedNotification = {
      ...notification,
      isRead: true,
    };
    mockPrismaService.notification.findUnique.mockResolvedValue(notification);
    mockPrismaService.notification.update.mockResolvedValue(
      updatedNotification,
    );

    await expect(service.markAsRead(5, 7)).resolves.toEqual(
      updatedNotification,
    );
  });
});
