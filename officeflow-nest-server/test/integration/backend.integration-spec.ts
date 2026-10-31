import { ConfigService } from '@nestjs/config';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { AssetType, Prisma, TicketPriority, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuditLogsService } from '../../src/audit-logs/audit-logs.service';
import { OutboxService } from '../../src/outbox/outbox.service';
import { AssetsService } from '../../src/assets/assets.service';
import { TicketsService } from '../../src/tickets/tickets.service';
import { CloudinaryService } from '../../src/cloudinary/cloudinary.service';
import { RedisService } from '../../src/redis/redis.service';
import { ResilientThrottlerStorage } from '../../src/redis/resilient-throttler.storage';
import { MetricsService } from '../../src/metrics/metrics.service';
import { TicketAccessPolicyService } from '../../src/tickets/ticket-access-policy.service';
import { TicketQueryService } from '../../src/tickets/ticket-query.service';
import { TicketWorkflowService } from '../../src/tickets/ticket-workflow.service';
import { TicketAttachmentService } from '../../src/tickets/ticket-attachment.service';
import { TicketCommentService } from '../../src/tickets/ticket-comment.service';
import { SlaPolicyService } from '../../src/sla/sla-policy.service';
import { SlaService } from '../../src/sla/sla.service';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import { DEFAULT_SLA_POLICY } from '../../src/sla/sla-policy';
import { DateTime } from 'luxon';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { AssetMaintenanceService } from '../../src/assets/asset-maintenance.service';
import {
  AssetWarrantyReminderService,
  AssetWarrantyNotificationListener,
} from '../../src/assets/asset-warranty-reminder.service';
import { assetCareDates } from '../../src/assets/asset-care.util';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { NotificationsListener } from '../../src/notifications/notifications.listener';
import type { TicketSlaAlertEvent } from '../../src/notifications/events/ticket-sla-alert.event';
import { LeavePlanningService } from '../../src/leave-requests/leave-planning.service';
import { LeaveRequestService } from '../../src/leave-requests/leave-requests.service';
import { TicketFeedbackService } from '../../src/tickets/ticket-feedback.service';
import { AiService } from '../../src/ai/ai.service';
import { AiProvider } from '../../src/ai/ai.provider';
import { AiRequestLimiter } from '../../src/ai/ai-request-limiter';
import { AiTask } from '../../src/ai/types/ai-draft.type';
import { AuthService } from '../../src/auth/auth.service';
import { AccountService } from '../../src/users/accounts.service';

