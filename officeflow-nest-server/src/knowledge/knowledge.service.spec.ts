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
});
