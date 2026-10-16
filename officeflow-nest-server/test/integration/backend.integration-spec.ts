import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { AssetType, TicketPriority, UserRole } from '@prisma/client';
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
import { DEFAULT_SLA_POLICY } from '../../src/sla/sla-policy';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { NotificationsListener } from '../../src/notifications/notifications.listener';
import type { TicketSlaAlertEvent } from '../../src/notifications/events/ticket-sla-alert.event';

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
});