describe('Real MySQL/Redis integration (disposable containers only)', () => {
  const prisma = new PrismaService(
    new ConfigService({ DATABASE_URL: process.env.DATABASE_URL }),
  );
  const audit = new AuditLogsService(prisma);
  const outbox = new OutboxService();
  const cloudinary = {
    createPrivateDownloadUrl: jest.fn(),
    downloadFile: jest.fn(),
    deleteFile: jest.fn(),
    uploadFile: jest.fn(),
  };
  const assets = new AssetsService(prisma, audit, outbox);
  const planning = new LeavePlanningService(
    prisma,
    new SlaPolicyService(prisma, audit),
    audit,
  );
  const leave = new LeaveRequestService(prisma, audit, outbox, planning);
  const feedback = new TicketFeedbackService(
    prisma,
    new TicketAccessPolicyService(prisma),
    audit,
    outbox,
    new EventEmitter2(),
  );
  let tickets: TicketsService;
  let redis: RedisService;
  let limiter: ResilientThrottlerStorage;
  let admin: { userId: number; role: 'ADMIN' };
  let employee: { userId: number; role: 'EMPLOYEE' };
  let outsider: { userId: number; role: 'EMPLOYEE' };

  beforeAll(async () => {
    await prisma.onModuleInit();
    const target = await prisma.$queryRaw<
      Array<{ name: string }>
    >`SELECT DATABASE() AS name`;
    expect(target[0].name).toBe('officeflow_phase5_test');
    const createUser = (role: UserRole) =>
      prisma.user.create({
        data: {
          name: role,
          email: `${randomUUID()}@test.invalid`,
          passwordHash: 'test-only',
          role,
        },
      });
    admin = { userId: (await createUser(UserRole.ADMIN)).id, role: 'ADMIN' };
    employee = {
      userId: (await createUser(UserRole.EMPLOYEE)).id,
      role: 'EMPLOYEE',
    };
    outsider = {
      userId: (await createUser(UserRole.EMPLOYEE)).id,
      role: 'EMPLOYEE',
    };
    const module = await Test.createTestingModule({
      providers: [
        TicketsService,
        TicketAccessPolicyService,
        TicketQueryService,
        TicketWorkflowService,
        TicketAttachmentService,
        TicketCommentService,
        SlaPolicyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: audit },
        { provide: OutboxService, useValue: outbox },
        { provide: EventEmitter2, useValue: new EventEmitter2() },
        { provide: CloudinaryService, useValue: cloudinary }, // No external Cloudinary calls.
      ],
    }).compile();
    tickets = module.get(TicketsService);
    redis = new RedisService();
    await redis.getClient().connect();
    limiter = new ResilientThrottlerStorage(redis, new MetricsService());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  afterAll(async () => {
    limiter?.onApplicationShutdown();
    if (redis) await redis.onModuleDestroy();
    await prisma.$disconnect();
    // Fixture data belongs to disposable containers removed by the runner.
  });

  const createAsset = () =>
    assets.create(
      { assetTag: randomUUID(), name: 'Test laptop', type: AssetType.LAPTOP },
      admin,
    );
  const createTicket = () =>
    tickets.create(
      {
        title: randomUUID(),
        description: 'Integration test',
        priority: TicketPriority.MEDIUM,
      },
      employee,
    );

  it.each(['reset', 'change', 'lock'] as const)(
    'rejects a pending login after account %s completes',
    async (operation) => {
      const password = randomUUID();
      const user = await prisma.user.create({
        data: {
          name: 'Login race fixture',
          email: `${randomUUID()}@test.invalid`,
          passwordHash: await bcrypt.hash(password, 4),
          role: UserRole.EMPLOYEE,
        },
      });
      let markPaused!: () => void;
      let resume!: () => void;
      const paused = new Promise<void>((resolve) => {
        markPaused = resolve;
      });
      const released = new Promise<void>((resolve) => {
        resume = resolve;
      });
      const delayedPrisma = {
        user: {
          findUnique: async () => {
            const snapshot = await prisma.user.findUniqueOrThrow({
              where: { id: user.id },
            });
            markPaused();
            await released;
            return snapshot;
          },
        },
        refreshToken: prisma.refreshToken,
        $transaction: (
          work: (tx: Prisma.TransactionClient) => Promise<unknown>,
          options: { isolationLevel: Prisma.TransactionIsolationLevel },
        ) => prisma.$transaction(work, options),
      } as unknown as PrismaService;
      const auth = new AuthService(
        delayedPrisma,
        new JwtService({ secret: randomUUID() }),
      );
      const accounts = new AccountService(prisma, audit, outbox);
      const outcome = auth.login({ email: user.email, password }).then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      try {
        await paused;
        if (operation === 'reset') {
          await accounts.resetPassword(
            user.id,
            { password: randomUUID() },
            admin,
          );
        } else if (operation === 'change') {
          await accounts.changeOwnPassword(
            { currentPassword: password, newPassword: randomUUID() },
            { userId: user.id, role: user.role },
          );
        } else {
          await accounts.lockUser(admin, user.id);
        }
      } finally {
        resume();
      }
      const result = await outcome;
      expect(result).toHaveProperty('error');
      if ('error' in result) {
        expect(result.error).toBeInstanceOf(UnauthorizedException);
      }
      expect(
        await prisma.refreshToken.count({ where: { userId: user.id } }),
      ).toBe(0);
    },
  );

  it('revokes a login committed before an administrative password reset', async () => {
    const password = randomUUID();
    const user = await prisma.user.create({
      data: {
        name: 'Session revocation fixture',
        email: `${randomUUID()}@test.invalid`,
        passwordHash: await bcrypt.hash(password, 4),
        role: UserRole.EMPLOYEE,
      },
    });
    const auth = new AuthService(
      prisma,
      new JwtService({ secret: randomUUID() }),
    );
    const session = await auth.login({ email: user.email, password });
    expect(session.user.id).toBe(user.id);
    expect(
      await prisma.refreshToken.count({
        where: { userId: user.id, revokedAt: null },
      }),
    ).toBe(1);

    await new AccountService(prisma, audit, outbox).resetPassword(
      user.id,
      { password: randomUUID() },
      admin,
    );

    await expect(auth.refresh(session.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(
      await prisma.refreshToken.count({
        where: { userId: user.id, revokedAt: null },
      }),
    ).toBe(0);
  });

  it('rechecks employee edit permissions when processing starts before its transaction', async () => {
    const ticket = await createTicket();
    let markPaused!: () => void;
    let resume!: () => void;
    const paused = new Promise<void>((resolve) => {
      markPaused = resolve;
    });
    const released = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const delayedPrisma = {
      ticket: prisma.ticket,
      $transaction: async (
        work: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options: { isolationLevel: Prisma.TransactionIsolationLevel },
      ) => {
        markPaused();
        await released;
        return prisma.$transaction(work, options);
      },
    } as unknown as PrismaService;
    const workflow = new TicketWorkflowService(
      delayedPrisma,
      new EventEmitter2(),
      audit,
      outbox,
      new TicketQueryService(prisma, new TicketAccessPolicyService(prisma)),
      new SlaPolicyService(prisma, audit),
    );
    const edit = workflow.update(
      ticket.id,
      { title: 'Stale employee edit' },
      employee,
    );
    // Attach a rejection handler immediately; the assertion awaits this below.
    const outcome = edit.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      await paused;
      await tickets.updateStatus(ticket.id, { status: 'IN_PROGRESS' }, admin);
    } finally {
      resume();
    }
    expect(await outcome).toHaveProperty('error.message', 'Ticket is not open');
    expect(
      await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
    ).toMatchObject({ title: ticket.title, status: 'IN_PROGRESS' });
    expect(
      await prisma.ticketHistory.count({
        where: { ticketId: ticket.id, action: 'UPDATE' },
      }),
    ).toBe(0);
  });

  it('lets a manager without a department read their own ticket and rejects another requester', async () => {
    const manager = await prisma.user.create({
      data: {
        name: 'Manager fixture',
        email: `${randomUUID()}@test.invalid`,
        passwordHash: 'test-only',
        role: 'MANAGER',
      },
    });
    const actor = { userId: manager.id, role: UserRole.MANAGER };
    const ticket = await tickets.create(
      { title: randomUUID(), description: 'Manager ownership fixture' },
      actor,
    );
    expect(
      (await tickets.getTickets(actor, {})).items.map((item) => item.id),
    ).toContain(ticket.id);
    await expect(tickets.canGetById(ticket.id, actor)).resolves.toMatchObject({
      id: ticket.id,
    });
    await expect(
      tickets.addComment(
        ticket.id,
        { content: 'Additional information' },
        actor,
      ),
    ).resolves.toMatchObject({ content: 'Additional information' });
    const other = await createTicket();
    await expect(tickets.canGetById(other.id, actor)).rejects.toThrow(
      'Forbidden',
    );
  });

  it.each([
    'add',
    'read',
    'list',
    'detail',
    'history',
    'attachments',
    'url',
    'download',
    'feedback',
  ] as const)(
    'rechecks ticket %s access if the manager changes departments before the transaction',
    async (operation) => {
      const department = await prisma.department.create({
        data: { name: randomUUID() },
      });
      const otherDepartment = await prisma.department.create({
        data: { name: randomUUID() },
      });
      const requester = await prisma.user.create({
        data: {
          name: 'Requester fixture',
          email: `${randomUUID()}@test.invalid`,
          passwordHash: 'test-only',
          departmentId: department.id,
        },
      });
      const manager = await prisma.user.create({
        data: {
          name: 'Manager fixture',
          email: `${randomUUID()}@test.invalid`,
          passwordHash: 'test-only',
          role: UserRole.MANAGER,
          departmentId: department.id,
        },
      });
      const ticket = await tickets.create(
        {
          title: randomUUID(),
          description: 'Discussion authorization fixture',
        },
        { userId: requester.id, role: requester.role },
      );
      await tickets.addComment(
        ticket.id,
        { content: 'Private discussion' },
        { userId: requester.id, role: requester.role },
      );
      const attachment = await prisma.ticketAttachment.create({
        data: {
          ticketId: ticket.id,
          uploadedById: requester.id,
          fileName: 'private.pdf',
          fileUrl:
            'https://res.cloudinary.com/test/raw/authenticated/private.pdf',
          publicId: randomUUID(),
          resourceType: 'raw',
          deliveryType: 'authenticated',
          format: 'pdf',
        },
      });
      let markPaused!: () => void;
      let resume!: () => void;
      const paused = new Promise<void>((resolve) => {
        markPaused = resolve;
      });
      const released = new Promise<void>((resolve) => {
        resume = resolve;
      });
      const delayedPrisma = {
        user: prisma.user,
        ticket: prisma.ticket,
        ticketComment: prisma.ticketComment,
        ticketHistory: prisma.ticketHistory,
        ticketAttachment: prisma.ticketAttachment,
        ticketFeedback: prisma.ticketFeedback,
        $transaction: async (
          work: (tx: Prisma.TransactionClient) => Promise<unknown>,
          options: { isolationLevel: Prisma.TransactionIsolationLevel },
        ) => {
          markPaused();
          await released;
          return prisma.$transaction(work, options);
        },
      } as unknown as PrismaService;
      const comments = new TicketCommentService(
        delayedPrisma,
        outbox,
        new TicketAccessPolicyService(delayedPrisma),
      );
      const actor = { userId: manager.id, role: manager.role };
      const access = new TicketAccessPolicyService(delayedPrisma);
      const query = new TicketQueryService(delayedPrisma, access);
      const files = new TicketAttachmentService(
        delayedPrisma,
        cloudinary,
        outbox,
        access,
      );
      const ratings = new TicketFeedbackService(
        delayedPrisma,
        access,
        audit,
        outbox,
        new EventEmitter2(),
      );
      const operations: Record<typeof operation, () => Promise<unknown>> = {
        add: () =>
          comments.addComment(
            ticket.id,
            { content: 'Stale manager comment' },
            actor,
          ),
        read: () => comments.getComments(ticket.id, actor),
        list: () => query.getTickets(actor, {}),
        detail: () => query.canGetById(ticket.id, actor),
        history: () => query.getHistory(ticket.id, actor),
        attachments: () => files.getAttachments(ticket.id, actor),
        url: () =>
          files.getAttachmentAccessUrl(ticket.id, attachment.id, actor, false),
        download: () =>
          files.downloadAttachment(ticket.id, attachment.id, actor),
        feedback: () => ratings.get(ticket.id, actor),
      };
      const pending = operations[operation]();
      const outcome = pending.then(
        (value: unknown) => ({ value }),
        (error: unknown) => ({ error }),
      );
      try {
        await paused;
        await prisma.user.update({
          where: { id: manager.id },
          data: { departmentId: otherDepartment.id },
        });
      } finally {
        resume();
      }
      const result = await outcome;
      if (operation === 'list') {
        expect(result).toHaveProperty('value.items', []);
        expect(result).toHaveProperty('value.pagination.totalItems', 0);
      } else {
        expect(result).toHaveProperty('error');
        if ('error' in result)
          expect(result.error).toBeInstanceOf(ForbiddenException);
      }
      expect(cloudinary.createPrivateDownloadUrl).not.toHaveBeenCalled();
      expect(cloudinary.downloadFile).not.toHaveBeenCalled();
      expect(
        await prisma.ticketComment.count({ where: { ticketId: ticket.id } }),
      ).toBe(1);
      expect(
        await prisma.ticketHistory.count({
          where: { ticketId: ticket.id, action: 'COMMENTED' },
        }),
      ).toBe(1);
      expect(
        await prisma.outboxEvent.count({
          where: {
            type: 'ticket.commented',
            payload: { path: '$.ticketId', equals: ticket.id },
          },
        }),
      ).toBe(1);
    },
  );

  it('generates a draft from real published knowledge without writing tickets, comments or articles', async () => {
    const knowledge = new KnowledgeService(prisma, audit);
    const topic = `vpn${randomUUID().replaceAll('-', '')}`;
    const ticket = await tickets.create(
      {
        title: `${topic} connection`,
        description: `${topic} connection error`,
        priority: TicketPriority.MEDIUM,
      },
      employee,
    );
    const published = await knowledge.create(
      {
        title: `${topic} guide`,
        content: 'Các bước kiểm tra và cấu hình kết nối VPN.',
        isPublished: true,
      },
      admin,
    );
    await knowledge.create(
      {
        title: `${topic} private draft`,
        content: 'CONFIDENTIAL_DRAFT_DO_NOT_EXPORT',
        isPublished: false,
      },
      admin,
    );
    const provider = {
      status: () => ({ enabled: true, model: 'test-model' }),
      generate: jest.fn().mockResolvedValue({
        draft: {
          title: '',
          summary: '',
          content: 'Kiểm tra kết nối theo hướng dẫn.',
          sourceIds: [published.id],
        },
        model: 'test-model',
        inputTokens: 1,
        outputTokens: 1,
      }),
    };
    const ai = new AiService(
      prisma,
      knowledge,
      provider as unknown as AiProvider,
      new AiRequestLimiter(redis),
      redis,
    );
    const before = await Promise.all([
      prisma.ticketComment.count(),
      prisma.knowledgeArticle.count(),
      prisma.ticketHistory.count(),
    ]);
    const result = await ai.generate(ticket.id, AiTask.REPLY, admin);
    expect(result.sources.map((source) => source.id)).toEqual([published.id]);
    expect(JSON.stringify(provider.generate.mock.calls)).not.toContain(
      'CONFIDENTIAL_DRAFT_DO_NOT_EXPORT',
    );
    expect(
      await Promise.all([
        prisma.ticketComment.count(),
        prisma.knowledgeArticle.count(),
        prisma.ticketHistory.count(),
      ]),
    ).toEqual(before);
    expect(
      await prisma.ticket.findUnique({ where: { id: ticket.id } }),
    ).toMatchObject({ status: ticket.status, assignedToId: null });
    provider.generate.mockImplementationOnce(async () => {
      await prisma.knowledgeArticle.update({
        where: { id: published.id },
        data: { isPublished: false },
      });
      return {
        draft: {
          title: '',
          summary: '',
          content: 'Kiểm tra kết nối theo hướng dẫn.',
          sourceIds: [published.id],
        },
        model: 'test-model',
        inputTokens: 1,
        outputTokens: 1,
      };
    });
    await expect(
      ai.generate(ticket.id, AiTask.REPLY, admin),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('coordinates AI limits across instances with real Redis atomic counters and leases', async () => {
    const first = new AiRequestLimiter(redis);
    const second = new AiRequestLimiter(redis);
    const userId = 900000 + Math.floor(Math.random() * 100000);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const running = first.run(userId, async () => {
      started();
      await pending;
    });
    await entered;
    try {
      await expect(
        second.run(userId, () => Promise.resolve('unused')),
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      release();
      await running;
    }
    for (let count = 0; count < 4; count++)
      await second.run(userId, () => Promise.resolve('draft'));
    await expect(
      first.run(userId, () => Promise.resolve('unused')),
    ).rejects.toMatchObject({ status: 429 });
    expect(
      await redis.getClient().pTTL(redis.key('ai', 'requests', userId)),
    ).toBeGreaterThan(0);
    expect(
      await redis.getClient().get(redis.key('ai', 'lease', userId)),
    ).toBeNull();
  });

  it('keeps maintenance history, exact VND and the asset assignment unchanged with concurrent completion', async () => {
    const asset = await createAsset();
    const care = new AssetMaintenanceService(prisma, audit);
    const today = assetCareDates().today;
    const record = await care.create(
      asset.id,
      {
        title: 'Replace fan',
        kind: 'REPAIR',
        scheduledFor: today,
        vendor: 'Vendor A',
      },
      admin,
    );
    await expect(care.list(asset.id, {}, employee)).rejects.toThrow(
      'Forbidden',
    );
    await expect(
      care.complete(
        asset.id + 10000,
        record.id,
        { version: 0, performedOn: today, cost: '1200000' },
        admin,
      ),
    ).rejects.toThrow('not found');
    const auditFailure = jest
      .spyOn(audit, 'create')
      .mockRejectedValueOnce(new Error('test audit failure'));
    await expect(
      care.complete(
        asset.id,
        record.id,
        { version: 0, performedOn: today, cost: '1200000' },
        admin,
      ),
    ).rejects.toThrow('test audit failure');
    expect(
      await prisma.assetMaintenance.findUnique({ where: { id: record.id } }),
    ).toMatchObject({ status: 'PLANNED', version: 0, cost: null });
    auditFailure.mockRestore();
    const results = await Promise.allSettled([
      care.complete(
        asset.id,
        record.id,
        { version: 0, performedOn: today, cost: '1200000' },
        admin,
      ),
      care.complete(
        asset.id,
        record.id,
        { version: 0, performedOn: today, cost: '1300000' },
        admin,
      ),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    const saved = await prisma.assetMaintenance.findUniqueOrThrow({
      where: { id: record.id },
    });
    expect(['1200000', '1300000']).toContain(saved.cost!.toString());
    expect(saved).toMatchObject({
      status: 'COMPLETED',
      version: 1,
      completedById: admin.userId,
      vendor: 'Vendor A',
    });
    expect(
      await prisma.asset.findUnique({ where: { id: asset.id } }),
    ).toMatchObject({ status: 'AVAILABLE', assignedToId: null });
    await expect(
      care.update(
        asset.id,
        record.id,
        { version: 1, title: 'rewrite history' },
        admin,
      ),
    ).rejects.toThrow('finalized');
    const cancelled = await care.create(
      asset.id,
      { title: 'Clean device', kind: 'MAINTENANCE', scheduledFor: today },
      admin,
    );
    await care.cancel(asset.id, cancelled.id, { version: 0 }, admin);
    const history = await care.list(
      asset.id,
      { status: 'CANCELLED', page: 1, limit: 1 },
      admin,
    );
    expect(history.items).toHaveLength(1);
    expect(history.items[0].id).toBe(cancelled.id);
  });

  it('deduplicates warranty reminders across workers and outbox cleanup, and rechecks delivery permissions', async () => {
    const { start } = assetCareDates();
    const date = (days: number) =>
      new Date(start.getTime() + days * 86_400_000);
    const eligible = await createAsset();
    const outside = await createAsset();
    const retired = await createAsset();
    await prisma.asset.update({
      where: { id: eligible.id },
      data: { warrantyUntil: date(30) },
    });
    await prisma.asset.update({
      where: { id: outside.id },
      data: { warrantyUntil: new Date(date(30).getTime() + 18 * 3_600_000) },
    });
    await prisma.asset.update({
      where: { id: retired.id },
      data: { warrantyUntil: date(1), status: 'RETIRED' },
    });
    const first = new AssetWarrantyReminderService(prisma, outbox);
    const second = new AssetWarrantyReminderService(prisma, outbox);
    await Promise.all([
      first.notifyExpiringWarranties(),
      second.notifyExpiringWarranties(),
    ]);
    expect(
      await prisma.assetWarrantyReminder.count({
        where: { assetId: eligible.id },
      }),
    ).toBe(1);
    expect(
      await prisma.assetWarrantyReminder.count({
        where: { assetId: { in: [outside.id, retired.id] } },
      }),
    ).toBe(0);
    const key = `asset-warranty:${eligible.id}:${date(30).toISOString().slice(0, 10)}`;
    const event = await prisma.outboxEvent.findUniqueOrThrow({
      where: { deduplicationKey: key },
    });
    const payload = event.payload as unknown as {
      assetId: number;
      assetTag: string;
      assetName: string;
      warrantyDate: string;
      recipientIds: number[];
    };
    expect(payload.recipientIds).toContain(admin.userId);
    expect(payload.recipientIds).not.toContain(employee.userId);
    const listener = new AssetWarrantyNotificationListener(
      prisma,
      new NotificationsService(prisma),
    );
    await listener.handle({ ...payload, outboxEventId: event.id });
    await listener.handle({ ...payload, outboxEventId: event.id });
    expect(
      await prisma.notification.count({
        where: { sourceEventId: event.id, userId: admin.userId },
      }),
    ).toBe(1);
    await prisma.outboxEvent.delete({ where: { id: event.id } });
    await first.notifyExpiringWarranties();
    expect(
      await prisma.outboxEvent.count({ where: { deduplicationKey: key } }),
    ).toBe(0);
    // A changed deadline gets its own reminder when it enters the window.
    await prisma.asset.update({
      where: { id: eligible.id },
      data: { warrantyUntil: date(20) },
    });
    await first.notifyExpiringWarranties();
    expect(
      await prisma.assetWarrantyReminder.count({
        where: { assetId: eligible.id },
      }),
    ).toBe(2);
    const listed = await assets.findAll({ warranty: 'EXPIRING', limit: 100 });
    expect(listed.items.map((item) => item.id)).toContain(eligible.id);
    expect(listed.items.map((item) => item.id)).not.toContain(outside.id);
    expect(listed.items.map((item) => item.id)).not.toContain(retired.id);
  });

  it('reports saved SLA calendars, repeated reopenings and scoped backlog against real MySQL', async () => {
    const department = await prisma.department.create({
      data: { name: randomUUID() },
    });
    const creator = await prisma.user.create({
      data: {
        name: 'Report owner',
        email: `${randomUUID()}@test.invalid`,
        passwordHash: 'test-only',
        departmentId: department.id,
      },
    });
    const manager = await prisma.user.create({
      data: {
        name: 'Report manager',
        email: `${randomUUID()}@test.invalid`,
        passwordHash: 'test-only',
        role: 'MANAGER',
        departmentId: department.id,
      },
    });
    const monday = DateTime.now()
      .setZone('Asia/Ho_Chi_Minh')
      .startOf('week')
      .minus({ weeks: 1 });
    const friday = monday.plus({ days: 4 });
    const createdAt = friday.set({ hour: 11 }).toJSDate();
    const answeredAt = friday.set({ hour: 14 }).toJSDate();
    const make = (data: Record<string, unknown> = {}) =>
      prisma.ticket.create({
        data: {
          title: 'Report fixture',
          description: 'Integration',
          createdById: creator.id,
          createdAt,
          slaPolicy: DEFAULT_SLA_POLICY,
          ...data,
        },
      });
    await make({
      status: 'RESOLVED',
      firstRespondedAt: answeredAt,
      resolveAt: answeredAt,
    });
    await make({
      status: 'CLOSED',
      resolveAt: answeredAt,
      slaPolicy: { ...DEFAULT_SLA_POLICY, holidays: [friday.toISODate()!] },
    });
    const reopened = await make({ status: 'IN_PROGRESS' });
    await prisma.ticketHistory.createMany({
      data: [
        { oldValue: 'IN_PROGRESS', newValue: 'RESOLVED' },
        { oldValue: 'RESOLVED', newValue: 'IN_PROGRESS' },
        { oldValue: 'IN_PROGRESS', newValue: 'RESOLVED' },
        { oldValue: 'RESOLVED', newValue: 'IN_PROGRESS' },
      ].map((change) => ({
        ...change,
        action: 'STATUS_CHANGED',
        ticketId: reopened.id,
        userId: admin.userId,
        createdAt: answeredAt,
      })),
    });
    await make({
      createdAt: monday.minus({ days: 40 }).toJSDate(),
      slaPolicy: undefined,
    });
    const dashboard = new DashboardService(prisma, redis, new MetricsService());
    const range = { from: friday.toISODate()!, to: friday.toISODate()! };
    const report = await dashboard.getPerformance(
      { userId: creator.id, role: 'EMPLOYEE' },
      range,
    );
    expect(report.cohort).toMatchObject({
      total: 3,
      completed: 2,
      everCompleted: 3,
      reopened: 1,
      reopenRate: 33.33,
      firstResponse: { minutes: 120, samples: 1 },
      resolution: { minutes: 60, samples: 2 },
    });
    expect(report.daily).toEqual([
      { date: range.from, created: 3, completed: 2 },
    ]);
    expect(report.backlog.reduce((sum, bucket) => sum + bucket.total, 0)).toBe(
      2,
    );
    expect(report.backlog.at(-1)?.total).toBe(1);
    const managerReport = await dashboard.getPerformance(
      { userId: manager.id, role: 'MANAGER' },
      range,
    );
    expect(managerReport.cohort).toEqual(report.cohort);
    const privateReport = await dashboard.getPerformance(outsider, range);
    expect(privateReport.cohort.total).toBe(0);
    expect(privateReport.backlog.every((bucket) => bucket.total === 0)).toBe(
      true,
    );
  });

  it('suggests published VPN guides and denies a guide after it becomes a draft', async () => {
    const knowledge = new KnowledgeService(prisma, audit);
    const createArticle = (isPublished: boolean) =>
      prisma.knowledgeArticle.create({
        data: {
          title: 'Hướng dẫn VPN',
          slug: randomUUID(),
          content: 'Mở VPN và kiểm tra tài khoản kết nối.',
          tags: 'vpn,network',
          isPublished,
          createdById: admin.userId,
        },
      });
    const published = await createArticle(true);
    await createArticle(false);
    for (const actor of [employee, admin]) {
      const suggestions = await knowledge.suggestForTicket(
        { title: 'Không kết nối được VPN' },
        actor,
      );
      expect(suggestions.map((article) => article.id)).toEqual([published.id]);
      expect(suggestions[0]).not.toHaveProperty('content');
    }
    await expect(
      knowledge.getById(published.id, employee),
    ).resolves.toMatchObject({ content: published.content, viewCount: 1 });
    await prisma.knowledgeArticle.update({
      where: { id: published.id },
      data: { isPublished: false },
    });
    await expect(knowledge.getById(published.id, employee)).rejects.toThrow(
      'Forbidden',
    );
    expect(
      (
        await prisma.knowledgeArticle.findUniqueOrThrow({
          where: { id: published.id },
        })
      ).viewCount,
    ).toBe(1);
  });

  it('finds accented Vietnamese knowledge using unaccented draft text', async () => {
    const article = await prisma.knowledgeArticle.create({
      data: {
        title: 'Máy in bị kẹt giấy',
        slug: randomUUID(),
        content: 'Hướng dẫn gỡ giấy và kiểm tra máy in.',
        isPublished: true,
        createdById: admin.userId,
      },
    });
    const knowledge = new KnowledgeService(prisma, audit);
    const suggestions = await knowledge.suggestForTicket(
      { title: 'may in' },
      employee,
    );
    expect(suggestions[0].id).toBe(article.id);
  });

  it('commits ticket/history/audit/outbox together and enforces read access', async () => {
    const ticket = await createTicket();
    expect(
      await prisma.ticketHistory.count({
        where: { ticketId: ticket.id, action: 'CREATE' },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { entity: 'TICKET', entityId: ticket.id, action: 'CREATE' },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { deduplicationKey: `ticket-created:${ticket.id}` },
      }),
    ).toBe(1);
    await expect(tickets.canGetById(ticket.id, outsider)).rejects.toThrow(
      'not allowed',
    );
    await expect(
      tickets.canGetById(ticket.id, employee),
    ).resolves.toMatchObject({ id: ticket.id });
    const listed = await tickets.getTickets(outsider, {});
    expect(listed.items.map((item) => item.id)).not.toContain(ticket.id);
  });

  it('rolls back ticket/history/audit when the outbox write fails', async () => {
    const title = randomUUID();
    const auditCount = await prisma.auditLog.count();
    const historyCount = await prisma.ticketHistory.count();
    jest
      .spyOn(outbox, 'enqueue')
      .mockRejectedValueOnce(new Error('forced outbox failure'));
    await expect(
      tickets.create(
        { title, description: 'rollback', priority: TicketPriority.LOW },
        employee,
      ),
    ).rejects.toThrow('forced outbox');
    expect(await prisma.ticket.count({ where: { title } })).toBe(0);
    expect(await prisma.auditLog.count()).toBe(auditCount);
    expect(await prisma.ticketHistory.count()).toBe(historyCount);
  });

  it('bulk assignment commits once per changed ticket and updates queue/workload counts', async () => {
    const first = await createTicket();
    const second = await createTicket();
    const before = await tickets.getWorkload(admin);
    const input = {
      ticketIds: [first.id, second.id],
      assignedToId: admin.userId,
    };
    expect(await tickets.bulkAssign(input, admin)).toEqual({
      assignedCount: 2,
      unchangedCount: 0,
    });
    expect(await tickets.bulkAssign(input, admin)).toEqual({
      assignedCount: 0,
      unchangedCount: 2,
    });
    expect(
      await prisma.ticketHistory.count({
        where: { ticketId: { in: input.ticketIds }, action: 'ASSIGNED' },
      }),
    ).toBe(2);
    const after = await tickets.getWorkload(admin);
    expect(after.unassignedTickets).toBe(before.unassignedTickets - 2);
    const activeCount = (data: typeof before) =>
      data.items.find((item) => item.id === admin.userId)?.totalTickets ?? 0;
    expect(activeCount(after)).toBe(activeCount(before) + 2);
    const mine = await tickets.getTickets(admin, {
      assignedToId: admin.userId,
      activeOnly: true,
    });
    expect(mine.items.map((ticket) => ticket.id)).toEqual(
      expect.arrayContaining(input.ticketIds),
    );
    const privateList = await tickets.getTickets(outsider, {
      assignedToId: admin.userId,
    });
    expect(privateList.items.map((ticket) => ticket.id)).not.toEqual(
      expect.arrayContaining(input.ticketIds),
    );
  });

  it('rolls back the whole bulk assignment when the second event cannot be persisted', async () => {
    const first = await createTicket();
    const second = await createTicket();
    const ids = [first.id, second.id];
    const realOutbox = new OutboxService();
    jest
      .spyOn(outbox, 'enqueue')
      .mockImplementationOnce((client, params) =>
        realOutbox.enqueue(client, params),
      )
      .mockRejectedValueOnce(new Error('forced batch failure'));
    await expect(
      tickets.bulkAssign({ ticketIds: ids, assignedToId: admin.userId }, admin),
    ).rejects.toThrow('forced batch failure');
    expect(
      await prisma.ticket.count({
        where: { id: { in: ids }, assignedToId: null },
      }),
    ).toBe(2);
    expect(
      await prisma.ticketHistory.count({
        where: { ticketId: { in: ids }, action: 'ASSIGNED' },
      }),
    ).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: { entity: 'TICKET', entityId: { in: ids }, action: 'ASSIGNED' },
      }),
    ).toBe(0);
    expect(
      await prisma.outboxEvent.count({
        where: {
          type: 'ticket.assigned',
          payload: { path: '$.ticketId', equals: first.id },
        },
      }),
    ).toBe(0);
  });

  it('rolls back comments and history if event persistence fails', async () => {
    const ticket = await createTicket();
    jest
      .spyOn(outbox, 'enqueue')
      .mockRejectedValueOnce(new Error('forced comment failure'));
    await expect(
      tickets.addComment(ticket.id, { content: 'rollback me' }, employee),
    ).rejects.toThrow('forced comment');
    expect(
      await prisma.ticketComment.count({ where: { ticketId: ticket.id } }),
    ).toBe(0);
    expect(
      await prisma.ticketHistory.count({
        where: { ticketId: ticket.id, action: 'COMMENTED' },
      }),
    ).toBe(0);
  });

  it('allows only one concurrent asset assignment and one open history', async () => {
    const asset = await createAsset();
    const results = await Promise.allSettled([
      assets.assign(asset.id, { userId: employee.userId }, admin),
      assets.assign(asset.id, { userId: outsider.userId }, admin),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    const stored = await prisma.asset.findUniqueOrThrow({
      where: { id: asset.id },
    });
    const histories = await prisma.assetAssignment.findMany({
      where: { assetId: asset.id, returnedAt: null },
    });
    expect(histories).toHaveLength(1);
    expect(histories[0].assignedToId).toBe(stored.assignedToId);
    expect(stored.status).toBe('ASSIGNED');
  });

  it('rolls back asset assignment and history on audit failure', async () => {
    const asset = await createAsset();
    jest
      .spyOn(audit, 'create')
      .mockRejectedValueOnce(new Error('forced audit failure'));
    await expect(
      assets.assign(asset.id, { userId: employee.userId }, admin),
    ).rejects.toThrow('forced audit');
    expect(
      await prisma.asset.findUnique({ where: { id: asset.id } }),
    ).toMatchObject({ status: 'AVAILABLE', assignedToId: null });
    expect(
      await prisma.assetAssignment.count({ where: { assetId: asset.id } }),
    ).toBe(0);
  });

  it('returns an asset and closes its history on the real database', async () => {
    const asset = await createAsset();
    await assets.assign(asset.id, { userId: employee.userId }, admin);
    await assets.returnAsset(asset.id, { notes: 'done' }, admin);
    expect(
      await prisma.asset.findUnique({ where: { id: asset.id } }),
    ).toMatchObject({ status: 'AVAILABLE', assignedToId: null });
    expect(
      await prisma.assetAssignment.count({
        where: { assetId: asset.id, returnedAt: null },
      }),
    ).toBe(0);
  });

  it('persists JSON with real TTL and evicts malformed values', async () => {
    const key = redis.key(randomUUID());
    await redis.setJson(key, { count: 3 }, 60);
    expect(await redis.getJson(key)).toEqual({ count: 3 });
    expect(await redis.getClient().ttl(key)).toBeGreaterThan(0);
    await redis.set(key, '{broken');
    expect(await redis.getJson(key)).toBeNull();
    expect(await redis.get(key)).toBeNull();
  });

  it('expires a real Redis key', async () => {
    const key = redis.key(randomUUID());
    await redis.set(key, 'short-lived', 60);
    await redis.getClient().pExpire(key, 1);
    // Poll with a deadline; do not assume exact wall-clock scheduler timing.
    const deadline = Date.now() + 2000;
    while ((await redis.get(key)) !== null && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(await redis.get(key)).toBeNull();
  });

  it('atomically increments the shared dashboard version', async () => {
    const before = await redis.getDashboardVersion();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => redis.incrementDashboardVersion()),
    );
    expect(new Set(results).size).toBe(8);
    expect(await redis.getDashboardVersion()).toBe(before + 8);
    expect(
      await redis.getClient().ttl(redis.key('dashboard', 'version')),
    ).toBeGreaterThan(0);
  });

  it('shares a distributed rate limit and falls back on a disconnected client', async () => {
    const other = new ResilientThrottlerStorage(redis, new MetricsService());
    try {
      const key = redis.key('limit', randomUUID());
      await limiter.increment(key, 60000, 1, 60000, 'default');
      expect(
        (await other.increment(key, 60000, 1, 60000, 'default')).isBlocked,
      ).toBe(true);
      await redis.onModuleDestroy();
      expect(
        (
          await limiter.increment(
            redis.key(randomUUID()),
            60000,
            10,
            60000,
            'default',
          )
        ).isBlocked,
      ).toBe(false);
      await redis.getClient().connect();
      expect(redis.isReady()).toBe(true);
    } finally {
      other.onApplicationShutdown();
    }
  });
  it.each(['department', 'ticket_deleted'] as const)(
    'does not save an uploaded asset after access changes: %s',
    async (change) => {
      const department = await prisma.department.create({
        data: { name: randomUUID() },
      });
      const requester = await prisma.user.create({
        data: {
          name: 'Requester fixture',
          email: `${randomUUID()}@test.invalid`,
          passwordHash: 'test-only',
          departmentId: department.id,
        },
      });
      const manager = await prisma.user.create({
        data: {
          name: 'Manager fixture',
          email: `${randomUUID()}@test.invalid`,
          passwordHash: 'test-only',
          role: UserRole.MANAGER,
          departmentId: department.id,
        },
      });
      const ticket = await tickets.create(
        { title: randomUUID(), description: 'Upload authorization fixture' },
        { userId: requester.id, role: requester.role },
      );
      const uploaded = {
        publicId: randomUUID(),
        resourceType: 'raw',
        deliveryType: 'authenticated',
        format: 'pdf',
        secureUrl: 'https://res.cloudinary.com/test/raw/authenticated/test.pdf',
      };
      cloudinary.uploadFile.mockImplementationOnce(async () => {
        if (change === 'department') {
          await prisma.user.update({
            where: { id: manager.id },
            data: { departmentId: null },
          });
        } else {
          await tickets.remove(ticket.id, admin);
        }
        return uploaded;
      });
      cloudinary.deleteFile.mockResolvedValueOnce(undefined);
      const file = {
        originalname: 'report.pdf',
        mimetype: 'application/pdf',
        size: 12,
      } as Express.Multer.File;
      await expect(
        tickets.uploadAttachment(ticket.id, file, {
          userId: manager.id,
          role: manager.role,
        }),
      ).rejects.toThrow(
        change === 'department' ? ForbiddenException : NotFoundException,
      );
      expect(
        await prisma.ticketAttachment.count({ where: { ticketId: ticket.id } }),
      ).toBe(0);
      expect(
        await prisma.ticketHistory.count({
          where: { ticketId: ticket.id, action: 'ATTACHMENT_ADDED' },
        }),
      ).toBe(0);
      expect(cloudinary.uploadFile).toHaveBeenCalledTimes(1);
      expect(cloudinary.deleteFile).toHaveBeenCalledWith(
        uploaded.publicId,
        uploaded.resourceType,
        uploaded.deliveryType,
      );
    },
  );

  it('uses database authorization before signing or downloading an attachment', async () => {
    const ticket = await createTicket();
    const attachment = await prisma.ticketAttachment.create({
      data: {
        ticketId: ticket.id,
        uploadedById: employee.userId,
        fileName: 'report.pdf',
        fileUrl: 'https://res.cloudinary.com/test/raw/authenticated/test.pdf',
        publicId: randomUUID(),
        resourceType: 'raw',
        deliveryType: 'authenticated',
        format: 'pdf',
      },
    });
    cloudinary.createPrivateDownloadUrl.mockReturnValue({
      url: 'https://api.cloudinary.com/test',
      expiresAt: new Date(),
    });
    cloudinary.downloadFile.mockResolvedValue(Buffer.from('test'));
    await expect(
      tickets.getAttachmentAccessUrl(ticket.id, attachment.id, outsider, true),
    ).rejects.toThrow('Forbidden');
    expect(cloudinary.createPrivateDownloadUrl).not.toHaveBeenCalled();
    const download = await tickets.downloadAttachment(
      ticket.id,
      attachment.id,
      employee,
    );
    expect(download.fileName).toBe('report.pdf');
    expect(download.file).toEqual(Buffer.from('test'));
    expect(cloudinary.createPrivateDownloadUrl).toHaveBeenCalledWith(
      attachment.publicId,
      'pdf',
      'raw',
      'authenticated',
      true,
    );
  });

  it('rolls back attachment deletion when enqueue fails, then commits deletion with its job', async () => {
    const ticket = await createTicket();
    const attachment = await prisma.ticketAttachment.create({
      data: {
        ticketId: ticket.id,
        uploadedById: employee.userId,
        fileName: 'delete.pdf',
        fileUrl: 'https://res.cloudinary.com/test/raw/authenticated/test.pdf',
        publicId: randomUUID(),
        resourceType: 'raw',
        deliveryType: 'authenticated',
        format: 'pdf',
      },
    });
    const enqueueSpy = jest
      .spyOn(outbox, 'enqueue')
      .mockRejectedValueOnce(new Error('forced attachment failure'));
    await expect(
      tickets.deleteAttachment(ticket.id, attachment.id, employee),
    ).rejects.toThrow('forced attachment');
    expect(
      await prisma.ticketAttachment.findUnique({
        where: { id: attachment.id },
      }),
    ).not.toBeNull();
    expect(
      await prisma.ticketHistory.count({
        where: { ticketId: ticket.id, action: 'ATTACHMENT_DELETED' },
      }),
    ).toBe(0);
    enqueueSpy.mockRestore();
    await tickets.deleteAttachment(ticket.id, attachment.id, employee);
    expect(
      await prisma.ticketAttachment.findUnique({
        where: { id: attachment.id },
      }),
    ).toBeNull();
    const event = await prisma.outboxEvent.findUniqueOrThrow({
      where: {
        deduplicationKey: `cloudinary-delete:ticket:${ticket.id}:attachment:${attachment.id}`,
      },
    });
    expect(event.payload).toMatchObject({
      publicId: attachment.publicId,
      deliveryType: 'authenticated',
      resourceType: 'raw',
    });
    expect(cloudinary.deleteFile).not.toHaveBeenCalled();
  });

  it('commits status history and outbox without changing the HTTP-facing result shape', async () => {
    const ticket = await createTicket();
    const updated = await tickets.updateStatus(
      ticket.id,
      { status: 'IN_PROGRESS' },
      admin,
    );
    expect(updated).toMatchObject({ id: ticket.id, status: 'IN_PROGRESS' });
    expect(
      await prisma.ticketHistory.count({
        where: { ticketId: ticket.id, action: 'STATUS_CHANGED' },
      }),
    ).toBe(1);
    await expect(
      tickets.updateStatus(ticket.id, { status: 'CLOSED' }, admin),
    ).rejects.toThrow();
    expect(
      await prisma.ticket.findUnique({ where: { id: ticket.id } }),
    ).toMatchObject({ status: 'IN_PROGRESS' });
  });

  it('snapshots the SLA policy and leaves existing deadlines unchanged after a policy/priority edit', async () => {
    const policies = new SlaPolicyService(prisma, audit);
    const before = await policies.get();
    const first = await createTicket();
    const stored = await prisma.ticket.findUniqueOrThrow({
      where: { id: first.id },
    });
    await policies.update(
      {
        version: before.version,
        config: { ...DEFAULT_SLA_POLICY, warningMinutes: 30 },
      },
      admin,
    );
    await tickets.update(first.id, { priority: TicketPriority.URGENT }, admin);
    const after = await prisma.ticket.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(after.slaPolicy).toEqual(stored.slaPolicy);
    expect(after.dueAt).toEqual(stored.dueAt);
    const second = await createTicket();
    expect(
      await prisma.ticket.findUniqueOrThrow({ where: { id: second.id } }),
    ).toMatchObject({ slaPolicy: { warningMinutes: 30 } });
    await expect(
      policies.update(
        { version: before.version, config: DEFAULT_SLA_POLICY },
        admin,
      ),
    ).rejects.toThrow('changed');
  });

  it('keeps policy changes atomic with their audit record', async () => {
    const policies = new SlaPolicyService(prisma, audit);
    const before = await policies.get();
    jest
      .spyOn(audit, 'create')
      .mockRejectedValueOnce(new Error('forced policy audit failure'));
    await expect(
      policies.update(
        {
          version: before.version,
          config: { ...before.config, warningMinutes: 15 },
        },
        admin,
      ),
    ).rejects.toThrow('forced policy audit failure');
    expect(await policies.get()).toEqual(before);
  });

  it('records only the first staff reply and retains a late response breach', async () => {
    const ticket = await createTicket();
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { firstResponseDueAt: new Date(Date.now() - 60_000) },
    });
    await tickets.addComment(
      ticket.id,
      { content: 'Requester adds more information' },
      employee,
    );
    expect(
      (await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }))
        .firstRespondedAt,
    ).toBeNull();
    await tickets.addComment(
      ticket.id,
      { content: 'IT is investigating the issue' },
      admin,
    );
    const first = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    expect(first.firstRespondedAt).not.toBeNull();
    expect(first.firstResponseOverdue).toBe(true);
    await tickets.addComment(
      ticket.id,
      { content: 'IT provides a follow-up update' },
      admin,
    );
    expect(
      (await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }))
        .firstRespondedAt,
    ).toEqual(first.firstRespondedAt);
  });

  it('rolls back first-response tracking when persisting the comment event fails', async () => {
    const ticket = await createTicket();
    jest
      .spyOn(outbox, 'enqueue')
      .mockRejectedValueOnce(new Error('forced response failure'));
    await expect(
      tickets.addComment(
        ticket.id,
        { content: 'IT initial response must roll back' },
        admin,
      ),
    ).rejects.toThrow('forced response failure');
    expect(
      (await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }))
        .firstRespondedAt,
    ).toBeNull();
    expect(
      await prisma.ticketComment.count({ where: { ticketId: ticket.id } }),
    ).toBe(0);
  });

  it('detects a late resolution before the SLA worker has run', async () => {
    const ticket = await createTicket();
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'IN_PROGRESS',
        dueAt: new Date(Date.now() - 60_000),
        firstResponseDueAt: new Date(Date.now() - 120_000),
      },
    });
    const resolved = await tickets.updateStatus(
      ticket.id,
      { status: 'RESOLVED' },
      admin,
    );
    expect(resolved).toMatchObject({
      isOverdue: true,
      firstResponseOverdue: true,
    });
  });

  it('deduplicates concurrent warnings even after processed outbox records are removed', async () => {
    const ticket = await createTicket();
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        dueAt: new Date(Date.now() + 3_600_000),
        resolutionWarningAt: new Date(Date.now() - 60_000),
      },
    });
    const first = new SlaService(prisma, new EventEmitter2(), outbox);
    const second = new SlaService(prisma, new EventEmitter2(), outbox);
    await Promise.all([
      first.markOverdueTickets(),
      second.markOverdueTickets(),
    ]);
    const key = `ticket-sla:${ticket.id}:RESOLUTION:WARNING`;
    expect(
      await prisma.outboxEvent.count({ where: { deduplicationKey: key } }),
    ).toBe(1);
    await prisma.outboxEvent.deleteMany({ where: { deduplicationKey: key } });
    await first.markOverdueTickets();
    expect(
      await prisma.outboxEvent.count({ where: { deduplicationKey: key } }),
    ).toBe(0);
    expect(
      await prisma.slaAlert.count({
        where: { ticketId: ticket.id, kind: 'WARNING' },
      }),
    ).toBe(1);
  });

  it('escalates without reassigning, grants only the notified manager access, and preserves scope during search', async () => {
    const department = await prisma.department.create({
      data: { name: randomUUID() },
    });
    const managerUser = await prisma.user.create({
      data: {
        name: 'IT manager',
        email: `${randomUUID()}@test.invalid`,
        passwordHash: 'test-only',
        role: 'MANAGER',
        departmentId: department.id,
      },
    });
    const manager = { userId: managerUser.id, role: UserRole.MANAGER };
    const staff = await prisma.user.create({
      data: {
        name: 'IT staff',
        email: `${randomUUID()}@test.invalid`,
        passwordHash: 'test-only',
        role: 'IT_STAFF',
        managerId: manager.userId,
      },
    });
    const ticket = await createTicket();
    const privateTicket = await createTicket();
    await tickets.assign(ticket.id, { assignedToId: staff.id }, admin);
    await expect(tickets.canGetById(ticket.id, manager)).rejects.toThrow(
      'Forbidden',
    );
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { dueAt: new Date(Date.now() - 60_000), resolutionWarningAt: null },
    });
    await new SlaService(
      prisma,
      new EventEmitter2(),
      outbox,
    ).markOverdueTickets();
    expect(
      await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
    ).toMatchObject({ assignedToId: staff.id, isOverdue: true });
    await expect(tickets.canGetById(ticket.id, manager)).resolves.toMatchObject(
      { id: ticket.id },
    );
    const listed = await tickets.getTickets(manager, {
      keyword: 'Integration',
    });
    expect(listed.items.map((item) => item.id)).toContain(ticket.id);
    expect(listed.items.map((item) => item.id)).not.toContain(privateTicket.id);
    await expect(tickets.canGetById(privateTicket.id, manager)).rejects.toThrow(
      'Forbidden',
    );
    const event = await prisma.outboxEvent.findUniqueOrThrow({
      where: {
        deduplicationKey: `ticket-sla:${ticket.id}:RESOLUTION:ESCALATED`,
      },
    });
    const payload = event.payload as unknown as TicketSlaAlertEvent;
    expect(payload.recipientIds).toEqual(
      expect.arrayContaining([admin.userId, manager.userId]),
    );
    const listener = new NotificationsListener(
      new NotificationsService(prisma),
    );
    await listener.handleTicketSlaAlert({
      ...payload,
      outboxEventId: event.id,
    });
    await listener.handleTicketSlaAlert({
      ...payload,
      outboxEventId: event.id,
    });
    expect(
      await prisma.notification.count({
        where: { sourceEventId: event.id, type: 'TICKET_SLA_ESCALATED' },
      }),
    ).toBe(payload.recipientIds.length);
    await tickets.assign(privateTicket.id, { assignedToId: staff.id }, admin);
    await prisma.ticket.update({
      where: { id: privateTicket.id },
      data: {
        slaPolicy: { ...DEFAULT_SLA_POLICY, escalation: 'ADMINS' },
        dueAt: new Date(Date.now() - 60_000),
      },
    });
    await new SlaService(
      prisma,
      new EventEmitter2(),
      outbox,
    ).markOverdueTickets();
    await expect(tickets.canGetById(privateTicket.id, manager)).rejects.toThrow(
      'Forbidden',
    );
  });

  it('rolls back a warning marker when its outbox event cannot be persisted', async () => {
    const ticket = await createTicket();
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        dueAt: new Date(Date.now() + 3_600_000),
        resolutionWarningAt: new Date(Date.now() - 60_000),
      },
    });
    jest
      .spyOn(outbox, 'enqueue')
      .mockRejectedValueOnce(new Error('forced warning failure'));
    const worker = new SlaService(prisma, new EventEmitter2(), outbox);
    await expect(worker.markOverdueTickets()).rejects.toThrow(
      'forced warning failure',
    );
    expect(
      await prisma.slaAlert.count({ where: { ticketId: ticket.id } }),
    ).toBe(0);
    await worker.markOverdueTickets();
    expect(
      await prisma.slaAlert.count({
        where: { ticketId: ticket.id, kind: 'WARNING' },
      }),
    ).toBe(1);
  });

  async function leaveFixture() {
    await prisma.slaPolicy.upsert({
      where: { id: 1 },
      create: { id: 1, config: DEFAULT_SLA_POLICY },
      update: { config: DEFAULT_SLA_POLICY },
    });
    const department = await prisma.department.create({
      data: { name: randomUUID() },
    });
    const manager = await prisma.user.create({
      data: {
        name: 'Quản lý',
        email: `${randomUUID()}@test.invalid`,
        passwordHash: 'test-only',
        role: 'MANAGER',
        departmentId: department.id,
      },
    });
    const requester = await prisma.user.create({
      data: {
        name: 'Người nghỉ',
        email: `${randomUUID()}@test.invalid`,
        passwordHash: 'test-only',
        departmentId: department.id,
        managerId: manager.id,
      },
    });
    return {
      actor: { userId: requester.id, role: 'EMPLOYEE' as const },
      manager: { userId: manager.id, role: 'MANAGER' as const },
      department,
    };
  }

  it('saves an allowance even when the transaction exceeds the old five-second timeout', async () => {
    const { actor } = await leaveFixture();
    const readBalance = planning.balance.bind(
      planning,
    ) as typeof planning.balance;
    const delayedBalance = jest
      .spyOn(planning, 'balance')
      .mockImplementationOnce(async (...args) => {
        const balance = await readBalance(...args);
        // Reproduce hosted-database latency after reads have started the transaction.
        await new Promise((resolve) => setTimeout(resolve, 5500));
        return balance;
      });
    const saved = await planning.setEntitlement(
      actor.userId,
      2035,
      { days: 10, version: 0 },
      admin,
    );
    delayedBalance.mockRestore();
    expect(saved).toMatchObject({ allowance: 10, remaining: 10, version: 1 });
    expect(
      await prisma.leaveEntitlement.findUnique({
        where: { userId_year: { userId: actor.userId, year: 2035 } },
      }),
    ).toMatchObject({ halfDays: 20, version: 1 });
    expect(await planning.getBalance({ year: 2035 }, actor)).toEqual(saved);
  });

  it('keeps allowance version checks and audit rollback atomic after extending the latency budget', async () => {
    const { actor } = await leaveFixture();
    const auditFailure = jest
      .spyOn(audit, 'create')
      .mockRejectedValueOnce(new Error('forced allowance audit failure'));
    await expect(
      planning.setEntitlement(
        actor.userId,
        2035,
        { days: 10, version: 0 },
        admin,
      ),
    ).rejects.toThrow('forced allowance audit');
    auditFailure.mockRestore();
    expect(
      await prisma.leaveEntitlement.findUnique({
        where: { userId_year: { userId: actor.userId, year: 2035 } },
      }),
    ).toBeNull();
    const results = await Promise.allSettled([
      planning.setEntitlement(
        actor.userId,
        2035,
        { days: 10, version: 0 },
        admin,
      ),
      planning.setEntitlement(
        actor.userId,
        2035,
        { days: 12.5, version: 0 },
        admin,
      ),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const balance = await planning.getBalance({ year: 2035 }, actor);
    expect([10, 12.5]).toContain(balance.allowance);
    expect(balance.version).toBe(1);
    await expect(
      planning.setEntitlement(
        actor.userId,
        2035,
        { days: 20, version: 0 },
        admin,
      ),
    ).rejects.toThrow('changed');
  });

  it('reserves annual leave atomically, releases cancellations and keeps approval from charging twice', async () => {
    const { actor, manager } = await leaveFixture();
    const base = {
      startDate: '2035-01-08',
      endDate: '2035-01-08',
      reason: 'Việc gia đình',
      type: 'ANNUAL' as const,
      period: 'MORNING' as const,
    };
    await expect(leave.create(base, actor)).rejects.toThrow('not configured');
    await planning.setEntitlement(
      actor.userId,
      2035,
      { days: 0.5, version: 0 },
      admin,
    );
    const parallel = await Promise.allSettled([
      leave.create(base, actor),
      leave.create(
        { ...base, startDate: '2035-01-09', endDate: '2035-01-09' },
        actor,
      ),
    ]);
    const successes = parallel.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof leave.create>>
      > => result.status === 'fulfilled',
    );
    expect(successes).toHaveLength(1);
    expect(await planning.getBalance({ year: 2035 }, actor)).toMatchObject({
      used: 0,
      reserved: 0.5,
      remaining: 0,
    });
    await expect(
      planning.setEntitlement(
        actor.userId,
        2035,
        { days: 0, version: 1 },
        admin,
      ),
    ).rejects.toThrow('lower');
    await leave.cancel(successes[0].value.id, actor);
    expect(await planning.getBalance({ year: 2035 }, actor)).toMatchObject({
      reserved: 0,
      remaining: 0.5,
    });
    const request = await leave.create(base, actor);
    await leave.approve(request.id, manager);
    expect(await planning.getBalance({ year: 2035 }, actor)).toMatchObject({
      used: 0.5,
      reserved: 0,
      remaining: 0,
    });
    await expect(leave.approve(request.id, manager)).rejects.toThrow('already');
    await expect(
      planning.getBalance({ year: 2035, userId: actor.userId }, outsider),
    ).rejects.toThrow('Forbidden');
  });

  it('supports complementary half-days, excludes holidays and keeps saved units and private reasons out of team calendars', async () => {
    const { actor, manager, department } = await leaveFixture();
    const base = {
      startDate: '2035-01-08',
      endDate: '2035-01-08',
      reason: 'Thông tin riêng tư',
      type: 'UNPAID' as const,
      period: 'MORNING' as const,
    };
    const morning = await leave.create(base, actor);
    const afternoon = await leave.create(
      { ...base, period: 'AFTERNOON' },
      actor,
    );
    expect(morning.days[0].halfDays + afternoon.days[0].halfDays).toBe(2);
    await expect(
      leave.create({ ...base, type: 'SICK' }, actor),
    ).rejects.toThrow('overlaps');
    await expect(
      leave.create({ ...base, period: 'FULL_DAY' }, actor),
    ).rejects.toThrow('overlaps');
    await expect(
      leave.create({ ...base, endDate: '2035-01-09' }, actor),
    ).rejects.toThrow('same date');
    const calendar = await planning.calendar(
      { month: '2035-01', page: 1 },
      actor,
    );
    expect(calendar.items).toHaveLength(2);
    expect(JSON.stringify(calendar)).not.toContain(base.reason);
    expect(calendar.items[0]).not.toHaveProperty('type');
    await expect(
      planning.calendar(
        { month: '2035-01', page: 1, departmentId: department.id },
        outsider,
      ),
    ).rejects.toThrow('Forbidden');
    await expect(leave.findOne(morning.id, outsider)).rejects.toThrow(
      'not found',
    );
    const policy = { ...DEFAULT_SLA_POLICY, holidays: ['2035-01-09'] };
    await prisma.slaPolicy.update({
      where: { id: 1 },
      data: { config: policy },
    });
    const unpaid = await leave.create(
      {
        ...base,
        period: 'FULL_DAY',
        startDate: '2035-01-09',
        endDate: '2035-01-10',
      },
      actor,
    );
    expect(unpaid.days).toEqual([
      { date: new Date('2035-01-10T00:00:00Z'), halfDays: 2 },
    ]);
    await prisma.slaPolicy.update({
      where: { id: 1 },
      data: { config: { ...policy, holidays: ['2035-01-08', '2035-01-10'] } },
    });
    await leave.approve(unpaid.id, manager);
    expect((await leave.findOne(unpaid.id, actor)).days).toHaveLength(1);
    expect(await planning.getBalance({ year: 2035 }, actor)).toMatchObject({
      allowance: null,
      used: 0,
      reserved: 0,
    });
    const legacy = await prisma.leaveRequest.create({
      data: {
        requesterId: actor.userId,
        approverId: manager.userId,
        startDate: new Date('2035-02-01'),
        endDate: new Date('2035-02-02'),
        reason: 'Old leave',
      },
    });
    expect(legacy.type).toBe('LEGACY');
    expect(await planning.getBalance({ year: 2035 }, actor)).toMatchObject({
      legacyRequests: 1,
    });
    const enqueue = jest
      .spyOn(outbox, 'enqueue')
      .mockRejectedValueOnce(new Error('forced leave outbox failure'));
    await expect(
      leave.create(
        { ...base, startDate: '2035-03-05', endDate: '2035-03-05' },
        actor,
      ),
    ).rejects.toThrow('forced leave');
    expect(
      await prisma.leaveDay.count({
        where: {
          request: { requesterId: actor.userId },
          date: new Date('2035-03-05'),
        },
      }),
    ).toBe(0);
    enqueue.mockRestore();
  });

  it('uses the public ticket detail version to reopen and confirm the latest result', async () => {
    const ticket = await createTicket();
    await tickets.updateStatus(ticket.id, { status: 'IN_PROGRESS' }, admin);
    await tickets.updateStatus(ticket.id, { status: 'RESOLVED' }, admin);
    const first = await tickets.canGetById(ticket.id, employee);
    expect(first.resolutionVersion).toBe(1);
    expect(first.confirmedAt).toBeNull();
    await feedback.reopen(
      ticket.id,
      {
        resolutionVersion: first.resolutionVersion,
        reason: 'Still unable to connect',
      },
      employee,
    );
    await tickets.updateStatus(ticket.id, { status: 'RESOLVED' }, admin);
    const latest = await tickets.canGetById(ticket.id, employee);
    expect(latest.resolutionVersion).toBe(2);
    await feedback.confirm(
      ticket.id,
      { resolutionVersion: latest.resolutionVersion },
      employee,
    );
    expect(
      (await tickets.canGetById(ticket.id, employee)).confirmedAt,
    ).toBeInstanceOf(Date);
  });

  it('requires requester confirmation, rejects stale cycles, preserves original SLA and serializes competing responses', async () => {
    const ticket = await createTicket();
    await tickets.updateStatus(ticket.id, { status: 'IN_PROGRESS' }, admin);
    const resolved = await tickets.updateStatus(
      ticket.id,
      { status: 'RESOLVED' },
      admin,
    );
    const before = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    await expect(
      tickets.updateStatus(ticket.id, { status: 'CLOSED' }, admin),
    ).rejects.toThrow('Only the requester');
    await expect(
      feedback.confirm(
        ticket.id,
        { resolutionVersion: resolved.resolutionVersion },
        admin,
      ),
    ).rejects.toThrow('Only the requester');
    await feedback.reopen(
      ticket.id,
      {
        resolutionVersion: resolved.resolutionVersion,
        reason: 'Vẫn chưa truy cập VPN được',
      },
      employee,
    );
    expect(
      await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
    ).toMatchObject({
      status: 'IN_PROGRESS',
      resolveAt: null,
      dueAt: before.dueAt,
      assignedToId: before.assignedToId,
    });
    const resolvedAgain = await tickets.updateStatus(
      ticket.id,
      { status: 'RESOLVED' },
      admin,
    );
    expect(resolvedAgain.resolutionVersion).toBe(
      resolved.resolutionVersion + 1,
    );
    await expect(
      feedback.confirm(
        ticket.id,
        { resolutionVersion: resolved.resolutionVersion },
        employee,
      ),
    ).rejects.toThrow('changed');
    const races = await Promise.allSettled([
      feedback.confirm(
        ticket.id,
        { resolutionVersion: resolvedAgain.resolutionVersion },
        employee,
      ),
      feedback.reopen(
        ticket.id,
        {
          resolutionVersion: resolvedAgain.resolutionVersion,
          reason: 'VPN vẫn còn lỗi',
        },
        employee,
      ),
    ]);
    expect(
      races.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    let final = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    if (final.status === 'IN_PROGRESS') {
      const last = await tickets.updateStatus(
        ticket.id,
        { status: 'RESOLVED' },
        admin,
      );
      await feedback.confirm(
        ticket.id,
        { resolutionVersion: last.resolutionVersion },
        employee,
      );
      final = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
      });
    }
    expect(final).toMatchObject({ status: 'CLOSED', dueAt: before.dueAt });
    expect(final.confirmedAt).not.toBeNull();
    expect(
      await prisma.ticketComment.count({
        where: {
          ticketId: ticket.id,
          content: { contains: 'Yêu cầu xử lý tiếp' },
        },
      }),
    ).toBeGreaterThan(0);
    await expect(
      feedback.rate(ticket.id, { score: 1 }, employee),
    ).rejects.toThrow('reason');
    await expect(
      feedback.rate(ticket.id, { score: 5 }, outsider),
    ).rejects.toThrow('Only the requester');
    const ratings = await Promise.allSettled([
      feedback.rate(ticket.id, { score: 5 }, employee),
      feedback.rate(ticket.id, { score: 4 }, employee),
    ]);
    expect(
      ratings.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      await prisma.ticketFeedback.count({ where: { ticketId: ticket.id } }),
    ).toBe(1);
    await expect(feedback.get(ticket.id, outsider)).rejects.toThrow();
  });

  it('rolls back requester responses and ratings if audit or outbox fails', async () => {
    const ticket = await createTicket();
    await tickets.updateStatus(ticket.id, { status: 'IN_PROGRESS' }, admin);
    const resolved = await tickets.updateStatus(
      ticket.id,
      { status: 'RESOLVED' },
      admin,
    );
    const enqueue = jest
      .spyOn(outbox, 'enqueue')
      .mockRejectedValueOnce(new Error('forced result outbox failure'));
    await expect(
      feedback.reopen(
        ticket.id,
        {
          resolutionVersion: resolved.resolutionVersion,
          reason: 'Cần hỗ trợ tiếp',
        },
        employee,
      ),
    ).rejects.toThrow('forced result');
    expect(
      await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
    ).toMatchObject({ status: 'RESOLVED' });
    expect(
      await prisma.ticketComment.count({ where: { ticketId: ticket.id } }),
    ).toBe(0);
    enqueue.mockRestore();
    await feedback.confirm(
      ticket.id,
      { resolutionVersion: resolved.resolutionVersion },
      employee,
    );
    jest
      .spyOn(audit, 'create')
      .mockRejectedValueOnce(new Error('forced feedback audit failure'));
    await expect(
      feedback.rate(ticket.id, { score: 5 }, employee),
    ).rejects.toThrow('forced feedback');
    expect(
      await prisma.ticketFeedback.findUnique({
        where: { ticketId: ticket.id },
      }),
    ).toBeNull();
  });
});
