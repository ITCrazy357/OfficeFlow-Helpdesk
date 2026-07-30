import {
  NotificationType,
  TicketStatus,
  type Asset,
  type KnowledgeArticle,
  type PrismaClient,
  type Ticket,
  type User,
} from '@prisma/client';
import { shiftHours } from './seed.utils';

type NotificationSeed = {
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  targetUrl: string;
  userId: number;
  createdAt: Date;
};

export async function seedNotifications(
  prisma: PrismaClient,
  users: Record<string, User>,
  assets: Record<string, Asset>,
  tickets: Ticket[],
  articles: Record<string, KnowledgeArticle>,
  now: Date,
) {
  const seeds: NotificationSeed[] = [];
  const usersById = new Map(
    Object.values(users).map((user) => [user.id, user]),
  );

  for (const ticket of tickets
    .filter((item) => item.assignedToId)
    .slice(0, 12)) {
    const assignee = usersById.get(ticket.assignedToId!);

    if (assignee) {
      seeds.push({
        type: NotificationType.TICKET_ASSIGNED,
        title: 'Ticket mới được giao',
        message: `Bạn được chỉ định xử lý ticket “${ticket.title}”.`,
        isRead: ticket.status !== TicketStatus.OPEN,
        targetUrl: `/tickets/${ticket.id}`,
        userId: assignee.id,
        createdAt: shiftHours(ticket.createdAt, 1),
      });
    }
  }

  for (const ticket of tickets.slice(0, 8)) {
    seeds.push({
      type: NotificationType.TICKET_COMMENTED,
      title: 'Ticket có bình luận mới',
      message: `Ticket “${ticket.title}” vừa có thêm nội dung trao đổi.`,
      isRead: ticket.status === TicketStatus.CLOSED,
      targetUrl: `/tickets/${ticket.id}`,
      userId: ticket.createdById,
      createdAt: shiftHours(ticket.createdAt, 2),
    });
  }

  for (const ticket of tickets.filter((item) => item.isOverdue).slice(0, 7)) {
    seeds.push({
      type: NotificationType.TICKET_OVERDUE,
      title: 'Ticket đã quá hạn SLA',
      message: `Ticket “${ticket.title}” đã vượt quá hạn xử lý.`,
      isRead: false,
      targetUrl: `/tickets/${ticket.id}`,
      userId: ticket.assignedToId ?? ticket.createdById,
      createdAt: ticket.dueAt ?? now,
    });
  }

  for (const ticket of tickets
    .filter((item) => item.status !== TicketStatus.OPEN)
    .slice(0, 8)) {
    seeds.push({
      type: NotificationType.TICKET_STATUS_CHANGED,
      title: 'Trạng thái ticket đã thay đổi',
      message: `Ticket “${ticket.title}” hiện ở trạng thái ${ticket.status}.`,
      isRead: ticket.status === TicketStatus.CLOSED,
      targetUrl: `/tickets/${ticket.id}`,
      userId: ticket.createdById,
      createdAt: shiftHours(ticket.createdAt, 3),
    });
  }

  const publishedArticles = Object.values(articles)
    .filter((article) => article.isPublished)
    .slice(0, 6);
  const employeeKeys = [
    'employee-binh',
    'employee-lan',
    'employee-hung',
    'employee-thao',
    'employee-nam',
    'employee-mai',
  ] as const;

  for (const [index, article] of publishedArticles.entries()) {
    seeds.push({
      type: NotificationType.KNOWLEDGE_PUBLISHED,
      title: 'Bài hướng dẫn mới',
      message: `Bài “${article.title}” đã được xuất bản trên Knowledge Base.`,
      isRead: index < 2,
      targetUrl: `/knowledge?articleId=${article.id}`,
      userId: users[employeeKeys[index]].id,
      createdAt: shiftHours(now, -(24 + index * 8)),
    });
  }

  for (const asset of Object.values(assets)
    .filter((item) => item.assignedToId)
    .slice(0, 8)) {
    seeds.push({
      type: NotificationType.ASSET_ASSIGNED,
      title: 'Tài sản đã được cấp phát',
      message: `${asset.assetTag} · ${asset.name} đã được cấp cho bạn.`,
      isRead: false,
      targetUrl: `/assets/${asset.id}`,
      userId: asset.assignedToId!,
      createdAt: shiftHours(now, -(72 + (asset.id % 24))),
    });
  }

  const returnedAssetSeeds = [
    {
      assetTag: 'LAP-0002',
      user: 'employee-lan',
    },
    {
      assetTag: 'MON-0002',
      user: 'employee-thao',
    },
    {
      assetTag: 'PHN-0002',
      user: 'manager-operations',
    },
  ] as const;

  for (const [index, returned] of returnedAssetSeeds.entries()) {
    const asset = assets[returned.assetTag];

    seeds.push({
      type: NotificationType.ASSET_RETURNED,
      title: 'Tài sản đã được thu hồi',
      message: `${asset.assetTag} · ${asset.name} đã được xác nhận thu hồi.`,
      isRead: true,
      targetUrl: `/assets/${asset.id}`,
      userId: users[returned.user].id,
      createdAt: shiftHours(now, -(96 + index * 12)),
    });
  }

  for (const [index, seed] of seeds.entries()) {
    await prisma.notification.upsert({
      where: { id: 5001 + index },
      update: seed,
      create: {
        id: 5001 + index,
        ...seed,
      },
    });
  }

  return seeds.length;
}
