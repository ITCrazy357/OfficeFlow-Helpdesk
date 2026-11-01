import { TicketAssignedEvent } from '../../notifications/events/ticket-assigned.event';
import { TicketCreatedEvent } from '../../notifications/events/ticket-created.event';
import { TicketOverdueEvent } from '../../notifications/events/ticket-overdue.event';
import { TicketResolvedEvent } from '../../notifications/events/ticket-resolved.event';
import type { PrismaService } from '../../prisma/prisma.service';
import type { MailService } from '../mail.service';
import { TicketEmailListener } from './ticket-email.listener';
import type { TicketAccessPolicyService } from '../../tickets/ticket-access-policy.service';
import { EmailDeliveryService } from '../email-delivery.service';

const mockTicketAccess = { getRecipients: jest.fn() };

const mockTicketModel = {
  findUnique: jest.fn(),
};

const mockUserModel = {
  findUnique: jest.fn(),
  findMany: jest.fn<Promise<unknown[]>, [unknown]>(),
};

const mockPrisma = {
  ticket: mockTicketModel,
  user: mockUserModel,
};

const mockMailService = {
  isEnabled: jest.fn(),
  sendEmail: jest.fn(),
};

describe('TicketEmailListener', () => {
  let listener: TicketEmailListener;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTicketAccess.getRecipients.mockResolvedValue([]);
    mockMailService.isEnabled.mockReturnValue(true);
    mockMailService.sendEmail.mockResolvedValue({
      skipped: false,
      messageId: 'message-id',
      accepted: [],
      rejected: [],
    });
    listener = new TicketEmailListener(
      mockPrisma as unknown as PrismaService,
      mockMailService as unknown as MailService,
      mockTicketAccess as unknown as TicketAccessPolicyService,
      new EmailDeliveryService(mockPrisma as unknown as PrismaService),
    );
  });

  it('should skip database work when email is disabled', async () => {
    mockMailService.isEnabled.mockReturnValue(false);

    await listener.handleTicketCreated(new TicketCreatedEvent(15));

    expect(mockTicketModel.findUnique).not.toHaveBeenCalled();
    expect(mockMailService.sendEmail).not.toHaveBeenCalled();
  });

  it('should send ticket-created email to the active requester', async () => {
    mockTicketModel.findUnique.mockResolvedValue({
      id: 15,
      title: 'Cannot connect to VPN',
      createdBy: {
        name: 'Employee',
        email: 'employee@example.com',
        isActive: true,
      },
    });

    await listener.handleTicketCreated(new TicketCreatedEvent(15));

    expect(mockMailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'employee@example.com',
        subject: '[OfficeFlow] Ticket #15 has been created',
      }),
    );
  });

  it('should send ticket-assigned email to the new assignee', async () => {
    mockTicketAccess.getRecipients.mockResolvedValue([
      {
        id: 20,
        name: 'IT Staff',
        email: 'it@example.com',
      },
    ]);

    await listener.handleTicketAssigned(
      new TicketAssignedEvent(15, 'Cannot connect to VPN', 20, 'Admin'),
    );

    expect(mockMailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'it@example.com',
        subject: '[OfficeFlow] Ticket #15 has been assigned to you',
      }),
    );
  });

  it('should send resolved email only to the requester', async () => {
    mockTicketModel.findUnique.mockResolvedValue({
      id: 15,
      title: 'Cannot connect to VPN',
      createdBy: {
        name: 'Employee',
        email: 'employee@example.com',
        isActive: true,
      },
    });

    await listener.handleTicketResolved(
      new TicketResolvedEvent(
        15,
        'Cannot connect to VPN',
        20,
        'IT Staff',
        [10, 20],
      ),
    );

    expect(mockMailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(mockMailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'employee@example.com',
        subject: '[OfficeFlow] Ticket #15 has been resolved',
      }),
    );
  });

  it('continues SLA delivery to other recipients and reports a failed email for retry', async () => {
    const recipients = [
      { id: 10, name: 'Admin', email: 'admin@test.invalid' },
      { id: 20, name: 'Manager', email: 'manager@test.invalid' },
    ];
    mockTicketAccess.getRecipients.mockImplementation(
      (_ticketId: number, ids: number[]) =>
        Promise.resolve(recipients.filter((user) => ids.includes(user.id))),
    );
    mockMailService.sendEmail.mockRejectedValueOnce(new Error('smtp failed'));
    await expect(
      listener.handleTicketSlaAlert({
        ticketId: 15,
        ticketTitle: '<script>unsafe</script>',
        dueAt: '2026-10-19T08:00:00Z',
        milestone: 'RESPONSE',
        kind: 'ESCALATED',
        recipientIds: [10, 10, 20],
      }),
    ).rejects.toThrow('10');
    expect(mockMailService.sendEmail).toHaveBeenCalledTimes(2);
    expect(mockTicketAccess.getRecipients.mock.calls).toEqual([
      [15, [10]],
      [15, [20]],
    ]);
    const calls = mockMailService.sendEmail.mock.calls as Array<
      [{ html: string; text: string }]
    >;
    expect(calls[0][0].html).not.toContain('<script>');
    expect(calls[0][0].text).toContain('15:00');
  });

  it('should de-duplicate overdue recipients before sending email', async () => {
    const recipients = [
      {
        id: 10,
        name: 'Employee',
        email: 'employee@example.com',
      },
      {
        id: 20,
        name: 'IT Staff',
        email: 'it@example.com',
      },
    ];
    mockTicketAccess.getRecipients.mockImplementation(
      (_ticketId: number, ids: number[]) =>
        Promise.resolve(recipients.filter((user) => ids.includes(user.id))),
    );

    await listener.handleTicketOverdue(
      new TicketOverdueEvent(15, 'Cannot connect to VPN', [10, 10, 20]),
    );

    expect(mockTicketAccess.getRecipients.mock.calls).toEqual([
      [15, [10]],
      [15, [20]],
    ]);
    expect(mockMailService.sendEmail).toHaveBeenCalledTimes(2);
  });

  it('rechecks each recipient after a preceding SMTP call completes', async () => {
    let revoked = false;
    mockTicketAccess.getRecipients.mockImplementation(
      (_ticketId: number, ids: number[]) =>
        Promise.resolve(
          ids[0] === 10
            ? [{ id: 10, name: 'Admin', email: 'admin@test.invalid' }]
            : revoked
              ? []
              : [
                  {
                    id: 20,
                    name: 'Former admin',
                    email: 'former@test.invalid',
                  },
                ],
        ),
    );
    mockMailService.sendEmail.mockImplementation(() => {
      revoked = true;
      return Promise.resolve({});
    });
    await listener.handleTicketSlaAlert({
      ticketId: 15,
      ticketTitle: 'Private fixture',
      dueAt: '2026-10-19T08:00:00Z',
      milestone: 'RESPONSE',
      kind: 'ESCALATED',
      recipientIds: [10, 20],
    });
    expect(mockMailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(mockMailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin@test.invalid' }),
    );
  });
});
