import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export type SendEmailParams = {
  to: string;
  subject: string;
  text?: string;
  html: string;
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);

  private readonly enabled = process.env.MAIL_ENABLED === 'true';

  private readonly from = process.env.MAIL_FROM || '';

  private readonly transporter: Transporter<
    SMTPTransport.SentMessageInfo,
    SMTPTransport.Options
  > | null;

  constructor() {
    if (!this.enabled) {
      this.transporter = null;

      this.logger.warn(
        'Email notification is disabled because MAIL_ENABLED is not true',
      );

      return;
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass || !this.from) {
      throw new Error('Missing SMTP_HOST, SMTP_USER, SMTP_PASS or MAIL_FROM');
    }

    if (Number.isNaN(port)) {
      throw new Error('SMTP_PORT must be a valid number');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  async onModuleInit() {
    if (!this.isEnabled() || !this.transporter) {
      return;
    }

    try {
      await this.transporter.verify();

      this.logger.log('SMTP connection verified successfully');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown SMTP error';

      this.logger.error(`SMTP connection verification failed: ${message}`);
    }
  }

  isEnabled() {
    return this.enabled && this.transporter !== null;
  }

  async sendEmail(params: SendEmailParams) {
    if (!this.isEnabled() || !this.transporter) {
      this.logger.debug(
        `Skipped email "${params.subject}" because email is disabled`,
      );

      return {
        skipped: true,
      };
    }

    const info = await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    this.logger.log(`Email sent successfully: messageId=${info.messageId}`);

    return {
      skipped: false,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  }
}
