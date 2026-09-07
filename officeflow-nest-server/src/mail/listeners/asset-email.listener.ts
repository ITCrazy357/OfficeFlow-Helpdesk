import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { AssetAssignedEvent } from '../../notifications/events/asset-assigned.event';
import { AssetReturnedEvent } from '../../notifications/events/asset-returned.event';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail.service';
import { assetAssignedEmailTemplate } from '../templates/asset-assigned-email.template';
import { assetReturnedEmailTemplate } from '../templates/asset-returned-email.template';

@Injectable()
export class AssetEmailListener {
  private readonly logger = new Logger(AssetEmailListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  @OnEvent('asset.assigned', {
    suppressErrors: false,
  })
  async handleAssetAssigned(event: AssetAssignedEvent) {
    if (!this.mailService.isEnabled()) {
      return;
    }

    try {
      const assignedTo = await this.prisma.user.findUnique({
        where: {
          id: event.assignedToId,
        },
        select: {
          name: true,
          email: true,
          isActive: true,
        },
      });

      if (!assignedTo?.email || !assignedTo.isActive) {
        this.logger.warn(
          `Cannot send asset-assigned email: user ${event.assignedToId} has no active email`,
        );

        return;
      }

      const email = assetAssignedEmailTemplate({
        recipientName: assignedTo.name || 'User',
        assetTag: event.assetTag,
        assetName: event.assetName,
        assignedByName: event.assignedByName,
        assetUrl: this.getFrontendUrl(`/assets/${event.assetId}`),
      });

      await this.mailService.sendEmail({
        to: assignedTo.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (error: unknown) {
      this.logError('asset-assigned', error);
      throw error;
    }
  }

  @OnEvent('asset.returned', {
    suppressErrors: false,
  })
  async handleAssetReturned(event: AssetReturnedEvent) {
    if (!this.mailService.isEnabled()) {
      return;
    }

    try {
      const previousAssignedTo = await this.prisma.user.findUnique({
        where: {
          id: event.previousAssignedToId,
        },
        select: {
          name: true,
          email: true,
          isActive: true,
        },
      });

      if (!previousAssignedTo?.email || !previousAssignedTo.isActive) {
        this.logger.warn(
          `Cannot send asset-returned email: user ${event.previousAssignedToId} has no active email`,
        );

        return;
      }

      const email = assetReturnedEmailTemplate({
        recipientName: previousAssignedTo.name || 'User',
        assetTag: event.assetTag,
        assetName: event.assetName,
        returnedByName: event.returnedByName,
        assetsUrl: this.getFrontendUrl('/assets'),
      });

      await this.mailService.sendEmail({
        to: previousAssignedTo.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (error: unknown) {
      this.logError('asset-returned', error);
      throw error;
    }
  }

  private getFrontendUrl(path: string) {
    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');

    return `${frontendUrl}${path}`;
  }

  private logError(eventName: string, error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown email error';

    const stack = error instanceof Error ? error.stack : undefined;

    this.logger.error(`Failed to send ${eventName} email: ${message}`, stack);
  }
}
