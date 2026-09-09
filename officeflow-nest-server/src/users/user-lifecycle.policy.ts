import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, UserRole } from '@prisma/client';

export async function assertTicketAssignee(
  transaction: Prisma.TransactionClient,
  id: number,
) {
  const user = await transaction.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true, isLocked: true },
  });
  if (!user) throw new NotFoundException('Assignee not found');
  if (!user.isActive)
    throw new BadRequestException('Cannot assign ticket to an inactive user');
  if (user.isLocked)
    throw new BadRequestException('Cannot assign ticket to a locked user');
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.IT_STAFF) {
    throw new BadRequestException('Assignee must be IT staff or admin');
  }
}

export async function assertActiveAdmin(
  transaction: Prisma.TransactionClient,
  actorId: number,
): Promise<void> {
  const actor = await transaction.user.findUnique({
    where: { id: actorId },
    select: {
      role: true,
      isActive: true,
      isLocked: true,
    },
  });

  if (
    !actor ||
    actor.role !== UserRole.ADMIN ||
    !actor.isActive ||
    actor.isLocked
  ) {
    throw new ForbiddenException('An active administrator is required');
  }
}

export async function assertAnotherUsableAdmin(
  transaction: Prisma.TransactionClient,
  targetId: number,
): Promise<void> {
  const remainingAdmins = await transaction.user.count({
    where: {
      id: { not: targetId },
      role: UserRole.ADMIN,
      isActive: true,
      isLocked: false,
    },
  });

  if (remainingAdmins === 0) {
    throw new ConflictException('Cannot remove the last usable administrator');
  }
}
