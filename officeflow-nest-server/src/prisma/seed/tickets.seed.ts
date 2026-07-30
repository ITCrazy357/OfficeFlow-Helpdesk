import {
  TicketHistoryAction,
  TicketPriority,
  TicketStatus,
  type Asset,
  type PrismaClient,
  type Ticket,
  type TicketCategory,
  type User,
} from '@prisma/client';
import { ticketSeeds } from './tickets.data';
import { shiftHours } from './seed.utils';

const statusCycle = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
  TicketStatus.OPEN,
  TicketStatus.CANCELLED,
] as const;

const creatorKeys = [
  'employee-binh',
  'employee-lan',
  'employee-hung',
  'employee-thao',
  'employee-nam',
  'employee-mai',
  'employee-phuong',
  'employee-duc',
] as const;

const assigneeKeys = ['it-linh', 'it-minh', 'it-ha', 'it-quang'] as const;

const linkedAssetsByCategory: Record<string, string[]> = {
  Hardware: ['LAP-0001', 'LAP-0003', 'MON-0001', 'LAP-0005', 'DESK-0001'],
  Network: ['NET-0001', 'NET-0002'],
  Printer: ['PRN-0001', 'PRN-0002'],
  Security: ['PHN-0001', 'LAP-0008'],
  Other: ['MON-0003', 'ACC-0002'],
};

function getSlaHours(priority: TicketPriority) {
  switch (priority) {
    case TicketPriority.URGENT:
      return 4;
    case TicketPriority.HIGH:
      return 24;
    case TicketPriority.MEDIUM:
      return 72;
    case TicketPriority.LOW:
      return 168;
  }
}

function getTicketTimeline(
  now: Date,
  priority: TicketPriority,
  status: TicketStatus,
  index: number,
) {
  const slaHours = getSlaHours(priority);
  const isResolved =
    status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED;
  const isCancelled = status === TicketStatus.CANCELLED;

  if (isResolved || isCancelled) {
    const createdAt = shiftHours(now, -(slaHours + 72 + index * 2));
    const dueAt = shiftHours(createdAt, slaHours);
    const resolveAt = isResolved
      ? shiftHours(dueAt, index % 5 === 0 ? 8 : -4)
      : null;

    return {
      createdAt,
      dueAt,
      resolveAt,
      isOverdue: Boolean(resolveAt && resolveAt > dueAt),
    };
  }

  const shouldBeOverdue = index % 3 === 0;
  const createdAt = shouldBeOverdue
    ? shiftHours(now, -(slaHours + 8 + (index % 8)))
    : shiftHours(now, -Math.min(slaHours / 3, 8));
  const dueAt = shiftHours(createdAt, slaHours);

  return {
    createdAt,
    dueAt,
    resolveAt: null,
    isOverdue: shouldBeOverdue,
  };
}

function getLinkedAssetId(
  category: string,
  index: number,
  assets: Record<string, Asset>,
) {
  const candidates = linkedAssetsByCategory[category];

  if (!candidates || index % 2 !== 0) {
    return null;
  }

  const assetTag = candidates[index % candidates.length];
  return assets[assetTag]?.id ?? null;
}

