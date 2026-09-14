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
import { TicketAccessPolicyService } from '../../src/tickets/ticket-access-policy.service';
import { TicketQueryService } from '../../src/tickets/ticket-query.service';
import { TicketWorkflowService } from '../../src/tickets/ticket-workflow.service';
import { TicketAttachmentService } from '../../src/tickets/ticket-attachment.service';
import { TicketCommentService } from '../../src/tickets/ticket-comment.service';

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
    limiter = new ResilientThrottlerStorage(redis);
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
    const other = new ResilientThrottlerStorage(redis);
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
});
