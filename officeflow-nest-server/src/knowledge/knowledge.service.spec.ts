import { Test, type TestingModule } from '@nestjs/testing';
import { UserRole, type Prisma } from '@prisma/client';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeService } from './knowledge.service';

const mockPrismaService = {
  knowledgeArticle: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
};

const mockAuditLogsService = {
  create: jest.fn(),
};

describe('KnowledgeService', () => {
  let service: KnowledgeService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
      ],
    }).compile();

    service = module.get(KnowledgeService);
  });

  it('should preserve the IT staff draft scope when searching', async () => {
    mockPrismaService.knowledgeArticle.findMany.mockResolvedValue([]);
    mockPrismaService.knowledgeArticle.count.mockResolvedValue(0);

    await service.findAll(
      { userId: 7, role: UserRole.IT_STAFF },
      { keyword: ' vpn ' },
    );

    const [findManyArgs] = mockPrismaService.knowledgeArticle.findMany.mock
      .calls[0] as [Prisma.KnowledgeArticleFindManyArgs];

    expect(findManyArgs.where).toEqual({
      OR: [{ isPublished: true }, { createdById: 7 }],
      AND: {
        OR: [
          { title: { contains: 'vpn' } },
          { summary: { contains: 'vpn' } },
          { content: { contains: 'vpn' } },
        ],
      },
    });
  });

  it('should return article content and the incremented view count', async () => {
    const article = {
      id: 5,
      title: 'VPN guide',
      slug: 'vpn-guide',
      summary: 'VPN help',
      content: 'Detailed VPN troubleshooting steps.',
      tags: 'vpn,network',
      isPublished: true,
      viewCount: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdById: 7,
      createdBy: {
        id: 7,
        name: 'IT Staff',
        email: 'it@example.com',
        role: UserRole.IT_STAFF,
      },
    };
    mockPrismaService.knowledgeArticle.findUnique.mockResolvedValue(article);
    mockPrismaService.knowledgeArticle.update.mockResolvedValue({
      viewCount: 4,
    });

    await expect(
      service.getById(5, { userId: 10, role: UserRole.EMPLOYEE }),
    ).resolves.toEqual({
      ...article,
      viewCount: 4,
    });

    const [findUniqueArgs] = mockPrismaService.knowledgeArticle.findUnique.mock
      .calls[0] as [Prisma.KnowledgeArticleFindUniqueArgs];
    expect(findUniqueArgs.select).toMatchObject({ content: true });
  });

  it('does not query the database for empty or generic request wording', async () => {
    await expect(
      service.suggestForTicket(
        { title: 'Không được cần lỗi' },
        { userId: 10, role: UserRole.EMPLOYEE },
      ),
    ).resolves.toEqual([]);
    expect(mockPrismaService.knowledgeArticle.findMany).not.toHaveBeenCalled();
  });

  it.each(Object.values(UserRole))(
    'only suggests published articles for %s',
    async (role) => {
      mockPrismaService.knowledgeArticle.findMany.mockResolvedValue([]);
      await service.suggestForTicket(
        { title: 'Không kết nối VPN' },
        { userId: 7, role },
      );
      const [args] = mockPrismaService.knowledgeArticle.findMany.mock
        .calls[0] as [Prisma.KnowledgeArticleFindManyArgs];
      expect(args.where).toMatchObject({ isPublished: true });
      expect(args.take).toBe(30);
      expect(args.select).not.toHaveProperty('content');
      expect(JSON.stringify(args.where)).toContain('vpn');
    },
  );

  it('ranks exact title/tag matches first and returns at most five without exposing scores', async () => {
    const article = (
      id: number,
      title: string,
      tags: string | null = null,
    ) => ({ id, title, tags, summary: null });
    mockPrismaService.knowledgeArticle.findMany.mockResolvedValue([
      ...Array.from({ length: 5 }, (_, index) =>
        article(index + 1, 'Laptop guide'),
      ),
      article(6, 'VPN guide', 'vpn'),
    ]);
    const result = await service.suggestForTicket(
      { title: 'VPN' },
      { userId: 10, role: UserRole.EMPLOYEE },
    );
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual(article(6, 'VPN guide', 'vpn'));
    expect(result[0]).not.toHaveProperty('score');
  });

  it('rejects a draft article opened by an employee without increasing its views', async () => {
    mockPrismaService.knowledgeArticle.findUnique.mockResolvedValue({
      id: 5,
      isPublished: false,
      createdById: 7,
    });
    await expect(
      service.getById(5, { userId: 10, role: UserRole.EMPLOYEE }),
    ).rejects.toThrow('Forbidden');
    expect(mockPrismaService.knowledgeArticle.update).not.toHaveBeenCalled();
  });
});
