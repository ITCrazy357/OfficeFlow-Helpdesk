import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AssetStatus, UserRole } from '@prisma/client';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import {
  OUTBOX_EVENT_TYPES,
  type OutboxDispatchedEvent,
  type OutboxEventPayloadByType,
} from '../outbox/outbox.constants';
import { runSerializableTransaction } from '../common/database/serializable-transaction.util';
import { NotificationsService } from '../notifications/notifications.service';
import { warrantyWindow, warrantyCalendarDate } from './asset-care.util';
import { getSafeErrorDetails } from '../common/diagnostics/request-diagnostics';

type WarrantyEvent = OutboxEventPayloadByType['asset.warranty_expiring'] &
  OutboxDispatchedEvent;
const recipientsWhere = {
  role: { in: [UserRole.ADMIN, UserRole.IT_STAFF] },
  isActive: true,
  isLocked: false,
};

@Injectable()
export class AssetWarrantyReminderService {
  private readonly logger = new Logger(AssetWarrantyReminderService.name);
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async notifyExpiringWarranties() {
    if (this.running) return;
    this.running = true;
    try {
      const { start, end } = warrantyWindow();
      const eligible = {
        warrantyUntil: { gte: start, lt: end },
        status: { notIn: [AssetStatus.RETIRED, AssetStatus.LOST] },
      };
      let cursor = 0;
      while (true) {
        const assets = await this.prisma.asset.findMany({
          where: { ...eligible, id: { gt: cursor } },
          orderBy: { id: 'asc' },
          take: 100,
          select: { id: true, warrantyUntil: true },
        });
        if (!assets.length) break;
        const keys = assets.map((asset) => ({
          assetId: asset.id,
          warrantyDate: new Date(warrantyCalendarDate(asset.warrantyUntil!)),
        }));
        const sent = await this.prisma.assetWarrantyReminder.findMany({
          where: { OR: keys },
          select: { assetId: true, warrantyDate: true },
        });
        const sentKeys = new Set(
          sent.map(
            (row) =>
              `${row.assetId}:${row.warrantyDate.toISOString().slice(0, 10)}`,
          ),
        );
        const pending = keys.filter(
          (row) =>
            !sentKeys.has(
              `${row.assetId}:${row.warrantyDate.toISOString().slice(0, 10)}`,
            ),
        );
        for (const key of pending) {
          await runSerializableTransaction(this.prisma, async (tx) => {
            const asset = await tx.asset.findFirst({
              where: { id: key.assetId, ...eligible },
              select: {
                id: true,
                assetTag: true,
                name: true,
                warrantyUntil: true,
              },
            });
            if (
              !asset ||
              warrantyCalendarDate(asset.warrantyUntil!) !==
                key.warrantyDate.toISOString().slice(0, 10)
            )
              return;
            const alreadySent = await tx.assetWarrantyReminder.findUnique({
              where: { assetId_warrantyDate: key },
            });
            if (alreadySent) return;
            const recipients = await tx.user.findMany({
              where: recipientsWhere,
              select: { id: true },
            });
            if (!recipients.length) return;
            await tx.assetWarrantyReminder.create({ data: key });
            await this.outbox.enqueue(tx, {
              type: OUTBOX_EVENT_TYPES.ASSET_WARRANTY_EXPIRING,
              payload: {
                assetId: asset.id,
                assetTag: asset.assetTag,
                assetName: asset.name,
                warrantyDate: key.warrantyDate.toISOString().slice(0, 10),
                recipientIds: recipients.map((user) => user.id),
              },
              deduplicationKey: `asset-warranty:${asset.id}:${key.warrantyDate.toISOString().slice(0, 10)}`,
            });
          });
        }
        cursor = assets[assets.length - 1].id;
        if (assets.length < 100) break;
      }
    } catch (error) {
      this.logger.error({
        event: 'asset_warranty_reminder_failed',
        ...getSafeErrorDetails(error),
      });
      throw error;
    } finally {
      this.running = false;
    }
  }
}

@Injectable()
export class AssetWarrantyNotificationListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent('asset.warranty_expiring', { suppressErrors: false })
  async handle(event: WarrantyEvent) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: event.assetId },
      select: { status: true, warrantyUntil: true },
    });
    if (
      !asset ||
      asset.status === 'RETIRED' ||
      asset.status === 'LOST' ||
      !asset.warrantyUntil ||
      warrantyCalendarDate(asset.warrantyUntil) !== event.warrantyDate
    )
      return;
    const recipients = await this.prisma.user.findMany({
      where: { ...recipientsWhere, id: { in: event.recipientIds } },
      select: { id: true },
    });
    await this.notifications.createdMany({
      userIds: recipients.map((user) => user.id),
      type: 'ASSET_WARRANTY_EXPIRING',
      title: 'Tài sản sắp hết bảo hành',
      message: `${event.assetName} (${event.assetTag}) có hạn bảo hành đến ${event.warrantyDate}.`,
      targetUrl: `/assets/${event.assetId}`,
      sourceEventId: event.outboxEventId,
    });
  }
}
