import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { MetricsService } from '../metrics/metrics.service';
import { observeSafely } from '../common/diagnostics/safe-observation';
import { getSafeErrorDetails } from '../common/diagnostics/request-diagnostics';
import { getCurrentRequestId } from '../common/diagnostics/request-context';

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

  constructor(private readonly metrics: MetricsService) {
    observeSafely(() => this.metrics.setMailEnabled(this.enabled));
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
      observeSafely(() => this.metrics.recordSmtpVerify('success'));

      this.logger.log('SMTP connection verified successfully');
    } catch (error: unknown) {
      observeSafely(() => {
        this.metrics.recordSmtpVerify('error');
        this.metrics.recordError('smtp');
      });
      this.logger.error({
        event: 'smtp_verify_failed',
        ...getSafeErrorDetails(error),
      });
    }
  }

  isEnabled() {
    return this.enabled && this.transporter !== null;
  }

  async sendEmail(params: SendEmailParams) {
    if (!this.isEnabled() || !this.transporter) {
      this.logger.debug({ event: 'mail_skipped_disabled' });
      observeSafely(() => this.metrics.recordMailAttempt('skipped'));

      return {
        skipped: true,
      };
    }

    let info: SMTPTransport.SentMessageInfo;

    try {
      info = await this.transporter.sendMail({
        from: this.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
    } catch (error: unknown) {
      observeSafely(() => {
        this.metrics.recordMailAttempt('error');
        this.metrics.recordError('smtp');
      });
      this.logger.error({
        event: 'mail_send_failed',
        requestId: getCurrentRequestId(),
        ...getSafeErrorDetails(error),
      });
      throw error;
    }

    const result =
      info.accepted.length === 0
        ? 'rejected'
        : info.rejected.length > 0
          ? 'partial'
          : 'accepted';

    observeSafely(() => this.metrics.recordMailAttempt(result));

    return {
      skipped: false,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  }
}
