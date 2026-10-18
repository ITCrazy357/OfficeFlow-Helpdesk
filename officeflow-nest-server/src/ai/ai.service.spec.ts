import { TicketPriority, TicketStatus, UserRole } from '@prisma/client';
import { AiService } from './ai.service';
import { AiProvider } from './ai.provider';
import { AiRequestLimiter } from './ai-request-limiter';
import { AiTask } from './types/ai-draft.type';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { KnowledgeService } from '../knowledge/knowledge.service';

describe('AiService', () => {
  const actor = { userId: 1, role: UserRole.IT_STAFF };
  const date = new Date('2026-10-18T00:00:00Z');
  const ticket = {
    id: 5,
    title: 'VPN issue',
    description: 'password=private VPN không kết nối',
    status: TicketStatus.RESOLVED,
    priority: TicketPriority.MEDIUM,
    updatedAt: date,
    comments: [
      {
        id: 3,
        content: 'Đã khởi động lại VPN',
        createdAt: date,
        author: { role: UserRole.IT_STAFF },
      },
    ],
    _count: { comments: 1 },
  };
  const source = {
    id: 2,
    title: 'Hướng dẫn VPN',
    summary: 'Cấu hình VPN',
    content: 'Các bước cấu hình VPN an toàn',
    updatedAt: date,
  };
  const user = {
    role: UserRole.IT_STAFF,
    isActive: true,
    isLocked: false,
    mustChangePassword: false,
  };
  const prisma = {
    ticket: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    knowledgeArticle: { findMany: jest.fn<Promise<unknown[]>, [unknown]>() },
  };
  const knowledge = { suggestForTicket: jest.fn() };
  const provider = {
    status: jest.fn(),
    generate: jest.fn<Promise<unknown>, [AiTask, unknown]>(),
  };
  const limiter = {
    run: jest.fn((_id: number, work: () => Promise<unknown>) => work()),
  };
  const redis = { isReady: jest.fn() };
  const service = new AiService(
    prisma as unknown as PrismaService,
    knowledge as unknown as KnowledgeService,
    provider as unknown as AiProvider,
    limiter as unknown as AiRequestLimiter,
    redis as unknown as RedisService,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    provider.status.mockReturnValue({ enabled: true, model: 'test-model' });
    provider.generate.mockResolvedValue({
      draft: {
        title: '',
        summary: '',
        content: 'Kiểm tra cấu hình VPN.',
        sourceIds: [2],
      },
      model: 'test-model',
      inputTokens: 100,
      outputTokens: 40,
    });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.knowledgeArticle.findMany.mockResolvedValue([source]);
    knowledge.suggestForTicket.mockResolvedValue([source]);
    redis.isReady.mockReturnValue(true);
  });

  it.each([UserRole.EMPLOYEE, UserRole.MANAGER])(
    'denies %s before reading any context',
    async (role) => {
      await expect(
        service.generate(5, AiTask.REPLY, { ...actor, role }),
      ).rejects.toMatchObject({ status: 403 });
      expect(prisma.ticket.findUnique).not.toHaveBeenCalled();
    },
  );
  it('distinguishes disabled AI from unavailable Redis', () => {
    expect(service.status(actor)).toEqual({
      enabled: true,
      model: 'test-model',
      reason: null,
    });
    redis.isReady.mockReturnValue(false);
    expect(service.status(actor).reason).toBe('UNAVAILABLE');
    provider.status.mockReturnValue({ enabled: false, model: null });
    expect(service.status(actor).reason).toBe('DISABLED');
  });
  it('rejects disabled AI before context reads', async () => {
    provider.status.mockReturnValue({ enabled: false });
    await expect(
      service.generate(5, AiTask.SUMMARY, actor),
    ).rejects.toMatchObject({ status: 503 });
    expect(provider.generate).not.toHaveBeenCalled();
  });
  it('handles a missing ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);
    await expect(
      service.generate(5, AiTask.REPLY, actor),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('does not draft an article from an unresolved ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      status: TicketStatus.IN_PROGRESS,
    });
    await expect(
      service.generate(5, AiTask.ARTICLE, actor),
    ).rejects.toMatchObject({ status: 422 });
    expect(provider.generate).not.toHaveBeenCalled();
  });
  it('requires published knowledge for a reply before calling the provider', async () => {
    prisma.knowledgeArticle.findMany.mockResolvedValue([]);
    await expect(
      service.generate(5, AiTask.REPLY, actor),
    ).rejects.toMatchObject({ status: 422 });
    expect(provider.generate).not.toHaveBeenCalled();
  });
  it('returns a draft with validated sources without performing business writes', async () => {
    const result = await service.generate(5, AiTask.REPLY, actor);
    expect(result).toMatchObject({
      task: AiTask.REPLY,
      ticketId: 5,
      sources: [{ id: 2, title: source.title }],
      context: { truncated: false },
    });
    expect(prisma.knowledgeArticle.findMany.mock.calls[0][0]).toMatchObject({
      where: { isPublished: true },
    });
    // Mock intentionally has read methods only: any accidental write fails this test.
    const input = provider.generate.mock.calls[0][1] as {
      ticket: { description: string };
    };
    expect(input.ticket.description).not.toContain('private');
    expect(input).not.toHaveProperty('attachments');
    expect(input).not.toHaveProperty('createdBy');
  });
  it('does not query knowledge when summarizing', async () => {
    provider.generate.mockResolvedValue({
      draft: {
        title: '',
        summary: '',
        content: 'Tóm tắt phần lịch sử.',
        sourceIds: [],
      },
      model: 'test-model',
    });
    await expect(
      service.generate(5, AiTask.SUMMARY, actor),
    ).resolves.toMatchObject({ sources: [] });
    expect(knowledge.suggestForTicket).not.toHaveBeenCalled();
    expect(prisma.knowledgeArticle.findMany).not.toHaveBeenCalled();
  });
  it('bounds input and discloses truncation', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticket,
      description: 'd'.repeat(7000),
      comments: [{ ...ticket.comments[0], content: 'c'.repeat(1500) }],
      _count: { comments: 30 },
    });
    prisma.knowledgeArticle.findMany.mockResolvedValue([
      { ...source, content: 's'.repeat(5000) },
    ]);
    await expect(
      service.generate(5, AiTask.REPLY, actor),
    ).resolves.toMatchObject({
      context: { truncated: true, totalComments: 30 },
    });
    const input = provider.generate.mock.calls[0][1] as {
      ticket: { description: string };
      comments: { content: string }[];
      sources: { content: string }[];
    };
    expect(input.ticket.description).toHaveLength(6000);
    expect(input.comments[0].content).toHaveLength(1200);
    expect(input.sources[0].content).toHaveLength(4000);
  });
  it.each([{ sourceIds: [99] }, { sourceIds: [] }])(
    'rejects fabricated or absent reply citations %j',
    async ({ sourceIds }) => {
      provider.generate.mockResolvedValue({
        draft: { sourceIds },
        model: 'test-model',
      });
      await expect(
        service.generate(5, AiTask.REPLY, actor),
      ).rejects.toMatchObject({ status: 502 });
    },
  );
  it('rejects drafts when a new comment arrives', async () => {
    prisma.ticket.findUnique
      .mockResolvedValueOnce(ticket)
      .mockResolvedValueOnce({ ...ticket, _count: { comments: 2 } });
    await expect(
      service.generate(5, AiTask.REPLY, actor),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('rejects sources unpublished or edited during generation', async () => {
    prisma.knowledgeArticle.findMany
      .mockResolvedValueOnce([source])
      .mockResolvedValueOnce([]);
    await expect(
      service.generate(5, AiTask.REPLY, actor),
    ).rejects.toMatchObject({ status: 409 });
  });
  it.each([
    { isActive: false },
    { isLocked: true },
    { mustChangePassword: true },
    { role: UserRole.EMPLOYEE },
  ])('rechecks permission before returning content %j', async (change) => {
    prisma.user.findUnique.mockResolvedValue({ ...user, ...change });
    await expect(
      service.generate(5, AiTask.REPLY, actor),
    ).rejects.toMatchObject({ status: 403 });
  });
});
