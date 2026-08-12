import { Test, type TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const mockPrismaService = {
  notification: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

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
