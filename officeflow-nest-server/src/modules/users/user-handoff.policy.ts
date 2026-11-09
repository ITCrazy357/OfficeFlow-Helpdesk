import { ConflictException } from '@nestjs/common';
import { LeaveStatus, Prisma, TicketStatus, UserRole } from '@prisma/client';

export async function assertRoleHandoff(
  transaction: Prisma.TransactionClient,
  userId: number,
  nextRole: UserRole,
): Promise<void> {
  if (nextRole !== UserRole.ADMIN && nextRole !== UserRole.IT_STAFF) {
    const tickets = await transaction.ticket.count({
      where: {
        assignedToId: userId,
        status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
      },
    });
    if (tickets)
      throw new ConflictException(
        'Reassign active tickets before changing this role',
      );
  }
  if (nextRole !== UserRole.ADMIN && nextRole !== UserRole.MANAGER) {
    const approvals = await transaction.leaveRequest.count({
      where: { approverId: userId, status: LeaveStatus.PENDING },
    });
    const reports = await transaction.user.count({
      where: { managerId: userId, isActive: true },
    });
    if (approvals || reports)
      throw new ConflictException(
        'Handoff pending approvals and active subordinates before changing this role',
      );
  }
}

export async function assertNoPendingHandoff(
  transaction: Prisma.TransactionClient,
  userId: number,
): Promise<void> {
  const tickets = await transaction.ticket.count({
    where: {
      assignedToId: userId,
      status: {
        in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
      },
    },
  });

  const assets = await transaction.asset.count({
    where: { assignedToId: userId },
  });

  const pendingApprovals = await transaction.leaveRequest.count({
    where: {
      approverId: userId,
      status: LeaveStatus.PENDING,
    },
  });

  // Quy tắc bổ sung khuyến nghị: chuyển quản lý cho nhân viên trước.
  const activeSubordinates = await transaction.user.count({
    where: {
      managerId: userId,
      isActive: true,
    },
  });

  if (tickets || assets || pendingApprovals || activeSubordinates) {
    throw new ConflictException(
      `Cannot deactivate user: ${tickets} active tickets, ` +
        `${assets} assigned assets, ${pendingApprovals} pending approvals, ` +
        `${activeSubordinates} active subordinates require handoff.`,
    );
  }
}
