import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { PasswordRecoveryCompletedEvent } from '../../notifications/events/password-recovery-completed.event';
import { PasswordResetRequestedEvent } from '../../notifications/events/password-reset-requested.event';
import { UserCreatedEvent } from '../../notifications/events/user-created.event';
import { UserPasswordResetEvent } from '../../notifications/events/user-password-reset.event';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail.service';
import { passwordRecoveryCompletedEmailTemplate } from '../templates/password-recovery-completed-email.template';
import { passwordResetLinkEmailTemplate } from '../templates/password-reset-link-email.template';
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
    suppressErrors: false,
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
      throw error;
    }
  }

  @OnEvent('user.password-reset', {
    suppressErrors: false,
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
      throw error;
    }
  }

  @OnEvent('password-reset.requested', {
    async: true,
    suppressErrors: true,
  })
  async handlePasswordResetRequested(event: PasswordResetRequestedEvent) {
    if (!this.mailService.isEnabled()) {
      return;
    }

    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: event.userId,
          isActive: true,
          isLocked: false,
        },
        select: {
          name: true,
          email: true,
        },
      });

      if (!user?.email) {
        this.logger.warn(
          `Cannot send password-reset link: user ${event.userId} is not eligible`,
        );

        return;
      }

      const email = passwordResetLinkEmailTemplate({
        userName: user.name || 'User',
        resetUrl: this.getPasswordResetUrl(event.rawToken),
        expiresInMinutes: Math.max(
          1,
          Math.ceil((event.expiresAt.getTime() - Date.now()) / 60_000),
        ),
      });

      await this.mailService.sendEmail({
        to: user.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (error: unknown) {
      this.logError('password-reset-requested', error);
    }
  }

  @OnEvent('password-recovery.completed', {
    suppressErrors: false,
  })
  async handlePasswordRecoveryCompleted(event: PasswordRecoveryCompletedEvent) {
    if (!this.mailService.isEnabled()) {
      return;
    }

    try {
      const user = await this.findActiveUser(event.userId);

      if (!user?.email) {
        this.logger.warn(
          `Cannot send password-recovery confirmation: user ${event.userId} has no active email`,
        );

        return;
      }

      const email = passwordRecoveryCompletedEmailTemplate({
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
      this.logError('password-recovery-completed', error);
      throw error;
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
    return `${this.getFrontendUrl()}/login`;
  }

  private getPasswordResetUrl(rawToken: string) {
    return `${this.getFrontendUrl()}/reset-password#token=${encodeURIComponent(rawToken)}`;
  }

  private getFrontendUrl() {
    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const protocol = new URL(frontendUrl).protocol;

    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new Error('FRONTEND_URL must use HTTP or HTTPS');
    }

    if (process.env.NODE_ENV === 'production' && protocol !== 'https:') {
      throw new Error('FRONTEND_URL must use HTTPS in production');
    }

    return frontendUrl;
  }

  private logError(eventName: string, error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown email error';

    const stack = error instanceof Error ? error.stack : undefined;

    this.logger.error(`Failed to send ${eventName} email: ${message}`, stack);
  }
}
