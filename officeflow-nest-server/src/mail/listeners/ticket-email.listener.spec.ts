import { TicketAssignedEvent } from '../../notifications/events/ticket-assigned.event';
import { TicketCreatedEvent } from '../../notifications/events/ticket-created.event';
import { TicketOverdueEvent } from '../../notifications/events/ticket-overdue.event';
import { TicketResolvedEvent } from '../../notifications/events/ticket-resolved.event';
import type { PrismaService } from '../../prisma/prisma.service';
import type { MailService } from '../mail.service';
import { TicketEmailListener } from './ticket-email.listener';

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
    mockUserModel.findUnique.mockResolvedValue({
      name: 'IT Staff',
      email: 'it@example.com',
      isActive: true,
    });

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

  it('should de-duplicate overdue recipients before sending email', async () => {
    mockUserModel.findMany.mockResolvedValue([
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
    ]);

    await listener.handleTicketOverdue(
      new TicketOverdueEvent(15, 'Cannot connect to VPN', [10, 10, 20]),
    );

    const findManyArgs = mockUserModel.findMany.mock.calls[0]?.[0] as {
      where: {
        id: {
          in: number[];
        };
      };
    };

    expect(findManyArgs.where.id.in).toEqual([10, 20]);
    expect(mockMailService.sendEmail).toHaveBeenCalledTimes(2);
  });
});