export async function seedTickets(
  prisma: PrismaClient,
  users: Record<string, User>,
  categories: Record<string, TicketCategory>,
  assets: Record<string, Asset>,
  now: Date,
) {
  const tickets: Ticket[] = [];

  for (const [index, seed] of ticketSeeds.entries()) {
    const id = 1001 + index;
    const status = statusCycle[index % statusCycle.length];
    const creator = users[creatorKeys[index % creatorKeys.length]];
    const shouldAssign = status !== TicketStatus.CANCELLED && index % 4 !== 0;
    const assignee = shouldAssign
      ? users[assigneeKeys[index % assigneeKeys.length]]
      : null;
    const timeline = getTicketTimeline(now, seed.priority, status, index);
    const data = {
      title: seed.title,
      description: seed.description,
      status,
      priority: seed.priority,
      dueAt: timeline.dueAt,
      dueDate: timeline.dueAt,
      resolveAt: timeline.resolveAt,
      isOverdue: timeline.isOverdue,
      createdById: creator.id,
      assignedToId: assignee?.id ?? null,
      categoryId: categories[seed.category].id,
      assetId: getLinkedAssetId(seed.category, index, assets),
      createdAt: timeline.createdAt,
    };
    const ticket = await prisma.ticket.upsert({
      where: { id },
      update: data,
      create: {
        id,
        ...data,
      },
    });

    tickets.push(ticket);
  }

  let commentId = 2001;
  let historyId = 3001;
  let attachmentId = 4001;

  for (const [index, ticket] of tickets.entries()) {
    const creator = users[creatorKeys[index % creatorKeys.length]];
    const assignee =
      ticket.assignedToId !== null
        ? users[assigneeKeys[index % assigneeKeys.length]]
        : null;

    await prisma.ticketHistory.upsert({
      where: { id: historyId },
      update: {
        action: TicketHistoryAction.CREATE,
        oldValue: null,
        newValue: ticket.title,
        ticketId: ticket.id,
        userId: creator.id,
        createdAt: ticket.createdAt,
      },
      create: {
        id: historyId,
        action: TicketHistoryAction.CREATE,
        newValue: ticket.title,
        ticketId: ticket.id,
        userId: creator.id,
        createdAt: ticket.createdAt,
      },
    });
    historyId++;

    if (assignee) {
      await prisma.ticketHistory.upsert({
        where: { id: historyId },
        update: {
          action: TicketHistoryAction.ASSIGNED,
          oldValue: null,
          newValue: assignee.name,
          ticketId: ticket.id,
          userId: users.admin.id,
          createdAt: shiftHours(ticket.createdAt, 1),
        },
        create: {
          id: historyId,
          action: TicketHistoryAction.ASSIGNED,
          newValue: assignee.name,
          ticketId: ticket.id,
          userId: users.admin.id,
          createdAt: shiftHours(ticket.createdAt, 1),
        },
      });
      historyId++;
    }

    if (ticket.status !== TicketStatus.OPEN) {
      await prisma.ticketHistory.upsert({
        where: { id: historyId },
        update: {
          action: TicketHistoryAction.STATUS_CHANGED,
          oldValue: TicketStatus.OPEN,
          newValue: ticket.status,
          ticketId: ticket.id,
          userId: assignee?.id ?? users.admin.id,
          createdAt: shiftHours(ticket.createdAt, 3),
        },
        create: {
          id: historyId,
          action: TicketHistoryAction.STATUS_CHANGED,
          oldValue: TicketStatus.OPEN,
          newValue: ticket.status,
          ticketId: ticket.id,
          userId: assignee?.id ?? users.admin.id,
          createdAt: shiftHours(ticket.createdAt, 3),
        },
      });
      historyId++;
    }

    if (index % 3 !== 2) {
      const firstCommentCreatedAt = shiftHours(ticket.createdAt, 0.5);

      await prisma.ticketComment.upsert({
        where: { id: commentId },
        update: {
          content:
            'Nhờ bộ phận IT kiểm tra giúp. Tôi có thể cung cấp thêm ảnh chụp hoặc thử lại theo hướng dẫn.',
          ticketId: ticket.id,
          authorId: creator.id,
          createdAt: firstCommentCreatedAt,
        },
        create: {
          id: commentId,
          content:
            'Nhờ bộ phận IT kiểm tra giúp. Tôi có thể cung cấp thêm ảnh chụp hoặc thử lại theo hướng dẫn.',
          ticketId: ticket.id,
          authorId: creator.id,
          createdAt: firstCommentCreatedAt,
        },
      });
      commentId++;

      await prisma.ticketHistory.upsert({
        where: { id: historyId },
        update: {
          action: TicketHistoryAction.COMMENTED,
          oldValue: null,
          newValue: 'Người tạo đã bổ sung thông tin.',
          ticketId: ticket.id,
          userId: creator.id,
          createdAt: firstCommentCreatedAt,
        },
        create: {
          id: historyId,
          action: TicketHistoryAction.COMMENTED,
          newValue: 'Người tạo đã bổ sung thông tin.',
          ticketId: ticket.id,
          userId: creator.id,
          createdAt: firstCommentCreatedAt,
        },
      });
      historyId++;

      if (assignee && index % 2 === 0) {
        const staffCommentCreatedAt = shiftHours(ticket.createdAt, 2);

        await prisma.ticketComment.upsert({
          where: { id: commentId },
          update: {
            content:
              'IT đã tiếp nhận yêu cầu và đang kiểm tra. Tôi sẽ cập nhật kết quả ngay khi có thông tin.',
            ticketId: ticket.id,
            authorId: assignee.id,
            createdAt: staffCommentCreatedAt,
          },
          create: {
            id: commentId,
            content:
              'IT đã tiếp nhận yêu cầu và đang kiểm tra. Tôi sẽ cập nhật kết quả ngay khi có thông tin.',
            ticketId: ticket.id,
            authorId: assignee.id,
            createdAt: staffCommentCreatedAt,
          },
        });
        commentId++;
      }
    }

    if (index % 4 === 0) {
      const attachmentCreatedAt = shiftHours(ticket.createdAt, 0.75);
      const fileName = `anh-loi-ticket-${ticket.id}.jpg`;

      await prisma.ticketAttachment.upsert({
        where: { id: attachmentId },
        update: {
          fileName,
          fileUrl:
            'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
          fileType: 'image/jpeg',
          fileSize: 245_760,
          publicId: null,
          resourceType: 'image',
          ticketId: ticket.id,
          uploadedById: creator.id,
          createdAt: attachmentCreatedAt,
        },
        create: {
          id: attachmentId,
          fileName,
          fileUrl:
            'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
          fileType: 'image/jpeg',
          fileSize: 245_760,
          resourceType: 'image',
          ticketId: ticket.id,
          uploadedById: creator.id,
          createdAt: attachmentCreatedAt,
        },
      });
      attachmentId++;

      await prisma.ticketHistory.upsert({
        where: { id: historyId },
        update: {
          action: TicketHistoryAction.ATTACHMENT_ADDED,
          oldValue: null,
          newValue: fileName,
          ticketId: ticket.id,
          userId: creator.id,
          createdAt: attachmentCreatedAt,
        },
        create: {
          id: historyId,
          action: TicketHistoryAction.ATTACHMENT_ADDED,
          newValue: fileName,
          ticketId: ticket.id,
          userId: creator.id,
          createdAt: attachmentCreatedAt,
        },
      });
      historyId++;
    }
  }

  return tickets;
}
