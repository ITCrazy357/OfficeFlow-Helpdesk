import { LeaveStatus, NotificationType } from '@prisma/client';

import { LeaveApprovedEvent } from '../../leave-requests/events/leave-approved.event';
import { LeaveCancelledEvent } from '../../leave-requests/events/leave-cancelled.event';
import { LeaveRequestedEvent } from '../../leave-requests/events/leave-requested.event';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../notifications.service';
import { LeaveNotificationsListener } from './leave-notifications.listener';

const mockLeaveRequestModel = {
  findUnique: jest.fn(),
};

const mockPrisma = {
  leaveRequest: mockLeaveRequestModel,
};

const mockNotificationsService = {
  create: jest.fn(),
};

describe('LeaveNotificationsListener', () => {
  let listener: LeaveNotificationsListener;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationsService.create.mockResolvedValue({ id: 1 });
    listener = new LeaveNotificationsListener(
      mockPrisma as unknown as PrismaService,
      mockNotificationsService as unknown as NotificationsService,
    );
  });

  it('notifies only the assigned approver when leave is requested', async () => {
    mockLeaveRequestModel.findUnique.mockResolvedValue({
      id: 15,
      approverId: 20,
      status: LeaveStatus.PENDING,
      startDate: new Date('2026-09-10T00:00:00.000Z'),
      endDate: new Date('2026-09-12T00:00:00.000Z'),
      requester: { name: 'Employee' },
    });

    await listener.handleRequested(new LeaveRequestedEvent(15));

    expect(mockNotificationsService.create).toHaveBeenCalledWith({
      userId: 20,
      type: NotificationType.LEAVE_REQUESTED,
      title: 'Leave request awaiting review',
      message: 'Employee requested leave from 2026-09-10 to 2026-09-12.',
      targetUrl: '/leave-requests/15',
    });
  });

  it('notifies only the requester after approval', async () => {
    mockLeaveRequestModel.findUnique.mockResolvedValue({
      id: 15,
      requesterId: 10,
      status: LeaveStatus.APPROVED,
    });

    await listener.handleApproved(new LeaveApprovedEvent(15));

    expect(mockNotificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 10,
        type: NotificationType.LEAVE_APPROVED,
      }),
    );
  });

  it('does not create a stale requested notification after status changes', async () => {
    mockLeaveRequestModel.findUnique.mockResolvedValue({
      id: 15,
      approverId: 20,
      status: LeaveStatus.CANCELLED,
      startDate: new Date('2026-09-10T00:00:00.000Z'),
      endDate: new Date('2026-09-12T00:00:00.000Z'),
      requester: { name: 'Employee' },
    });

    await listener.handleRequested(new LeaveRequestedEvent(15));

    expect(mockNotificationsService.create).not.toHaveBeenCalled();
  });

  it('notifies the assigned approver when a pending request is cancelled', async () => {
    mockLeaveRequestModel.findUnique.mockResolvedValue({
      id: 15,
      approverId: 20,
      status: LeaveStatus.CANCELLED,
      requester: { name: 'Employee' },
    });

    await listener.handleCancelled(new LeaveCancelledEvent(15));

    expect(mockNotificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 20,
        type: NotificationType.LEAVE_CANCELLED,
      }),
    );
  });
});
