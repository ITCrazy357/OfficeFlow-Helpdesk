import { PasswordResetRequestedEvent } from '../../notifications/events/password-reset-requested.event';
import { PasswordRecoveryCompletedEvent } from '../../notifications/events/password-recovery-completed.event';
import type { PrismaService } from '../../prisma/prisma.service';
import type { MailService } from '../mail.service';
import { UserEmailListener } from './user-email.listener';

const mockUserModel = {
  findFirst: jest.fn(),
};

const mockPrisma = {
  user: mockUserModel,
};

type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const mockMailService = {
  isEnabled: jest.fn(),
  sendEmail: jest.fn<Promise<unknown>, [SendEmailParams]>(),
};

describe('UserEmailListener password recovery', () => {
  let listener: UserEmailListener;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = 'https://officeflow.example/';
    mockMailService.isEnabled.mockReturnValue(true);
    mockMailService.sendEmail.mockResolvedValue({ skipped: false });
    listener = new UserEmailListener(
      mockPrisma as unknown as PrismaService,
      mockMailService as unknown as MailService,
    );
  });

  afterAll(() => {
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it('sends a one-time reset link without a temporary password', async () => {
    const token = 'a'.repeat(43);
    mockUserModel.findFirst.mockResolvedValue({
      name: 'Employee',
      email: 'employee@example.com',
    });

    await listener.handlePasswordResetRequested(
      new PasswordResetRequestedEvent(
        7,
        token,
        new Date(Date.now() + 15 * 60_000),
      ),
    );

    expect(mockUserModel.findFirst).toHaveBeenCalledWith({
      where: {
        id: 7,
        isActive: true,
        isLocked: false,
      },
      select: {
        name: true,
        email: true,
      },
    });
    expect(mockMailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'employee@example.com',
        subject: '[OfficeFlow] Reset your password',
      }),
    );
    const email = mockMailService.sendEmail.mock.calls[0][0];
    expect(email.text).toContain(
      `https://officeflow.example/reset-password#token=${token}`,
    );
    expect(email.html).toContain(
      `https://officeflow.example/reset-password#token=${token}`,
    );
    expect(email.text.toLowerCase()).not.toContain('temporary password');
  });

  it('does not query or send when mail is disabled', async () => {
    mockMailService.isEnabled.mockReturnValue(false);

    await listener.handlePasswordResetRequested(
      new PasswordResetRequestedEvent(7, 'a'.repeat(43), new Date()),
    );

    expect(mockUserModel.findFirst).not.toHaveBeenCalled();
    expect(mockMailService.sendEmail).not.toHaveBeenCalled();
  });

  it('does not email an account that is no longer eligible', async () => {
    mockUserModel.findFirst.mockResolvedValue(null);

    await listener.handlePasswordResetRequested(
      new PasswordResetRequestedEvent(7, 'a'.repeat(43), new Date()),
    );

    expect(mockMailService.sendEmail).not.toHaveBeenCalled();
  });

  it('sends a security notice after password recovery completes', async () => {
    mockUserModel.findFirst.mockResolvedValue({
      name: 'Employee',
      email: 'employee@example.com',
    });

    await listener.handlePasswordRecoveryCompleted(
      new PasswordRecoveryCompletedEvent(7),
    );

    expect(mockMailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'employee@example.com',
        subject: '[OfficeFlow] Your password was changed',
      }),
    );
    const email = mockMailService.sendEmail.mock.calls[0][0];
    expect(email.text).toContain('All existing sessions have been signed out');
    expect(email.text.toLowerCase()).not.toContain('temporary password');
    expect(email.text).not.toContain('a'.repeat(43));
  });
});
