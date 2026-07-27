import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, type Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    userId: number;
    type: NotificationType;
    title: string;
    message: string;
    targetUrl: string;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        targetUrl: params.targetUrl,
      },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        targetUrl: true,
        isRead: true,
        createdAt: true,
      },
    });
  }

  async createdMany(params: {
    userIds: number[];
    type: NotificationType;
    title: string;
    message: string;
    targetUrl: string;
  }) {
    const uniqueUserIds = [...new Set(params.userIds)];

    if (uniqueUserIds.length === 0) {
      return { count: 0 };
    }

    return this.prisma.notification.createMany({
      data: uniqueUserIds.map((userId) => ({
        userId,
        type: params.type,
        title: params.title,
        message: params.message,
        targetUrl: params.targetUrl,
      })),
    });
  }

  async findMine(userId: number, query: GetNotificationsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      userId,
    };

    if (typeof query.isRead === 'boolean') {
      where.isRead = query.isRead;
    }

    const [notifications, totalItems] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          targetUrl: true,
          isRead: true,
          createdAt: true,
        },
      }),

      this.prisma.notification.count({
        where,
      }),
    ]);

    return {
      items: notifications,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async getUnreadCount(userId: number) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      isRead: false,
    };

    return this.prisma.notification.count({
      where,
    });
  }

  async markAsRead(notificationId: number, userId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: {
        id: notificationId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Forbidden');
    }

    await this.prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        isRead: true,
      },
    });

    return notification;
  }

  async markAllAsRead(userId: number) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return {
      updatedCount: result.count,
    };
  }

  async remove(notificationId: number, userId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: {
        id: notificationId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Forbidden');
    }

    await this.prisma.notification.delete({
      where: {
        id: notificationId,
      },
    });

    return {
      id: notificationId,
    };
  }
}
