import { LeaveStatus } from '@prisma/client';

import { LeaveApprovedEvent } from '../../leave-requests/events/leave-approved.event';
import { LeaveCancelledEvent } from '../../leave-requests/events/leave-cancelled.event';
import { LeaveRejectedEvent } from '../../leave-requests/events/leave-rejected.event';
import { LeaveRequestedEvent } from '../../leave-requests/events/leave-requested.event';
import type { PrismaService } from '../../prisma/prisma.service';
import type { MailService } from '../mail.service';
import { LeaveEmailListener } from './leave-email.listener';

const mockLeaveRequestModel = {
  findUnique: jest.fn(),
};

const mockPrisma = {
  leaveRequest: mockLeaveRequestModel,
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

describe('LeaveEmailListener', () => {
  let listener: LeaveEmailListener;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMailService.isEnabled.mockReturnValue(true);
    mockMailService.sendEmail.mockResolvedValue({
      skipped: false,
      messageId: 'message-id',
      accepted: [],
      rejected: [],
    });
    listener = new LeaveEmailListener(
      mockPrisma as unknown as PrismaService,
      mockMailService as unknown as MailService,
    );
  });

  it('skips database work when email is disabled', async () => {
    mockMailService.isEnabled.mockReturnValue(false);

    await listener.handleRequested(new LeaveRequestedEvent(15));

    expect(mockLeaveRequestModel.findUnique).not.toHaveBeenCalled();
    expect(mockMailService.sendEmail).not.toHaveBeenCalled();
  });

  it('emails only the assigned approver for a pending request', async () => {
    mockLeaveRequestModel.findUnique.mockResolvedValue({
      id: 15,
      status: LeaveStatus.PENDING,
      startDate: new Date('2026-09-10T00:00:00.000Z'),
      endDate: new Date('2026-09-12T00:00:00.000Z'),
      requester: { name: 'Employee' },
      approver: {
        name: 'Manager',
        email: 'manager@example.com',
        isActive: true,
      },
    });

    await listener.handleRequested(new LeaveRequestedEvent(15));

    expect(mockMailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'manager@example.com',
        subject: '[OfficeFlow] Leave request #15 requires review',
      }),
    );
    const email = mockMailService.sendEmail.mock.calls[0]?.[0];
    expect(email?.text).not.toContain('Private reason');
  });

  it('emails only the requester after approval', async () => {
    mockLeaveRequestModel.findUnique.mockResolvedValue({
      id: 15,
      status: LeaveStatus.APPROVED,
      startDate: new Date('2026-09-10T00:00:00.000Z'),
      endDate: new Date('2026-09-12T00:00:00.000Z'),
      requester: {
        name: 'Employee',
        email: 'employee@example.com',
        isActive: true,
      },
    });

    await listener.handleApproved(new LeaveApprovedEvent(15));

    expect(mockMailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'employee@example.com',
        subject: '[OfficeFlow] Leave request #15 was approved',
      }),
    );
  });

  it('does not send a stale requested email after status changes', async () => {
    mockLeaveRequestModel.findUnique.mockResolvedValue({
      id: 15,
      status: LeaveStatus.REJECTED,
      startDate: new Date('2026-09-10T00:00:00.000Z'),
      endDate: new Date('2026-09-12T00:00:00.000Z'),
      requester: { name: 'Employee' },
      approver: {
        name: 'Manager',
        email: 'manager@example.com',
        isActive: true,
      },
    });

    await listener.handleRequested(new LeaveRequestedEvent(15));

    expect(mockMailService.sendEmail).not.toHaveBeenCalled();
  });

  it('emails the requester after rejection', async () => {
    mockLeaveRequestModel.findUnique.mockResolvedValue({
      id: 15,
      status: LeaveStatus.REJECTED,
      startDate: new Date('2026-09-10T00:00:00.000Z'),
      endDate: new Date('2026-09-12T00:00:00.000Z'),
      requester: {
        name: 'Employee',
        email: 'employee@example.com',
        isActive: true,
      },
    });

    await listener.handleRejected(new LeaveRejectedEvent(15));

    expect(mockMailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'employee@example.com',
        subject: '[OfficeFlow] Leave request #15 was rejected',
      }),
    );
  });

  it('emails the assigned approver after cancellation', async () => {
    mockLeaveRequestModel.findUnique.mockResolvedValue({
      id: 15,
      status: LeaveStatus.CANCELLED,
      startDate: new Date('2026-09-10T00:00:00.000Z'),
      endDate: new Date('2026-09-12T00:00:00.000Z'),
      requester: { name: 'Employee' },
      approver: {
        name: 'Manager',
        email: 'manager@example.com',
        isActive: true,
      },
    });

    await listener.handleCancelled(new LeaveCancelledEvent(15));

    expect(mockMailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'manager@example.com',
        subject: '[OfficeFlow] Leave request #15 was cancelled',
      }),
    );
  });
});
