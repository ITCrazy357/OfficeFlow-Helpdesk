import type { Prisma } from '@prisma/client';

export const ticketStatusSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueAt: true,
  resolveAt: true,
  resolutionVersion: true,
  confirmedAt: true,
  isOverdue: true,
  firstResponseDueAt: true,
  firstRespondedAt: true,
  firstResponseOverdue: true,
  resolutionWarningAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      departmentId: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.TicketSelect;
