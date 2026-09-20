import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { MetricsService } from '../metrics/metrics.service';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('MailService operational metrics', () => {
  const originalEnv = { ...process.env };
  const transport = { sendMail: jest.fn(), verify: jest.fn() };
  const params = {
    to: 'recipient@example.test',
    subject: 'Private subject',
    html: '<p>secret body</p>',
  };
  let metrics: MetricsService;
  let errorLog: jest.SpyInstance;
  beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(process.env, {
      MAIL_ENABLED: 'true',
      MAIL_FROM: 'sender@example.test',
      SMTP_HOST: 'localhost',
      SMTP_USER: 'test',
      SMTP_PASS: 'test',
      SMTP_PORT: '587',
    });
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest
      .mocked(nodemailer.createTransport)
      .mockReturnValue(
        transport as unknown as ReturnType<typeof nodemailer.createTransport>,
      );
    metrics = new MetricsService();
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('does not connect or send when disabled', async () => {
    process.env.MAIL_ENABLED = 'false';
    const service = new MailService(metrics);
    await service.onModuleInit();
    expect(await service.sendEmail(params)).toEqual({ skipped: true });
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(await metrics.render()).toContain('officeflow_mail_enabled 0');
    expect(await metrics.render()).toContain(
      'officeflow_mail_send_attempts_total{result="skipped"} 1',
    );
  });

  it.each([
    [['a'], [], 'accepted'],
    [['a'], ['b'], 'partial'],
    [[], ['b'], 'rejected'],
  ])(
    'records recipient acceptance outcome %# without claiming delivery',
    async (accepted, rejected, result) => {
      transport.sendMail.mockResolvedValue({
        messageId: 'test-id',
        accepted,
        rejected,
      });
      const response = await new MailService(metrics).sendEmail(params);
      expect(response).toEqual({
        skipped: false,
        messageId: 'test-id',
        accepted,
        rejected,
      });
      expect(await metrics.render()).toContain(
        `officeflow_mail_send_attempts_total{result="${result}"} 1`,
      );
    },
  );

  it('preserves the original send error and redacts message, recipient and subject from diagnostics', async () => {
    const error = new Error('password=secret transport details');
    transport.sendMail.mockRejectedValue(error);
    await expect(new MailService(metrics).sendEmail(params)).rejects.toBe(
      error,
    );
    expect(await metrics.render()).toContain(
      'officeflow_mail_send_attempts_total{result="error"} 1',
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toMatch(
      /password=|recipient@example|Private subject/,
    );
  });

  it('separates verification failure from a send attempt', async () => {
    transport.verify.mockRejectedValue(new Error('private password'));
    await new MailService(metrics).onModuleInit();
    const output = await metrics.render();
    expect(output).toContain('officeflow_smtp_verify_total{result="error"} 1');
    expect(output).toContain('officeflow_smtp_verify_success 0');
    expect(output).toContain(
      'officeflow_mail_send_attempts_total{result="error"} 0',
    );
  });

  it('records successful verification', async () => {
    transport.verify.mockResolvedValue(true);
    await new MailService(metrics).onModuleInit();
    expect(await metrics.render()).toContain(
      'officeflow_smtp_verify_success 1',
    );
    expect(await metrics.render()).toContain(
      'officeflow_smtp_verify_total{result="success"} 1',
    );
  });

  it('never replaces a successful result or send error with instrumentation failure', async () => {
    jest.spyOn(metrics, 'recordMailAttempt').mockImplementation(() => {
      throw new Error('metrics failed');
    });
    const service = new MailService(metrics);
    transport.sendMail.mockResolvedValue({
      messageId: 'id',
      accepted: ['a'],
      rejected: [],
    });
    await expect(service.sendEmail(params)).resolves.toMatchObject({
      skipped: false,
    });
    const original = new Error('SMTP failed');
    transport.sendMail.mockRejectedValue(original);
    await expect(service.sendEmail(params)).rejects.toBe(original);
  });
});
