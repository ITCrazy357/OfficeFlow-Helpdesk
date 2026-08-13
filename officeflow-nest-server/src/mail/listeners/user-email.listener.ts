import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { UserCreatedEvent } from '../../notifications/events/user-created.event';
import { UserPasswordResetEvent } from '../../notifications/events/user-password-reset.event';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail.service';
import { userCreatedEmailTemplate } from '../templates/user-created-email.template';
import { userPasswordResetEmailTemplate } from '../templates/user-password-reset-email.template';

@Injectable()
export class UserEmailListener {
  private readonly logger = new Logger(UserEmailListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  @OnEvent('user.created', {
    async: true,
    suppressErrors: true,
  })
  async handleUserCreated(event: UserCreatedEvent) {
    if (!this.mailService.isEnabled()) {
      return;
    }

    try {
      const user = await this.findActiveUser(event.userId);

      if (!user?.email) {
        this.logger.warn(
          `Cannot send user-created email: user ${event.userId} has no active email`,
        );

        return;
      }

      const email = userCreatedEmailTemplate({
        userName: user.name || 'User',
        loginUrl: this.getLoginUrl(),
      });

      await this.mailService.sendEmail({
        to: user.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (error: unknown) {
      this.logError('user-created', error);
    }
  }

  @OnEvent('user.password-reset', {
    async: true,
    suppressErrors: true,
  })
  async handleUserPasswordReset(event: UserPasswordResetEvent) {
    if (!this.mailService.isEnabled()) {
      return;
    }

    try {
      const user = await this.findActiveUser(event.userId);

      if (!user?.email) {
        this.logger.warn(
          `Cannot send password-reset email: user ${event.userId} has no active email`,
        );

        return;
      }

      const email = userPasswordResetEmailTemplate({
        userName: user.name || 'User',
        loginUrl: this.getLoginUrl(),
      });

      await this.mailService.sendEmail({
        to: user.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (error: unknown) {
      this.logError('user-password-reset', error);
    }
  }

  private findActiveUser(userId: number) {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
      },
      select: {
        name: true,
        email: true,
      },
    });
  }

  private getLoginUrl() {
    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');

    return `${frontendUrl}/login`;
  }

  private logError(eventName: string, error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown email error';

    const stack = error instanceof Error ? error.stack : undefined;

    this.logger.error(`Failed to send ${eventName} email: ${message}`, stack);
  }
}
