import {
  AuditLogAction,
  AuditLogEntity,
  Prisma,
  type Asset,
  type Department,
  type KnowledgeArticle,
  type PrismaClient,
  type Ticket,
  type User,
} from '@prisma/client';
import { shiftHours } from './seed.utils';

type AuditSeed = {
  actorId: number | null;
  entity: AuditLogEntity;
  entityId: number | null;
  action: AuditLogAction;
  description: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  createdAt: Date;
};

const ipAddresses = [
  '10.20.10.15',
  '10.20.10.21',
  '10.20.20.34',
  '10.20.30.18',
] as const;

export async function seedAuditLogs(
  prisma: PrismaClient,
  departments: Record<string, Department>,
  users: Record<string, User>,
  tickets: Ticket[],
  assets: Record<string, Asset>,
  articles: Record<string, KnowledgeArticle>,
  now: Date,
) {
  const seeds: AuditSeed[] = [];
  const staff = [
    users['it-linh'],
    users['it-minh'],
    users['it-ha'],
    users['it-quang'],
  ];

  for (const ticket of tickets.slice(0, 12)) {
    seeds.push({
      actorId: ticket.createdById,
      entity: AuditLogEntity.TICKET,
      entityId: ticket.id,
      action: AuditLogAction.CREATE,
      description: `Đã tạo ticket “${ticket.title}”.`,
      newValues: {
        title: ticket.title,
        priority: ticket.priority,
        status: 'OPEN',
      },
      createdAt: ticket.createdAt,
    });
  }

  for (const [index, ticket] of tickets
    .filter((item) => item.assignedToId)
    .slice(0, 8)
    .entries()) {
    seeds.push({
      actorId: users.admin.id,
      entity: AuditLogEntity.TICKET,
      entityId: ticket.id,
      action: AuditLogAction.ASSIGNED,
      description: `Đã chỉ định nhân viên IT xử lý ticket “${ticket.title}”.`,
      oldValues: {
        assignedToId: null,
      },
      newValues: {
        assignedToId: ticket.assignedToId,
      },
      createdAt: shiftHours(ticket.createdAt, 1 + index * 0.1),
    });
  }

  for (const [index, ticket] of tickets
    .filter((item) => item.status !== 'OPEN')
    .slice(0, 8)
    .entries()) {
    seeds.push({
      actorId: staff[index % staff.length].id,
      entity: AuditLogEntity.TICKET,
      entityId: ticket.id,
      action: AuditLogAction.STATUS_CHANGED,
      description: `Đã đổi trạng thái ticket “${ticket.title}” sang ${ticket.status}.`,
      oldValues: {
        status: 'OPEN',
      },
      newValues: {
        status: ticket.status,
      },
      createdAt: shiftHours(ticket.createdAt, 3 + index * 0.1),
    });
  }

  for (const [index, asset] of Object.values(assets).slice(0, 8).entries()) {
    seeds.push({
      actorId: users.admin.id,
      entity: AuditLogEntity.ASSET,
      entityId: asset.id,
      action: AuditLogAction.CREATE,
      description: `Đã thêm tài sản ${asset.assetTag} · ${asset.name}.`,
      newValues: {
        assetTag: asset.assetTag,
        name: asset.name,
        type: asset.type,
        status: asset.status,
      },
      createdAt: shiftHours(now, -(300 + index * 6)),
    });
  }

  for (const [index, asset] of Object.values(assets)
    .filter((item) => item.assignedToId)
    .slice(0, 7)
    .entries()) {
    seeds.push({
      actorId: staff[index % staff.length].id,
      entity: AuditLogEntity.ASSET,
      entityId: asset.id,
      action: AuditLogAction.ASSIGNED,
      description: `Đã cấp phát tài sản ${asset.assetTag} cho người dùng.`,
      oldValues: {
        status: 'AVAILABLE',
        assignedToId: null,
      },
      newValues: {
        status: asset.status,
        assignedToId: asset.assignedToId,
      },
      createdAt: shiftHours(now, -(180 - index * 8)),
    });
  }

  const returnedAssets = [
    assets['LAP-0002'],
    assets['MON-0002'],
    assets['PHN-0002'],
  ];

  for (const [index, asset] of returnedAssets.entries()) {
    seeds.push({
      actorId: staff[index].id,
      entity: AuditLogEntity.ASSET,
      entityId: asset.id,
      action: AuditLogAction.RETURNED,
      description: `Đã thu hồi tài sản ${asset.assetTag} và chuyển về trạng thái sẵn sàng.`,
      oldValues: {
        status: 'ASSIGNED',
      },
      newValues: {
        status: 'AVAILABLE',
        assignedToId: null,
      },
      createdAt: shiftHours(now, -(120 - index * 12)),
    });
  }

  for (const [index, asset] of Object.values(assets)
    .filter((item) => item.status === 'MAINTENANCE')
    .entries()) {
    seeds.push({
      actorId: users['it-linh'].id,
      entity: AuditLogEntity.ASSET,
      entityId: asset.id,
      action: AuditLogAction.STATUS_CHANGED,
      description: `Đã chuyển tài sản ${asset.assetTag} sang trạng thái bảo trì.`,
      oldValues: {
        status: 'AVAILABLE',
      },
      newValues: {
        status: 'MAINTENANCE',
      },
      createdAt: shiftHours(now, -(72 - index * 6)),
    });
  }

  for (const [index, article] of Object.values(articles)
    .filter((item) => item.isPublished)
    .slice(0, 6)
    .entries()) {
    seeds.push({
      actorId: article.createdById,
      entity: AuditLogEntity.KNOWLEDGE_ARTICLE,
      entityId: article.id,
      action: AuditLogAction.PUBLISHED,
      description: `Đã xuất bản bài Knowledge “${article.title}”.`,
      oldValues: {
        isPublished: false,
      },
      newValues: {
        isPublished: true,
      },
      createdAt: shiftHours(now, -(60 - index * 5)),
    });
  }

  for (const [index, user] of [
    users['employee-binh'],
    users['employee-lan'],
    users['employee-hung'],
  ].entries()) {
    seeds.push({
      actorId: users.admin.id,
      entity: AuditLogEntity.USER,
      entityId: user.id,
      action: AuditLogAction.ACTIVATED,
      description: `Đã kích hoạt tài khoản ${user.email}.`,
      oldValues: {
        isActive: false,
      },
      newValues: {
        isActive: true,
      },
      createdAt: shiftHours(now, -(48 - index * 4)),
    });
  }

  for (const [index, department] of [
    departments.IT,
    departments.Operations,
  ].entries()) {
    seeds.push({
      actorId: users.admin.id,
      entity: AuditLogEntity.DEPARTMENT,
      entityId: department.id,
      action: AuditLogAction.UPDATE,
      description: `Đã cập nhật thông tin phòng ban ${department.name}.`,
      oldValues: {
        name: department.name,
      },
      newValues: {
        name: department.name,
        reviewed: true,
      },
      createdAt: shiftHours(now, -(24 - index * 3)),
    });
  }

  seeds.push(
    {
      actorId: users.admin.id,
      entity: AuditLogEntity.TICKET,
      entityId: 99_901,
      action: AuditLogAction.DELETED,
      description: 'Đã xóa ticket kiểm tra trùng lặp sau khi xác minh.',
      oldValues: {
        title: 'Yêu cầu hỗ trợ bị tạo trùng',
        status: 'CANCELLED',
      },
      createdAt: shiftHours(now, -12),
    },
    {
      actorId: users.admin.id,
      entity: AuditLogEntity.ASSET,
      entityId: 99_902,
      action: AuditLogAction.DELETED,
      description: 'Đã xóa tài sản nhập nhầm mã khỏi hệ thống.',
      oldValues: {
        assetTag: 'TEMP-ERROR-01',
        name: 'Thiết bị nhập nhầm',
      },
      createdAt: shiftHours(now, -8),
    },
  );

  for (const [index, seed] of seeds.entries()) {
    const data = {
      ...seed,
      oldValues: seed.oldValues ?? Prisma.JsonNull,
      newValues: seed.newValues ?? Prisma.JsonNull,
      ipAddress: ipAddresses[index % ipAddresses.length],
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OfficeFlow Seed Client',
    };

    await prisma.auditLog.upsert({
      where: { id: 7001 + index },
      update: data,
      create: {
        id: 7001 + index,
        ...data,
      },
    });
  }

  return seeds.length;
}
